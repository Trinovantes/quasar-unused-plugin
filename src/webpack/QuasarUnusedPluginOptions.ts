import Ajv from 'ajv'
import { QUASAR_SIDE_EFFECTS } from '../Constants'

export type QuasarUnusedPluginOptions = {
    sideEffectsOverride?: boolean | Array<string>
    enableSsr?: boolean
    enablePwa?: boolean
}

const ajv = new Ajv({ useDefaults: true })
const validator = ajv.compile({
    type: 'object',
    properties: {
        sideEffectsOverride: {
            oneOf: [
                {
                    type: 'boolean',
                },
                {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
            ],
            default: QUASAR_SIDE_EFFECTS,
        },
        enableSsr: {
            type: 'boolean',
            default: false,
        },
        enablePwa: {
            type: 'boolean',
            default: false,
        },
    },
})

export function validateQuasarUnusedPluginOptions(options: unknown): options is Required<QuasarUnusedPluginOptions> {
    const isValid = validator(options)
    if (!isValid) {
        console.warn('Invalid QuasarUnusedPluginOptions', validator.errors)
        throw new Error('Invalid QuasarUnusedPluginOptions')
    }

    return isValid
}
