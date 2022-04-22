import { PLUGIN_NAME } from '../Constants'
import type { LoaderContext } from 'webpack'
import type { QuasarUnusedLoaderOptions } from './QuasarUnusedLoaderOptions'

// eslint-disable-next-line @typescript-eslint/naming-convention
export function QuasarUnusedLoader(this: LoaderContext<QuasarUnusedLoaderOptions>, source: string): string {
    const logger = this.getLogger(PLUGIN_NAME)
    const options = this.getOptions()

    const match = /\{\s*components/.exec(source)
    if (!match) {
        logger.warn('Failed to rewrite quasar')
        return source
    }

    const components = options.usedComponents
        .map((c) => `components.${c}`)
        .join(', ')

    const injectionPoint = match.index + match[0].length
    const injection = `: [${components}]`
    const modifiedSource = source.slice(0, injectionPoint) + injection + source.slice(injectionPoint)

    return modifiedSource
}
