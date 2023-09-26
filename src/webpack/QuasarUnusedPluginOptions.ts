import { Type, Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

const tbQuasarUnusedPluginOptions = Type.Object({
    sideEffectsOverride: Type.Optional(Type.Union([
        Type.Boolean(),
        Type.Array(Type.String()),
    ])),
    enableSsr: Type.Optional(Type.Boolean()),
    enablePwa: Type.Optional(Type.Boolean()),
}, {
    additionalProperties: false,
})

export type QuasarUnusedPluginOptions = Static<typeof tbQuasarUnusedPluginOptions>

export function validateQuasarUnusedPluginOptions(options: unknown): options is QuasarUnusedPluginOptions {
    if (!Value.Check(tbQuasarUnusedPluginOptions, options)) {
        throw new Error('Invalid QuasarUnusedPluginOptions')
    }

    return true
}
