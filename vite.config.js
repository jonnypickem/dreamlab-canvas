import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { enqueueStageAAnalysis, getStageAQueueSnapshot, getStageAResult } from './server/stageAQueueRuntime.js'

/**
 * Vite plugin that embeds the image proxy server directly into Vite's dev server.
 * This handles /api/proxy requests to bypass CORS when downloading external images.
 */
function imageProxyPlugin() {
  const readJsonBody = async (req) => {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    if (chunks.length === 0) return {}
    const raw = Buffer.concat(chunks).toString('utf8')
    if (!raw.trim()) return {}
    return JSON.parse(raw)
  }

  return {
    name: 'image-proxy',
    configureServer(server) {
      // Register middleware before Vite's internal middleware
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/stagea')) {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

          if (req.method === 'OPTIONS') {
            res.statusCode = 204
            res.end()
            return
          }

          const parsedUrl = new URL(req.url, 'http://localhost')

          if (req.method === 'POST' && parsedUrl.pathname === '/api/stagea/enqueue') {
            try {
              const payload = await readJsonBody(req)
              const items = Array.isArray(payload?.items)
                ? payload.items
                : (payload?.item ? [payload.item] : [])
              const result = await enqueueStageAAnalysis(items)
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(result))
              return
            } catch (error) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: error?.message || 'Failed to enqueue Stage A analysis.' }))
              return
            }
          }

          if (req.method === 'GET' && parsedUrl.pathname === '/api/stagea/status') {
            const snapshot = getStageAQueueSnapshot()
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(snapshot))
            return
          }

          if (req.method === 'GET' && parsedUrl.pathname === '/api/stagea/result') {
            const itemId = parsedUrl.searchParams.get('itemId')
            const result = getStageAResult(itemId)
            if (!result) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Result not found for itemId.' }))
              return
            }
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result))
            return
          }

          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Unknown Stage A endpoint.' }))
          return
        }

        // Only handle /api/proxy requests
        if (!req.url?.startsWith('/api/proxy')) {
          return next()
        }

        // Parse the URL parameter
        const urlParams = new URL(req.url, 'http://localhost').searchParams
        const targetUrl = urlParams.get('url')

        if (!targetUrl) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Missing url parameter' }))
          return
        }

        try {
          // Validate URL format
          const parsedUrl = new URL(targetUrl)

          // Only allow http/https protocols
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Invalid protocol' }))
            return
          }

          // Fetch the external image
          const response = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Dreamlab-Canvas/1.0',
              'Accept': 'image/*,*/*'
            }
          })

          if (!response.ok) {
            res.statusCode = response.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: `Failed to fetch: ${response.statusText}` }))
            return
          }

          // Forward content type
          const contentType = response.headers.get('content-type') || 'application/octet-stream'
          res.setHeader('Content-Type', contentType)

          // Forward content disposition if present
          const contentDisposition = response.headers.get('content-disposition')
          if (contentDisposition) {
            res.setHeader('Content-Disposition', contentDisposition)
          }

          // Enable CORS
          res.setHeader('Access-Control-Allow-Origin', '*')

          // Stream the response as buffer
          const buffer = await response.arrayBuffer()
          res.end(Buffer.from(buffer))

        } catch (error) {
          console.error('🖼️ Proxy error:', error.message)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Failed to fetch resource' }))
        }
      })

      // Health check endpoint
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/health') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }))
          return
        }
        next()
      })

      console.log('🖼️  Image proxy embedded in Vite dev server')
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    imageProxyPlugin()
  ],
  server: {
    port: 5173,
    strictPort: false, // Allow fallback to another port if 5173 is busy
  },
})
