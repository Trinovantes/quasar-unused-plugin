import { existsSync } from 'node:fs'
import path from 'node:path'
import quasarAutoImportJson from 'quasar/dist/transforms/auto-import.json'
import quasarJson from 'quasar/package.json'
import { WebpackPluginInstance, Compiler, javascript, NormalModule, Compilation } from 'webpack'
import { PLUGIN_NAME, QUASAR_INDEX_FILE, QUASAR_SIDE_EFFECTS } from '../Constants'
import { findCallExpressions } from '../utils/findCallExpressions'
import { findImportLocalId } from '../utils/findImportLocalId'
import { QuasarUnusedPluginOptions, validateQuasarUnusedPluginOptions } from './QuasarUnusedPluginOptions'
import { ReplaceValueDependency } from './ReplaceValueDependency'
import { QuasarUnusedLoaderOptions } from './QuasarUnusedLoaderOptions'

type QuasarAutoImport = {
    importName: Record<string, string>
    regex: {
        components: string
        directives: string
    }
}

enum CompilationPass {
    INIT,
    FIND_COMPONENTS,
    MODIFY_QUASAR,
    NUM_PASSES,
}

const quasarAutoImport = quasarAutoImportJson as QuasarAutoImport
const componentRegex = new RegExp(quasarAutoImport.regex.components)

export class QuasarUnusedPlugin implements WebpackPluginInstance {
    #usedComponents = new Set<string>()
    #options: QuasarUnusedPluginOptions

    constructor(options: QuasarUnusedPluginOptions = {}) {
        validateQuasarUnusedPluginOptions(options)
        this.#options = options
    }

    /**
     * 1. First pass (readonly, all emits later deleted)
     *      - Parse user js files into AST and find Identifier nodes with names that match Quasar component name regex
     *      - Replace imports of 'quasar' with 'quasar/src/index.prod.js'
     *
     * 2. Second pass
     *      - Append loader to node_modules/quasar/src/index.prod.js
     *      - Modify node_modules/quasar/src/index.prod.js based on names from first pass
     *      - Run terser and other optimizations like tree shaking
     *
     * Why rewrite quasar/src/index.prod.js instead of modifying the Component.vue?vue&type=template files directly with a loader like the official CLI tools?
     * - That would be idea as then we wouldn't need multiple passes
     * - However
     *      Quasar also needs to call installQuasar() from src/install-quasar to initialize the library
     *      This file/function does not have TypeScript definitions and is not exported making it infeasible
     *      As a result, we have to call the generic exported Vue wrapper from quasar/src/index.prod.js
     */
    apply(compiler: Compiler) {
        this.#replaceQuasarMacros(compiler)
        this.#rewriteQuasarImport(compiler)

        // Don't run when not in production since tree-shaking is disabled anyways
        if (compiler.options.mode !== 'production') {
            return
        }

        this.#findUsedComponents(compiler)
        this.#modifyQuasarModule(compiler)
    }

    #replaceQuasarMacros(compiler: Compiler) {
        const logger = compiler.getInfrastructureLogger(PLUGIN_NAME)

        const isServerBuild = (compiler.options.target === 'node')
        const enableSsr = this.#options.enableSsr ?? false
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

                    const resolveComponentLocalId = findImportLocalId(ast, 'vue', 'resolveComponent')
                    if (!resolveComponentLocalId) {
                        return
                    }

                    const callExprs = findCallExpressions(ast, resolveComponentLocalId)
                    for (const callExpr of callExprs) {
                        if (callExpr.arguments[0].type !== 'Literal') {
                            continue
                        }

                        const componentName = callExpr.arguments[0].raw?.replace(/['"]+/g, '') ?? ''
                        if (!componentRegex.test(componentName)) {
                            continue
                        }

                        const canonicalName = quasarAutoImport.importName[componentName]
                        if (!canonicalName) {
                            continue
                        }

                        this.#usedComponents.add(canonicalName)
                    }
                })
            }

            normalModuleFactory.hooks.parser.for('javascript/auto').tap(PLUGIN_NAME, onParserCreated)
            normalModuleFactory.hooks.parser.for('javascript/dynamic').tap(PLUGIN_NAME, onParserCreated)
            normalModuleFactory.hooks.parser.for('javascript/esm').tap(PLUGIN_NAME, onParserCreated)
        })

        let printed = false
        compiler.hooks.done.tap(PLUGIN_NAME, () => {
            if (compiler.options.target !== 'web') {
                return
            }

            if (printed) {
                return
            }

            const logger = compiler.getInfrastructureLogger(PLUGIN_NAME)
            logger.info(`Found ${this.#usedComponents.size} Quasar component(s) being used`, [...this.#usedComponents])
            printed = true
        })
    }

    #rewriteQuasarImport(compiler: Compiler) {
        const loaderFile = path.join(__dirname, 'QuasarImportLoader')
        const loaderExt = existsSync(`${loaderFile}.ts`) ? 'ts' : 'js'
        const loader = `${loaderFile}.${loaderExt}`

        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            NormalModule.getCompilationHooks(compilation).beforeLoaders.tap(PLUGIN_NAME, (loaderItems, normalModule) => {
                const request = normalModule.request
                const isJsFile = /\.[c|m]?[t|j]s$/.test(request)
                const isVueScriptFile = request.includes('.vue?vue&type=script')

                if (!isJsFile && !isVueScriptFile) {
                    return
                }

                // Only use loader once per module
                if (loaderItems.find((loaderItem) => loaderItem.loader === loader)) {
                    return
                }

                loaderItems.push({
                    loader,
                    options: null,
                    ident: null,
                    type: null,
                })
            })
        })
    }

    #modifyQuasarModule(compiler: Compiler) {
        const loaderFile = path.join(__dirname, 'QuasarUnusedLoader')
        const loaderExt = existsSync(`${loaderFile}.ts`) ? 'ts' : 'js'
        const loader = `${loaderFile}.${loaderExt}`

        // Track compilation passes
        let currentPass = CompilationPass.INIT
        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            currentPass += 1

            compilation.hooks.needAdditionalPass.tap(PLUGIN_NAME, () => {
                return currentPass < CompilationPass.NUM_PASSES
            })
        })

        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            // Delete assets for passes before this one since we need to first parse all assets for references to quasar components
            compilation.hooks.processAssets.tap({
                name: PLUGIN_NAME,
                stage: Compilation.PROCESS_ASSETS_STAGE_PRE_PROCESS,
            }, () => {
                if (currentPass < CompilationPass.MODIFY_QUASAR) {
                    for (const asset of Object.keys(compilation.assets)) {
                        compilation.deleteAsset(asset)
                    }
                }
            })

            // Rewrite quasar module when it gets ingested by webpack
            NormalModule.getCompilationHooks(compilation).beforeLoaders.tap(PLUGIN_NAME, (loaderItems, normalModule) => {
                const request = normalModule.request

                if (!request.includes(QUASAR_INDEX_FILE)) {
                    return
                }

                if (currentPass < CompilationPass.MODIFY_QUASAR) {
                    return
                }

                // Set "sideEffects" flag to false so that webpack can tree-shake unused imports
                const packageJson = normalModule.resourceResolveData?.descriptionFileData as Record<string, unknown>
                packageJson.sideEffects = this.#options.sideEffectsOverride ?? QUASAR_SIDE_EFFECTS

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
            })
        })
    }
}
