import { PLUGIN_NAME, QUASAR_INDEX_FILE } from '../../Constants'
import { LoaderContext } from 'webpack'

/**
 * Rewrites Quasar's barrel file to not use the `components` and `directives` variables and thus allowing webpack to tree shake the file
 */
export default function(this: LoaderContext<null>, source: string): string {
    const logger = this.getLogger(PLUGIN_NAME)
    const re = /\{\s*components\s*,\s*directives\s*,\s*\.\.\.opts\s*\}/
    if (!re.test(source)) {
        logger.warn(`Failed to rewrite ${QUASAR_INDEX_FILE}`)
        return source
    }

    const modifiedSource = source.replace(re, () => '{ components: [], directives: [], ...opts }')
    return modifiedSource
}
