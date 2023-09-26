import { visitChildren } from './visitChildren'
import { ImportDefaultSpecifier, ImportSpecifier, Node } from 'estree'

export function findImportLocalId(root: Node, importSource: string, importName: string): string | undefined {
    const search = (node: Node): ImportSpecifier | ImportDefaultSpecifier | undefined => {
        if (node.type === 'ImportDeclaration' && node.source.value === importSource) {
            for (const specifier of node.specifiers) {
                if (specifier.type === 'ImportSpecifier' && specifier.imported.name === importName) {
                    return specifier
                }

                if (specifier.type === 'ImportDefaultSpecifier' && specifier.local.name === importName) {
                    return specifier
                }
            }
        }

        return visitChildren(node, search)
    }

    return search(root)?.local.name
}
