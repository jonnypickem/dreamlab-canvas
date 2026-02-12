import express from 'express';
import cors from 'cors';
import { enqueueStageAAnalysis, getStageAQueueSnapshot, getStageAResult } from './stageAQueueRuntime.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for the frontend
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    methods: ['GET', 'POST', 'OPTIONS']
}));
app.use(express.json({ limit: '25mb' }));

/**
 * Proxy endpoint for fetching external images
 * Usage: GET /api/proxy?url=https://example.com/image.png
 */
app.get('/api/proxy', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        // Validate URL format
        const targetUrl = new URL(url);

        // Only allow http/https protocols
        if (!['http:', 'https:'].includes(targetUrl.protocol)) {
            return res.status(400).json({ error: 'Invalid protocol' });
        }

        // Fetch the image
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Dreamlab-Canvas/1.0',
                'Accept': 'image/*,*/*'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Failed to fetch: ${response.statusText}`
            });
        }

        // Get content type and forward it
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);

        // Get content disposition for filename hint
        const contentDisposition = response.headers.get('content-disposition');
        if (contentDisposition) {
            res.setHeader('Content-Disposition', contentDisposition);
        }

        // Stream the response
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));

    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).json({ error: 'Failed to fetch resource' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/api/stagea/enqueue', async (req, res) => {
    try {
        const payload = req.body || {};
        const items = Array.isArray(payload?.items)
            ? payload.items
            : (payload?.item ? [payload.item] : []);
        const result = await enqueueStageAAnalysis(items);
        res.json(result);
    } catch (error) {
        console.error('Stage A enqueue error:', error?.message || error);
        res.status(500).json({ error: error?.message || 'Failed to enqueue Stage A analysis.' });
    }
});

app.get('/api/stagea/status', (req, res) => {
    res.json(getStageAQueueSnapshot());
});

app.get('/api/stagea/result', (req, res) => {
    const itemId = req.query?.itemId;
    const result = getStageAResult(itemId);
    if (!result) {
        res.status(404).json({ error: 'Result not found for itemId.' });
        return;
    }
    res.json(result);
});

app.listen(PORT, () => {
    console.log(`🖼️  Image proxy server running on http://localhost:${PORT}`);
});
