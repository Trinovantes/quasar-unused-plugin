import type { CallExpression, Node } from 'estree'
import { visitChildren } from './visitChildren'

export function findCallExpression(root: Node, calleeName: string): CallExpression | undefined {
    const found = (node: Node): node is CallExpression => {
        if (node.type !== 'CallExpression') {
            return false
        }

        if (node.callee.type !== 'Identifier') {
            return false
        }

        if (node.callee.name !== calleeName) {
            return false
        }

        return true
    }

    const search = (node: Node): CallExpression | undefined => {
        if (found(node)) {
            return node
        } else {
            return visitChildren(node, search)
        }
    }

    return search(root)
}
