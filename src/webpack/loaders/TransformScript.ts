import { QUASAR_INDEX_FILE } from '../../Constants'
import { LoaderContext } from 'webpack'

/**
 * Rewrites imports for 'quasar' in JS files to Quasar's barrel file
 * e.g. import { QBtn } from 'quasar' => import { QBtn } from 'quasar/src/index.prod.js'
 */
export default function(this: LoaderContext<unknown>, source: string) {
    const importRegex = /import\s*\{([\w,\s]+)\}\s*from\s*['"](quasar)['"]/g
    if (!importRegex.test(source)) {
        return source
    }

    const modifiedSource = source.replace(importRegex, (_, match: string) => {
        return match
            .split(',')
            .map((quasarItem) => {
                const item = quasarItem.split(' as ')

                // It's possible to have an empty item
                // e.g. import { QBtn, } from 'quasar'
                //                   ^

                const originalImport = item.at(0)?.trim()
                if (!originalImport) {
                    return ''
                }

                const importAlias = item.at(1)?.trim() ?? originalImport
                return `import {${originalImport} as ${importAlias}} from '${QUASAR_INDEX_FILE}';\n`
            })
            .join('')
    })

    return modifiedSource
}
