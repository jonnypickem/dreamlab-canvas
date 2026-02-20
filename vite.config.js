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
        // OG metadata endpoint (mirrors api/og.js serverless function)
        if (req.url?.startsWith('/api/og')) {
          const parsedUrl = new URL(req.url, 'http://localhost')
          const targetUrl = parsedUrl.searchParams.get('url')

          if (!targetUrl) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Missing url parameter' }))
            return
          }

          try {
            // For tweet URLs, use fxtwitter.com to get actual media OG tags
            let fetchUrl = targetUrl
            let isFxTwitter = false
            try {
              const p = new URL(targetUrl)
              const h = p.hostname.toLowerCase().replace(/^www\./, '')
              if ((h === 'x.com' || h === 'twitter.com') && /\/status\/\d+/i.test(p.pathname)) {
                p.hostname = 'fxtwitter.com'
                fetchUrl = p.href
                isFxTwitter = true
              }
            } catch {}

            const response = await fetch(fetchUrl, {
              headers: {
                'User-Agent': isFxTwitter
                  ? 'Dreamlab/1.0 (compatible; bot)'
                  : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
              },
              redirect: isFxTwitter ? 'manual' : 'follow',
              signal: AbortSignal.timeout(8000),
            })

            if (!response.ok && !(isFxTwitter && response.status >= 300 && response.status < 400)) {
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ title: null, image: null, description: null }))
              return
            }

            const html = await response.text()

            const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const getMetaMatches = (key) => {
              if (!key) return []
              const regex = new RegExp(
                `<meta[^>]*\\b(?:property|name|itemprop)=["']${escapeRegex(key)}["'][^>]*\\bcontent=["']([^"']+)["'][^>]*>|<meta[^>]*\\bcontent=["']([^"']+)["'][^>]*\\b(?:property|name|itemprop)=["']${escapeRegex(key)}["'][^>]*>`,
                'gi'
              )
              const values = []
              let match
              while ((match = regex.exec(html)) !== null) {
                const value = String(match[1] || match[2] || '').trim()
                if (value) values.push(value)
              }
              return values
            }
            const getFirstMetaMatch = (keys = []) => {
              for (const key of keys) {
                const values = getMetaMatches(key)
                if (values.length > 0) return values[0]
              }
              return null
            }
            const isLikelyTweetAvatarImage = (value) => {
              const normalized = String(value || '').trim().toLowerCase()
              if (!normalized) return false
              return (
                normalized.includes('/profile_images/')
                || normalized.includes('/profile_banners/')
                || normalized.includes('default_profile')
                || normalized.includes('abs.twimg.com')
                || normalized.includes('twitter_card')
              )
            }
            const toAbsoluteUrl = (candidate) => {
              const value = String(candidate || '').trim()
              if (!value) return null
              try {
                return new URL(value, targetUrl).href
              } catch {
                return null
              }
            }
            const scoreMetadataImageCandidate = (value) => {
              const normalized = String(value || '').toLowerCase()
              if (!normalized) return -1
              let score = 0
              if (normalized.startsWith('https://')) score += 20
              if (normalized.includes('pbs.twimg.com/media')) score += 3600
              if (normalized.includes('ext_tw_video_thumb')) score += 3200
              if (normalized.includes('amplify_video_thumb')) score += 3000
              if (normalized.includes('tweet_video_thumb')) score += 2800
              if (normalized.includes('/card_img/')) score += 1500
              if (normalized.includes('twimg.com')) score += 800
              if (isLikelyTweetAvatarImage(normalized)) score -= 5000
              if (isFxTwitter && normalized.includes('x.com')) score -= 800
              return score
            }

            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
            const title = getFirstMetaMatch(['og:title', 'twitter:title', 'title']) || (titleMatch ? titleMatch[1] : null)
            const description = getFirstMetaMatch(['og:description', 'twitter:description', 'description'])
            const imageCandidates = [
              ...getMetaMatches('og:image:secure_url'),
              ...getMetaMatches('og:image:url'),
              ...getMetaMatches('og:image'),
              ...getMetaMatches('twitter:image:src'),
              ...getMetaMatches('twitter:image'),
              ...getMetaMatches('image'),
            ]
              .map((candidate) => toAbsoluteUrl(candidate))
              .filter(Boolean)
            const uniqueCandidates = Array.from(new Set(imageCandidates))
            uniqueCandidates.sort((left, right) => (
              scoreMetadataImageCandidate(right) - scoreMetadataImageCandidate(left)
            ))
            const bestImage = uniqueCandidates[0] || null
            const image = isLikelyTweetAvatarImage(bestImage) ? null : bestImage

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              title: title || null,
              image: image || null,
              description: description || null,
            }))
          } catch {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ title: null, image: null, description: null }))
          }
          return
        }

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
