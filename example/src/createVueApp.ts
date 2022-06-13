import { Quasar } from 'quasar/src/index.all'
import { createSSRApp } from 'vue'
import App from './components/App.vue'
import { createAppRouter } from './router'
import type { AppContext } from './AppContext'
import type { createRouter } from 'vue-router'

interface CreatedApp {
    app: ReturnType<typeof createSSRApp>
    router: ReturnType<typeof createRouter>
}

export async function createVueApp(ssrContext?: AppContext): Promise<CreatedApp> {
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
