# Quasar Unused Plugin

This is a Webpack 5 plugin for tree shaking unused Quasar components from generated bundles. If you are using Quasar as a standalone UI library with Webpack, then you will be importing from `node_modules/quasar/dist/quasar.esm.prod.js`. However, Webpack cannot tree shake unused components from this file because this file contains circular references. We can instead import the source code from `quasar/src/index.prod.js` and use this plugin to break the dependency chain.

## Example Savings (in `./examples` dir)

|      | Bundle Size | Gzipped Size |
|---   |---|---|
|Before| 559.07 KB | 171.02 KB |
|After | 184.23 KB |  62.75 KB |

## Usage

```ts
import { QuasarUnusedPlugin } from 'quasar-unused-plugin'

export default {
    plugins: [
        new QuasarUnusedPlugin(),
    ],
}
```

If you are externalizing node modules, you need to allowlist `quasar` so that Webpack can process this package.

```ts
import nodeExternals from 'webpack-node-externals'

export default {
    externals: [
        nodeExternals({
            allowlist: [
                /^quasar*/,
            ],
        }),
    ],
}
```
