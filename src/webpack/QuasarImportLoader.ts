import { QUASAR_INDEX_FILE } from '../Constants'
import { LoaderContext } from 'webpack'

const regex = /import\s*\{([\w,\s]+)\}\s*from\s*['"](quasar)['"]/g

// eslint-disable-next-line @typescript-eslint/naming-convention
export default function QuasarImportLoader(this: LoaderContext<unknown>, source: string) {
    const matches = regex.exec(source)
    if (!matches) {
        return source
    }

    const modifiedSource = source.replace(regex, (_, match: string) => {
        return `import {${match}} from '${QUASAR_INDEX_FILE}';`
    })

    return modifiedSource
}
