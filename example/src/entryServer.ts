import assert from 'node:assert'
import http from 'node:http'
import path from 'node:path'
import { renderToString } from '@vue/server-renderer'
import express from 'express'
import { VueSsrAssetRenderer } from 'vue-ssr-assets-plugin/dist/utils/VueSsrAssetsRenderer'
import { createVueApp } from './createVueApp'
import { AppContext } from './AppContext'

// -----------------------------------------------------------------------------
// Express
// -----------------------------------------------------------------------------

const app = express()

// -----------------------------------------------------------------------------
// Static Handlers
// Serves webpack generated assets (js/css/img)
// -----------------------------------------------------------------------------

assert(DEFINE.CLIENT_DIST_DIR)
assert(DEFINE.PUBLIC_PATH)
console.info(`Serving ${DEFINE.PUBLIC_PATH} from ${DEFINE.CLIENT_DIST_DIR}`)

app.use('/favicon.ico', express.static(path.join(DEFINE.CLIENT_DIST_DIR, 'favicon.ico')))
app.use(DEFINE.PUBLIC_PATH, express.static(DEFINE.CLIENT_DIST_DIR))

// -----------------------------------------------------------------------------
// Vue Handler
// -----------------------------------------------------------------------------

function createAsyncHandler(handler: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>): express.RequestHandler {
    return (req, res, next) => {
        handler(req, res, next).catch((err: unknown) => {
            next(err)
        })
    }
}

function createVueHandler() {
    assert(DEFINE.MANIFEST_FILE)
    const assetRenderer = new VueSsrAssetRenderer(DEFINE.MANIFEST_FILE)

    return createAsyncHandler(async(req, res) => {
        const targetUrl = req.originalUrl
        const appContext: AppContext = {
            url: targetUrl,
            teleports: {},
            _matchedComponents: new Set<string>(),

            req,
            res,
            _modules: new Set(),
            _meta: {},
        }

        const { app, router } = await createVueApp(appContext)
        if (router.currentRoute.value.fullPath !== targetUrl) {
            res.redirect(router.currentRoute.value.fullPath)
            return
        }

        // Render the app on the server
        const appHtml = await renderToString(app, appContext)
        const { header, footer } = assetRenderer.renderAssets(appContext._matchedComponents)

        console.info(targetUrl)
        console.info('manifest', assetRenderer.manifest)
        console.info('matchedComponents', appContext._matchedComponents)

        res.setHeader('Content-Type', 'text/html')
        res.status(200)
        res.send(`
            <!DOCTYPE html>
            <html ${appContext._meta.htmlAttrs ?? ''}>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link rel="icon" type="image/x-icon" href="/favicon.ico">
                <link href="https://fonts.googleapis.com/css2?family=Material+Icons" rel="stylesheet">
                ${header}
                ${appContext.teleports?.head ?? ''}
            </head>
            <body ${appContext._meta.bodyAttrs ?? ''} class="${appContext._meta.bodyClasses ?? ''}">
                <div id="app">${appHtml}</div>
                ${footer}
            </body>
            </html>
        `)
    })
}

app.use('*', createVueHandler())

// -----------------------------------------------------------------------------
// HTTP Server
// -----------------------------------------------------------------------------

function runHttpServer() {
    const port = '8080'
    const server = http.createServer(app)

    console.info('Starting HTTP Web Server', `http://localhost:${port}`)

    server.listen(port, () => {
        console.info('Server Listening', port)
    })
}

runHttpServer()
