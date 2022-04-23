import type { Node } from 'estree'
import { isEstreeNode } from './isEstreeNode'

export function visitChildren<T>(node: Node, visitNode: (node: Node) => T | undefined): T | undefined {
    for (const value of Object.values(node)) {
        if (typeof value !== 'object') {
            continue
        }

        if (Array.isArray(value)) {
            for (const el of value) {
                if (!isEstreeNode(el)) {
                    continue
                }

                const res = visitNode(el)
                if (res !== undefined) {
                    return res
                }
            }
        } else if (isEstreeNode(value)) {
            const res = visitNode(value)
            if (res !== undefined) {
                return res
            }
        }
    }

    return undefined
}
