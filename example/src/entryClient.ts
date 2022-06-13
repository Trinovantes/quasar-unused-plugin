import 'quasar/dist/quasar.prod.css'
import { createVueApp } from './createVueApp'

async function main() {
    const { app } = await createVueApp()
    app.mount('#app')
}

main().catch((err) => {
    console.warn(err)
})
