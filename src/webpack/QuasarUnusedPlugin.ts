import { WebpackPluginInstance, Compiler, javascript, NormalModule, Compilation } from 'webpack'
import { PLUGIN_NAME, QUASAR_INDEX_FILE, QUASAR_SIDE_EFFECTS } from '../Constants'
import quasarAutoImportJson from 'quasar/dist/transforms/auto-import.json'
import { ReplaceValueDependency } from './ReplaceValueDependency'
import quasarJson from 'quasar/package.json'
import path from 'path'
import { existsSync } from 'fs'
import type { QuasarUnusedLoaderOptions } from './QuasarUnusedLoaderOptions'
import type { QuasarUnusedPluginOptions } from './QuasarUnusedPluginOptions'
import { findImportLocalId } from '../utils/findImportLocalId'
import { findCallExpressions } from '../utils/findCallExpressions'

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

    /**
     * 1. First pass (readonly, disable emits)
     *      - Read input files (not in node_modules)
     *      - Parse input files into AST
     *      - Traverse AST and find Identifier nodes with names that match Quasar component name regex
     *
     * 2. Second pass
     *      - Append loader to node_modules/quasar/src/index.all
     *      - Modify node_modules/quasar/src/index.all based on names from first pass
     *      - Run terser and other optimizations like tree shaking
     *
     * Why rewrite quasar/src/index.all instead of modifying the Component.vue?vue&type=template files directly with a loader like the official CLI tools?
     * - That would be idea as then we wouldn't need multiple passes
     * - However
     *      Quasar also needs to call installQuasar() from src/install-quasar to initialize the library
     *      This file/function does not have TypeScript definitions and is not exported making it infeasible
     *      As a result, we have to call the generic exported Vue wrapper from quasar/src/index.all
     */
    apply(compiler: Compiler) {
        this.#replaceQuasarMacros(compiler)

        // Don't run in dev mode since tree-shaking is disabled anyways
        if (compiler.options.mode === 'development') {
            return
        }

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
    }

    #rewriteQuasarModule(compiler: Compiler) {
        const logger = compiler.getInfrastructureLogger(PLUGIN_NAME)
        let isFirstPass = true

        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            // Need one complete compilation pass to be able to parse all source files for references to quasar components
            compilation.hooks.needAdditionalPass.tap(PLUGIN_NAME, () => {
                if (isFirstPass) {
                    logger.info(`Found ${this.#usedComponents.size} Quasar component(s) being used`, [...this.#usedComponents])
                    isFirstPass = false
                    return true
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
            })
        })
    }
}
