# Quasar Unused Plugin

This is a Webpack 5 plugin for tree shaking unused Quasar components from generated bundles. If you are using Quasar as a standalone UI library with Webpack, then you will be importing from `node_modules/quasar/dist/quasar.esm.prod.js`. However, Webpack cannot tree shake unused components from this file because this file contains circular references. We can instead import the source code from `quasar/src/index.all` and use this plugin to break the dependency chain.

```ts
import { QuasarUnusedPlugin } from 'quasar-unused-plugin'

export default {
    plugins: [
        new QuasarUnusedPlugin(),
    ],
}
```

Update your imports from `quasar` to `quasar/src/index.all`

```ts
import { createApp } from 'vue'
import { Quasar } from 'quasar/src/index.all'

const app = createApp(App)
app.use(Quasar, {})
```

If you are using TypeScript, you need to create a definition file (e.g. `quasar.d.ts`) for `quasar/src/index.all`

```ts
declare module 'quasar/src/index.all' {
    export * from 'quasar'
}
```
