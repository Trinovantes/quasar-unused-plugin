import type { Node } from 'estree'

type NodeKeysWithChild<T, E> = keyof { [K in keyof T as (T[K] extends E | null | undefined ? K : never)]: unknown } & keyof T
type NodeKeysWithChildren<T, E> = keyof { [K in keyof T as (T[K] extends Array<E | null | undefined> ? K : never)]: unknown } & keyof T

export function dumpEstree(node?: Node | null, depth = 0, prefix = ''): string {
    if (!node) {
        return ''
    }

    let s = ''

    const dump = <N extends Node, K extends NodeKeysWithChild<N, string | number | boolean>>(node: N, props: Array<K> = [], extras = '') => {
        s += '  '.repeat(depth)

        if (prefix) {
            s += `(${prefix})`
            s += ' '
        }

        s += node.type

        for (const prop of props) {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            s += ` ${prop}:${node[prop]}`
        }

        if (extras) {
            s += ' '
            s += extras
        }

        s += '\n'
    }

    const dumpDeep = <N extends Node, K extends NodeKeysWithChild<N, Node>>(node: N, props: Array<K> = []) => {
        for (const prop of props) {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            s += dumpEstree(node[prop] as unknown as Node, depth + 1, String(prop))
        }
    }

    const dumpDeepChildren = <N extends Node, K extends NodeKeysWithChildren<N, Node>>(node: N, props: Array<K> = []) => {
        for (const prop of props) {
            for (const child of node[prop] as unknown as Array<Node>) {
                s += dumpEstree(child, depth + 1, String(prop))
            }
        }
    }

    switch (node.type) {
        case 'Program': {
            dump(node, ['sourceType'])
            dumpDeepChildren(node, ['body'])
            break
        }

        case 'ClassDeclaration': {
            dump(node)
            dumpDeep(node, ['id'])
            break
        }

        case 'ClassExpression': {
            dump(node)
            dumpDeep(node, ['id', 'superClass', 'body'])
            break
        }

        case 'ClassBody':
        case 'BlockStatement': {
            dump(node)
            dumpDeepChildren(node, ['body'])
            break
        }

        case 'Identifier':
        case 'PrivateIdentifier': {
            dump(node, ['name'])
            break
        }

        case 'Literal': {
            dump(node, ['raw'])
            break
        }

        case 'SwitchCase': {
            dump(node)
            dumpDeep(node, ['test'])
            dumpDeepChildren(node, ['consequent'])
            break
        }

        case 'VariableDeclarator': {
            dump(node)
            dumpDeep(node, ['id', 'init'])
            break
        }

        case 'Property': {
            dump(node, ['kind'])
            dumpDeep(node, ['key', 'value'])
            break
        }

        case 'PropertyDefinition': {
            dump(node)
            dumpDeep(node, ['key', 'value'])
            break
        }

        case 'TemplateElement': {
            dump(node, [], node.value.cooked?.replace(/\n/g, '\\n'))
            break
        }

        case 'SpreadElement': {
            dump(node)
            dumpDeep(node, ['argument'])
            break
        }

        case 'MethodDefinition': {
            dump(node, ['kind', 'computed', 'static'])
            dumpDeep(node, ['key', 'value'])
            break
        }

        case 'ExpressionStatement': {
            dump(node)
            dumpDeep(node, ['expression'])
            break
        }

        case 'ArrowFunctionExpression':
        case 'FunctionDeclaration':
        case 'FunctionExpression': {
            dump(node, ['generator', 'async'])
            dumpDeep(node, ['body'])
            break
        }

        case 'VariableDeclaration': {
            dump(node, ['kind'])
            dumpDeepChildren(node, ['declarations'])
            break
        }

        case 'ImportExpression': {
            dump(node)
            dumpDeep(node, ['source'])
            break
        }

        case 'ImportDeclaration': {
            dump(node)
            dumpDeep(node, ['source'])
            dumpDeepChildren(node, ['specifiers'])
            break
        }

        case 'ImportSpecifier': {
            dump(node)
            dumpDeep(node, ['local', 'imported'])
            break
        }

        case 'ImportDefaultSpecifier': {
            dump(node)
            dumpDeep(node, ['local'])
            break
        }

        case 'ImportNamespaceSpecifier': {
            dump(node)
            dumpDeep(node, ['local'])
            break
        }

        case 'ExportNamedDeclaration': {
            dump(node)
            dumpDeep(node, ['declaration', 'source'])
            dumpDeepChildren(node, ['specifiers'])
            break
        }

        case 'ExportSpecifier': {
            dump(node)
            dumpDeep(node, ['local'])
            break
        }

        case 'ExportAllDeclaration': {
            dump(node)
            dumpDeep(node, ['exported', 'source'])
            break
        }

        case 'ExportDefaultDeclaration': {
            dump(node)
            dumpDeep(node, ['declaration'])
            break
        }

        case 'CallExpression': {
            dump(node, ['optional'])
            dumpDeep(node, ['callee'])
            dumpDeepChildren(node, ['arguments'])
            break
        }

        case 'NewExpression': {
            dump(node)
            break
        }

        case 'ObjectExpression':
        case 'ObjectPattern': {
            dump(node)
            dumpDeepChildren(node, ['properties'])
            break
        }

        case 'MemberExpression': {
            dump(node, ['computed', 'optional'])
            dumpDeep(node, ['object', 'property'])
            break
        }

        case 'ReturnStatement': {
            dump(node)
            dumpDeep(node, ['argument'])
            break
        }

        case 'AwaitExpression': {
            dump(node)
            dumpDeep(node, ['argument'])
            break
        }

        case 'LogicalExpression':
        case 'BinaryExpression':
        case 'AssignmentExpression': {
            dump(node, ['operator'])
            dumpDeep(node, ['left', 'right'])
            break
        }

        case 'AssignmentPattern': {
            dump(node)
            dumpDeep(node, ['left', 'right'])
            break
        }

        case 'UnaryExpression': {
            dump(node, ['operator'])
            dumpDeep(node, ['argument'])
            break
        }

        case 'RestElement': {
            dump(node)
            dumpDeep(node, ['argument'])
            break
        }

        case 'UpdateExpression': {
            dump(node, ['operator'])
            dumpDeep(node, ['argument'])
            break
        }

        case 'IfStatement':
        case 'ConditionalExpression': {
            dump(node)
            dumpDeep(node, ['test', 'consequent', 'alternate'])
            break
        }

        case 'ForInStatement':
        case 'ForOfStatement': {
            dump(node)
            dumpDeep(node, ['left', 'right', 'body'])
            break
        }

        case 'WhileStatement': {
            dump(node)
            dumpDeep(node, ['test', 'body'])
            break
        }

        case 'ForStatement': {
            dump(node)
            dumpDeep(node, ['init', 'test', 'update', 'update', 'body'])
            break
        }

        case 'DoWhileStatement': {
            dump(node)
            dumpDeep(node, ['body', 'test'])
            break
        }

        case 'BreakStatement':
        case 'ContinueStatement': {
            dump(node)
            dumpDeep(node, ['label'])
            break
        }

        case 'SequenceExpression': {
            dump(node)
            dumpDeepChildren(node, ['expressions'])
            break
        }

        case 'ThrowStatement': {
            dump(node)
            dumpDeep(node, ['argument'])
            break
        }

        case 'TryStatement': {
            dump(node)
            dumpDeep(node, ['block', 'handler', 'finalizer'])
            break
        }

        case 'CatchClause': {
            dump(node)
            dumpDeep(node, ['param', 'body'])
            break
        }

        case 'ArrayExpression':
        case 'ArrayPattern': {
            dump(node)
            dumpDeepChildren(node, ['elements'])
            break
        }

        case 'SwitchStatement': {
            dump(node)
            dumpDeep(node, ['discriminant'])
            dumpDeepChildren(node, ['cases'])
            break
        }

        case 'TemplateLiteral': {
            dump(node)
            dumpDeepChildren(node, ['quasis', 'expressions'])
            break
        }

        case 'ThisExpression': {
            dump(node)
            break
        }

        case 'ChainExpression': {
            dump(node)
            dumpDeep(node, ['expression'])
            break
        }

        case 'EmptyStatement': {
            dump(node)
            break
        }

        default: {
            throw new Error(`Unknown estree.Node.type:${node.type}`)
        }
    }

    return s
}
