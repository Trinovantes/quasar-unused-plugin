import { createSSRApp } from 'vue'
import App from './components/App.vue'
import { createAppRouter } from './router'
import type { createRouter } from 'vue-router'
import type { SSRContext } from '@vue/server-renderer'
import { useSSRContext } from '@vue/runtime-core'
import type express from 'express'
import { Quasar } from 'quasar/src/index.all'

interface CreatedApp {
    app: ReturnType<typeof createSSRApp>
    router: ReturnType<typeof createRouter>
}

export type AppContext = SSRContext & {
    url: string
    teleports: Record<string, string>
    _matchedComponents: Set<string>

    // Required by Quasar
    req: express.Request
    res: express.Response
    _modules: Set<unknown>
    _meta: Record<string, unknown>
}

export function useAppContext(): AppContext | undefined {
    return useSSRContext()
}

export async function createApp(ssrContext?: AppContext): Promise<CreatedApp> {
    // Vue
    const app = createSSRApp(App)

    // Vue Router
    const router = await createAppRouter(ssrContext)
    app.use(router)
    await router.isReady()

    // Quasar
    app.use(Quasar, {}, ssrContext)

    return {
        app,
        router,
    }
}
