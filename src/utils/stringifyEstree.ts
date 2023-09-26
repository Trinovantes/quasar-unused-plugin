import { isEstreeNode } from './isEstreeNode'
import { Node } from 'estree'

export function stringifyEstree(root: Node): string {
    let str = ''

    const stringify = (node: Node, depth = 0) => {
        str += ' '.repeat(depth * 2)
        str += node.type

        for (const [key, value] of Object.entries(node)) {
            if (value === null || value === undefined) {
                continue
            }

            if (hiddenNodeKeys.includes(key)) {
                continue
            }

            if (typeof value === 'object') {
                continue
            }

            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            str += ` ${key}:${value}`
        }

        str += '\n'

        // Print current node's children nodes
        for (const [key, value] of Object.entries(node)) {
            if (value === null || value === undefined) {
                continue
            }

            if (hiddenNodeKeys.includes(key)) {
                continue
            }

            if (typeof value !== 'object') {
                continue
            }

            if (Array.isArray(value)) {
                const childNodes: Array<Node> = []

                for (const el of value) {
                    if (isEstreeNode(el)) {
                        childNodes.push(el)
                    }
                }

                if (childNodes.length === 0) {
                    continue
                }

                str += `${' '.repeat((depth + 1) * 2)}(${String(key)})\n`
                for (const child of childNodes) {
                    stringify(child, depth + 2)
                }
            } else if (isEstreeNode(value)) {
                str += `${' '.repeat((depth + 1) * 2)}(${String(key)})\n`
                stringify(value, depth + 2)
            }
        }
    }

    stringify(root)
    return str
}

const hiddenNodeKeys = [
    'loc',
    'range',
    'leadingComments',
    'trailingComments',
    'type',

    'start',
    'end',
    'value',
]
