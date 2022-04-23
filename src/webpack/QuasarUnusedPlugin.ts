import { WebpackPluginInstance, Compiler, javascript, NormalModule, Compilation } from 'webpack'
import { PLUGIN_NAME, QUASAR_INDEX_FILE, QUASAR_SIDE_EFFECTS } from '../Constants'
import { walk } from 'estree-walker'
import type { CallExpression, ImportDeclaration } from 'estree'
import quasarAutoImportJson from 'quasar/dist/transforms/auto-import.json'
import { ReplaceValueDependency } from './ReplaceValueDependency'
import quasarJson from 'quasar/package.json'
import path from 'path'
import { existsSync } from 'fs'
import type { QuasarUnusedLoaderOptions } from './QuasarUnusedLoaderOptions'
import type { QuasarUnusedPluginOptions } from './QuasarUnusedPluginOptions'

interface QuasarAutoImport {
    importName: Record<string, string>
    regex: {
        components: string
        directives: string
    }
}

const quasarAutoImport = quasarAutoImportJson as QuasarAutoImport
const componentRegex = new RegExp(quasarAutoImport.regex.components)

export class QuasarUnusedPlugin implements WebpackPluginInstance {
    #usedComponents = new Set<string>()
    #options: QuasarUnusedPluginOptions

    constructor(options: QuasarUnusedPluginOptions = {}) {
        this.#options = options
    }

    apply(compiler: Compiler) {
        this.#replaceQuasarMacros(compiler)
        this.#findUsedComponents(compiler)
        this.#rewriteQuasarModule(compiler)
    }

    #replaceQuasarMacros(compiler: Compiler) {
        const logger = compiler.getInfrastructureLogger(PLUGIN_NAME)

        const isServerBuild = (compiler.options.target === 'node')
        const enableSsr = this.#options.enableSsr ?? true
        const enablePwa = this.#options.enablePwa ?? false
        const replacements: Record<string, string | boolean> = {
            __QUASAR_VERSION__: quasarJson.version,
            __QUASAR_SSR__: enableSsr && isServerBuild,
            __QUASAR_SSR_SERVER__: enableSsr && isServerBuild,
            __QUASAR_SSR_CLIENT__: enableSsr && !isServerBuild,
            __QUASAR_SSR_PWA__: enableSsr && enablePwa,
        }

        logger.info('Setting Globals', replacements)

        compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
            compilation.dependencyTemplates.set(ReplaceValueDependency, new ReplaceValueDependency.Template())
        })

        compiler.hooks.normalModuleFactory.tap(PLUGIN_NAME, (normalModuleFactory) => {
            const onParserCreated = (parser: javascript.JavascriptParser) => {
                for (const [key, value] of Object.entries(replacements)) {
                    parser.hooks.expression.for(key).tap(PLUGIN_NAME, (expr) => {
                        parser.state.module.addDependency(new ReplaceValueDependency(expr, JSON.stringify(value)))
                    })
                }
            }

            normalModuleFactory.hooks.parser.for('javascript/auto').tap(PLUGIN_NAME, onParserCreated)
            normalModuleFactory.hooks.parser.for('javascript/dynamic').tap(PLUGIN_NAME, onParserCreated)
            normalModuleFactory.hooks.parser.for('javascript/esm').tap(PLUGIN_NAME, onParserCreated)
        })
    }

    #findUsedComponents(compiler: Compiler) {
        compiler.hooks.normalModuleFactory.tap(PLUGIN_NAME, (normalModuleFactory) => {
            const onParserCreated = (parser: javascript.JavascriptParser) => {
                parser.hooks.program.tap(PLUGIN_NAME, (ast) => {
                    const moduleName = parser.state.module.identifier()
                    const parts = moduleName.split('!')
                    if (parts[parts.length - 1].includes('node_modules')) {
                        return
                    }

                    let resolveComponentLocalId: string | undefined

                    walk(ast, {
                        enter: (n) => {
                            if (n.type !== 'ImportDeclaration') {
                                return
                            }

                            const node = n as ImportDeclaration
                            if (node.source.value !== 'vue') {
                                return
                            }

                            for (const specifier of node.specifiers) {
                                if (specifier.type !== 'ImportSpecifier') {
                                    continue
                                }

                                if (specifier.imported.name !== 'resolveComponent') {
                                    continue
                                }

                                resolveComponentLocalId = specifier.local.name
                            }
                        },
                    })

                    if (!resolveComponentLocalId) {
                        return
                    }

                    walk(ast, {
                        enter: (n) => {
                            if (n.type !== 'CallExpression') {
                                return
                            }

                            const node = n as CallExpression
                            if (!(node.callee.type === 'Identifier' && node.callee.name === resolveComponentLocalId)) {
                                return
                            }

                            if (node.arguments[0].type !== 'Literal') {
                                return
                            }

                            const componentName = node.arguments[0].raw?.replace(/['"]+/g, '') ?? ''
                            if (!componentRegex.test(componentName)) {
                                return
                            }

                            const canonicalName = quasarAutoImport.importName[componentName]
                            if (!canonicalName) {
                                return
                            }

                            this.#usedComponents.add(canonicalName)
                        },
                    })
                })
            }

            normalModuleFactory.hooks.parser.for('javascript/auto').tap(PLUGIN_NAME, onParserCreated)
            normalModuleFactory.hooks.parser.for('javascript/dynamic').tap(PLUGIN_NAME, onParserCreated)
            normalModuleFactory.hooks.parser.for('javascript/esm').tap(PLUGIN_NAME, onParserCreated)
        })
    }

    #rewriteQuasarModule(compiler: Compiler) {
        const logger = compiler.getInfrastructureLogger(PLUGIN_NAME)
        let isFirstPass = true
        let modifiedQuasar = false

        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            // Need one complete compilation pass to be able to parse all source files for references to quasar components
            compilation.hooks.needAdditionalPass.tap(PLUGIN_NAME, () => {
                if (isFirstPass) {
                    logger.info(`Found ${this.#usedComponents.size} Quasar component(s) being used`, [...this.#usedComponents])
                    isFirstPass = false
                    return true
                }

                if (!modifiedQuasar) {
                    logger.warn(`Did not find Quasar module to rewrite. Did you import from "${QUASAR_INDEX_FILE}"?`)
                }

                return false
            })

            // Disable assets for first pass since we need to first parse all assets for references to quasar components
            compilation.hooks.processAssets.tap({
                name: PLUGIN_NAME,
                stage: Compilation.PROCESS_ASSETS_STAGE_PRE_PROCESS,
            }, () => {
                if (!isFirstPass) {
                    return
                }

                for (const asset of Object.keys(compilation.assets)) {
                    compilation.deleteAsset(asset)
                }
            })

            // Rewrite quasar module when it gets ingested by webpack
            NormalModule.getCompilationHooks(compilation).beforeLoaders.tap(PLUGIN_NAME, (loaderItems, normalModule) => {
                const request = normalModule.request
                if (!request.includes(QUASAR_INDEX_FILE)) {
                    return
                }

                if (isFirstPass) {
                    return
                }

                const packageJson = normalModule.resourceResolveData?.descriptionFileData as Record<string, unknown>
                packageJson.sideEffects = this.#options.sideEffectsOverride ?? QUASAR_SIDE_EFFECTS

                const loaderPath = path.join(__dirname, '../loader')
                const loaderExt = existsSync(`${loaderPath}.ts`) ? 'ts' : 'js'
                const loader = `${loaderPath}.${loaderExt}`

                // Only use loader once per module
                if (loaderItems.find((loaderItem) => loaderItem.loader === loader)) {
                    return
                }

                const options: QuasarUnusedLoaderOptions = {
                    usedComponents: [...this.#usedComponents],
                }

                loaderItems.push({
                    loader,
                    options,
                    ident: null,
                    type: null,
                })

                modifiedQuasar = true
            })
        })
    }
}
