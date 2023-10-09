# Quasar Unused Plugin

This document only contains breaking changes

## 0.3.0

* Run plugin functionality in single pass

* Enable `__QUASAR_SSR__` whenever `enableSsr` option is set to `true`

## 0.2.0

* Require `quasar >= 2.9 && < 3` due to `quasar` changing its source file locations

* No longer required to change imports to `quasar/src/index.all` - this plugin will automatically rewrite `import ... from 'quasar'` to `import ... from 'quasar/src/index.prod.js'`
