import { Dependency, sources, Generator } from 'webpack'
import { PLUGIN_NAME } from '../Constants'
import { Expression } from 'estree'

type DependencyTemplate = Exclude<ReturnType<Parameters<Generator['generate']>[1]['dependencyTemplates']['get']>, undefined>

export class ReplaceValueDependency extends Dependency {
    #exprNode: Expression
    #replacement: string

    constructor(exprNode: Expression, replacement: string) {
        super()
        this.#exprNode = exprNode
        this.#replacement = replacement
    }

    static Template = class implements DependencyTemplate {
        apply(dependency: ReplaceValueDependency, source: sources.ReplaceSource): void {
            if (!dependency.#exprNode.range) {
                return
            }

            const start = dependency.#exprNode.range[0]
            const end = dependency.#exprNode.range[1] - 1
            source.replace(start, end, dependency.#replacement, PLUGIN_NAME)
        }
    }
}
