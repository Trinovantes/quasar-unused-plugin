import type { SSRContext } from '@vue/server-renderer'
import type express from 'express'

interface QuasarSsrContext {
    req: express.Request
    res: express.Response
    _modules: Set<unknown>
    _meta: Partial<{
        htmlAttrs: string
        headTags: string
        endingHeadTags: string
        bodyClasses: string
        bodyAttrs: string
        bodyTags: string
    }>
}

export type AppContext = SSRContext & QuasarSsrContext & {
    url: string
    _matchedComponents: Set<string>
}
