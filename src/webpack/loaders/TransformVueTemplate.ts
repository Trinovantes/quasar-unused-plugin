import { LoaderContext } from 'webpack'
import quasarAutoImportJson from 'quasar/dist/transforms/auto-import.json'
import { QUASAR_INDEX_FILE } from '../../Constants'

type QuasarAutoImport = {
    importName: Record<string, string>
    regex: {
        components: string
        directives: string
    }
}

const quasarAutoImport = quasarAutoImportJson as QuasarAutoImport
const componentRegex =  new RegExp(`const (_component_.+) = _resolveComponent\\("${quasarAutoImport.regex.components}"\\)!?`, 'g')
const directiveRegex = new RegExp(`const (_directive_.+) = _resolveDirective\\("${quasarAutoImport.regex.directives.replace(/v-/g, '')}"\\)!?`, 'g')

export default function(this: LoaderContext<unknown>, source: string) {
    if (!componentRegex.test(source) && !directiveRegex.test(source)) {
        return source
    }

    const quasarImports = new Array<{ localName: string; importName: string }>()

    source = source.replace(componentRegex, (_, localName: string, originalName: string) => {
        quasarImports.push({
            localName,
            importName: quasarAutoImport.importName[originalName],
        })
        return '' // Delete the local variable
    })

    source = source.replace(directiveRegex, (_, localName: string, originalName: string) => {
        quasarImports.push({
            localName,
            importName: quasarAutoImport.importName[`v-${originalName}`],
        })
        return '' // Delete the local variable
    })

    const newImports = quasarImports.map(({ localName, importName: originalName }) => `import { ${originalName} as ${localName} } from '${QUASAR_INDEX_FILE}';\n`)
    const modifiedSource = newImports.join('') + source
    return modifiedSource
}
