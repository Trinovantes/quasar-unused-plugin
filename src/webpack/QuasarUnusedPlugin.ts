import { existsSync } from 'node:fs'
import path from 'node:path'
import quasarJson from 'quasar/package.json'
import { WebpackPluginInstance, Compiler, javascript, NormalModule } from 'webpack'
import { PLUGIN_NAME, QUASAR_INDEX_FILE, QUASAR_SIDE_EFFECTS } from '../Constants'
import { QuasarUnusedPluginOptions, validateQuasarUnusedPluginOptions } from './QuasarUnusedPluginOptions'
import { ReplaceValueDependency } from './ReplaceValueDependency'

export class QuasarUnusedPlugin implements WebpackPluginInstance {
    #options: QuasarUnusedPluginOptions

    constructor(options: QuasarUnusedPluginOptions = {}) {
        validateQuasarUnusedPluginOptions(options)
        this.#options = options
    }

    apply(compiler: Compiler) {
        this.#replaceQuasarMacros(compiler)
        this.#rewriteQuasarPackageSideEffects(compiler)
        this.#rewriteQuasarImportForScripts(compiler)
        this.#rewriteQuasarImportForComponents(compiler)
    }

    #replaceQuasarMacros(compiler: Compiler) {
        const isServerBuild = (compiler.options.target === 'node')
        const enableSsr = this.#options.enableSsr ?? false
        const enablePwa = this.#options.enablePwa ?? false
        const replacements: Record<string, string | boolean> = {
            __QUASAR_VERSION__: quasarJson.version,
            __QUASAR_SSR__: enableSsr,
            __QUASAR_SSR_SERVER__: enableSsr && isServerBuild,
            __QUASAR_SSR_CLIENT__: enableSsr && !isServerBuild,
            __QUASAR_SSR_PWA__: enableSsr && enablePwa,
        }

        const logger = compiler.getInfrastructureLogger(PLUGIN_NAME)
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

    #rewriteQuasarImportForScripts(compiler: Compiler) {
        const loaderFile = path.join(__dirname, 'loaders', 'TransformScript')
        const loaderExt = existsSync(`${loaderFile}.ts`) ? 'ts' : 'js'
        const loader = `${loaderFile}.${loaderExt}`

        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            NormalModule.getCompilationHooks(compilation).beforeLoaders.tap(PLUGIN_NAME, (loaderItems, normalModule) => {
                const request = normalModule.request
                const isJsFile = /\.[c|m]?[t|j]s$/.test(request)
                const isVueScriptFile = request.includes('.vue?vue&type=script')

                if (!(isJsFile || isVueScriptFile)) {
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

    #rewriteQuasarImportForComponents(compiler: Compiler) {
        const loaderFile = path.join(__dirname, 'loaders', 'TransformVueTemplate')
        const loaderExt = existsSync(`${loaderFile}.ts`) ? 'ts' : 'js'
        const loader = `${loaderFile}.${loaderExt}`

        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            NormalModule.getCompilationHooks(compilation).beforeLoaders.tap(PLUGIN_NAME, (loaderItems, normalModule) => {
                const request = normalModule.request

                // e.g. esbuild-loader!/App.vue?vue&type=script&setup=true
                const isScriptSetup = request.includes('.vue?vue&type=script') && request.includes('setup=true')

                // e.g. esbuild-loader!/App.vue?vue&type=template
                const isTemplate = request.includes('.vue?vue&type=template')

                if (!(isTemplate || isScriptSetup)) {
                    return
                }

                // Only use loader once per module
                if (loaderItems.find((loaderItem) => loaderItem.loader === loader)) {
                    return
                }

                // Inject loader after <template> has been processed by vue-loader
                const insertLoaderIdx = isScriptSetup
                    ? loaderItems.findIndex((loaderItem) => /vue-loader[\\/]dist[\\/]index\.js/.test(loaderItem.loader)) // Inject into <script> after it gets processed by vue-loader
                    : loaderItems.findIndex((loaderItem) => /vue-loader[\\/]dist[\\/]templateLoader\.js/.test(loaderItem.loader)) // Inject into ssrRender after <template> is processed by vue-loader

                loaderItems.splice(insertLoaderIdx, 0, {
                    loader,
                    options: null,
                    ident: null,
                    type: null,
                })
            })
        })
    }

    #rewriteQuasarPackageSideEffects(compiler: Compiler) {
        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            // Rewrite quasar module when it gets ingested by webpack
            NormalModule.getCompilationHooks(compilation).beforeLoaders.tap(PLUGIN_NAME, (loaderItems, normalModule) => {
                const request = normalModule.request
                const isQuasarIndexFile = request.includes(QUASAR_INDEX_FILE)
                if (!(isQuasarIndexFile)) {
                    return
                }

                // Set "sideEffects" flag to false so that webpack can tree shake unused imports
                const packageJson = (normalModule.resourceResolveData as Record<string, Record<string, unknown>>)?.descriptionFileData
                packageJson.sideEffects = this.#options.sideEffectsOverride ?? QUASAR_SIDE_EFFECTS
            })
        })
    }
}
