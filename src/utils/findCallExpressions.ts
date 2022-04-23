import type { CallExpression, Node } from 'estree'
import { visitChildren } from './visitChildren'

export function findCallExpressions(root: Node, calleeName: string): Array<CallExpression> {
    const isTargetCallExpression = (node: Node): node is CallExpression => {
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

    const foundExpressions: Array<CallExpression> = []
    const search = (node: Node) => {
        if (isTargetCallExpression(node)) {
            foundExpressions.push(node)
        }

        visitChildren(node, search)
    }

    search(root)
    return foundExpressions
}
