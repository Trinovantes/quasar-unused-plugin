import { QUASAR_SIDE_EFFECTS } from '../src/Constants'
import { QuasarUnusedPluginOptions, validateQuasarUnusedPluginOptions } from '../src/webpack/QuasarUnusedPluginOptions'

describe('QuasarUnusedPluginOptions', () => {
    test('no options', () => {
        const options: QuasarUnusedPluginOptions = {}

        expect(validateQuasarUnusedPluginOptions(options)).toBe(true)
        expect(options.sideEffectsOverride).toStrictEqual(QUASAR_SIDE_EFFECTS)
    })

    test('Array<string> sideEffects', () => {
        const options = {
            sideEffectsOverride: ['test'],
        }

        expect(validateQuasarUnusedPluginOptions(options)).toBe(true)
    })

    test('string sideEffects should throw', () => {
        const options = {
            sideEffectsOverride: 'test',
        }

        expect(() => validateQuasarUnusedPluginOptions(options)).toThrow()
    })

    test('Array<any> sideEffects should throw', () => {
        const options = {
            sideEffectsOverride: [
                'test',
                false,
            ],
        }

        expect(() => validateQuasarUnusedPluginOptions(options)).toThrow()
    })

    const keys: Array<keyof QuasarUnusedPluginOptions> = [
        'sideEffectsOverride',
        'enablePwa',
        'enableSsr',
    ]

    for (const key of keys) {
        for (const truth of [true, false]) {
            test(`${key}:${truth}`, () => {
                const options = {
                    [key]: truth,
                }

                expect(validateQuasarUnusedPluginOptions(options)).toBe(true)
            })
        }
    }
})
