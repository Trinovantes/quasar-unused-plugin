import { Node } from 'estree'

export function isEstreeNode(value: unknown): value is Node {
    if (value === null || value === undefined) {
        return false
    }

    if (typeof value !== 'object') {
        return false
    }

    if (!('type' in value)) {
        return false
    }

    return true
}
