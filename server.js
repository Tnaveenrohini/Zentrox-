/* ═══════════════════════════════════════════════════════════
   Zentrox — Express.js Backend Server v2.0
   Instagram Video Downloader API

   Primary:  instagram-reels-downloader-api (RapidAPI)
   Fallback: Page scraping via axios

   Endpoints:
     POST /download         — Extract Instagram video/reel download URL
     GET  /proxy-download   — Proxy video download (handles CORS + forces save)
     GET  /health           — Server health check
═══════════════════════════════════════════════════════════ */

'use strict';

const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ─── RapidAPI credentials ─── */
const RAPIDAPI_KEY  = process.env.RAPIDAPI_KEY  || 'e1a114cc67msh944af74a26bd9edp1735d9jsn28ed5df7737f';
const RAPIDAPI_HOST = 'instagram-reels-downloader-api.p.rapidapi.com';
const RAPIDAPI_URL  = 'https://instagram-reels-downloader-api.p.rapidapi.com/download';

/* ═══════════════════════════════════════════════════════════
   MIDDLEWARE
═══════════════════════════════════════════════════════════ */
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function isValidInstagramURL(url) {
  try {
    const u    = new URL(url.trim());
    const host = u.hostname.replace('www.', '');
    return host === 'instagram.com' && /^\/(reel|p|tv)\//i.test(u.pathname);
  } catch { return false; }
}

function normaliseURL(url) {
  try {
    const u = new URL(url.trim());
    let clean = `${u.origin}${u.pathname}`;
    if (!clean.endsWith('/')) clean += '/';
    return clean;
  } catch { return url.trim(); }
}

/* ═══════════════════════════════════════════════════════════
   PRIMARY: RapidAPI — instagram-reels-downloader-api
═══════════════════════════════════════════════════════════ */
async function fetchViaRapidAPI(instagramUrl) {
  const apiRes = await axios.get(RAPIDAPI_URL, {
    params:  { url: instagramUrl },
    headers: {
      'Content-Type':    'application/json',
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key':  RAPIDAPI_KEY
    },
    timeout: 20000
  });

  const d = apiRes.data;
  console.log('[RapidAPI] response keys:', Object.keys(d || {}).join(', '));

  /* Shape A: { data: { download_url, ... } } */
  if (d?.data && (d.data.download_url || d.data.url)) {
    return {
      status:     true,
      download:   d.data.download_url || d.data.url,
      downloadSD: d.data.download_url_sd || null,
      thumbnail:  d.data.thumbnail_url  || d.data.thumbnail || '',
      quality:    'HD',
      title:      d.data.title    || 'Instagram Video',
      author:     d.data.author   || d.data.username || ''
    };
  }

  /* Shape B: { urls: [{ url, quality }], thumbnail } */
  if (d && Array.isArray(d.urls) && d.urls.length > 0) {
    const hd = d.urls.find(u => /hd/i.test(u.quality || '')) || d.urls[0];
    const sd = d.urls.find(u => /sd/i.test(u.quality || '')) || null;
    return {
      status:     true,
      download:   hd.url || hd.download_url,
      downloadSD: sd ? (sd.url || sd.download_url) : null,
      thumbnail:  d.thumbnail || d.thumbnail_url || '',
      quality:    'HD',
      title:      d.title  || 'Instagram Video',
      author:     d.author || d.username || ''
    };
  }

  /* Shape C: flat { url / download_url / video_url } */
  if (d && (d.download_url || d.url || d.video_url)) {
    return {
      status:     true,
      download:   d.download_url || d.url || d.video_url,
      downloadSD: d.download_url_sd || null,
      thumbnail:  d.thumbnail || d.thumbnail_url || '',
      quality:    'HD',
      title:      d.title   || 'Instagram Video',
      author:     d.author  || d.username || ''
    };
  }

  /* Shape D: { result: { ... } } */
  if (d?.result) {
    const r = d.result;
    return {
      status:     true,
      download:   r.download_url || r.url || r.video_url,
      downloadSD: r.download_url_sd || null,
      thumbnail:  r.thumbnail || r.thumbnail_url || '',
      quality:    'HD',
      title:      r.title  || 'Instagram Video',
      author:     r.author || r.username || ''
    };
  }

  /* Shape E: direct array */
  if (Array.isArray(d) && d.length > 0) {
    const hd = d.find(u => /hd/i.test(u.quality || '')) || d[0];
    return {
      status:     true,
      download:   hd.url || hd.download_url,
      downloadSD: null,
      thumbnail:  hd.thumbnail || '',
      quality:    'HD',
      title:      hd.title || 'Instagram Video',
      author:     hd.author || ''
    };
  }

  throw new Error('RapidAPI returned unrecognised response. Post may be private or deleted.');
}

/* ═══════════════════════════════════════════════════════════
   FALLBACK: Page scrape
═══════════════════════════════════════════════════════════ */
async function scrapeVideoUrl(url) {
  const res = await axios.get(url, {
    timeout: 18000,
    headers: {
      'User-Agent':      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control':   'no-cache',
      'Referer':         'https://www.instagram.com/'
    },
    maxRedirects: 5
  });

  const html = res.data;
  const patterns = [
    /"video_url":"(https:[^"]+\.mp4[^"]*)"/,
    /video_url\\?":"(https:[^"\\]+\.mp4[^"\\]*)"/,
    /"contentUrl":"(https:[^"]+\.mp4[^"]*)"/,
    /property="og:video"\s+content="([^"]+)"/,
    /og:video:url"\s+content="([^"]+)"/
  ];

  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return m[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/\\/g, '');
  }
  throw new Error('Video URL not found in page source. Post may require login.');
}

async function fetchOEmbedMeta(url) {
  try {
    const r = await axios.get(`https://www.instagram.com/oembed/?url=${encodeURIComponent(url)}&maxwidth=640`, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
    });
    return { title: r.data.title || 'Instagram Video', author: r.data.author_name || '', thumbnail: r.data.thumbnail_url || '' };
  } catch { return { title: 'Instagram Video', author: '', thumbnail: '' }; }
}

/* ═══════════════════════════════════════════════════════════
   ORCHESTRATOR
═══════════════════════════════════════════════════════════ */
async function fetchInstagramData(rawUrl) {
  const normUrl = normaliseURL(rawUrl);

  /* Method 1: RapidAPI */
  try {
    console.log(`[Method 1] RapidAPI → ${rawUrl}`);
    const result = await fetchViaRapidAPI(rawUrl);
    if (result?.download) return result;
  } catch (err) { console.warn(`[Method 1] failed: ${err.message}`); }

  /* Method 2: Scrape */
  try {
    console.log(`[Method 2] Scrape → ${normUrl}`);
    const [videoUrl, meta] = await Promise.all([ scrapeVideoUrl(normUrl), fetchOEmbedMeta(normUrl) ]);
    return { status: true, download: videoUrl, downloadSD: null, thumbnail: meta.thumbnail, quality: 'HD', title: meta.title, author: meta.author };
  } catch (err) { console.warn(`[Method 2] failed: ${err.message}`); }

  throw new Error('Unable to extract video. Ensure the post is public and your RapidAPI subscription is active.');
}

/* ═══════════════════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════════════════ */
app.get('/health', (_req, res) => res.json({ status: 'ok', app: 'Zentrox', version: '2.0.0', timestamp: new Date().toISOString() }));

app.post('/download', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') return res.status(400).json({ status: false, message: 'Missing "url" in request body.' });
  const rawUrl = url.trim();
  if (!isValidInstagramURL(rawUrl)) return res.status(400).json({ status: false, message: 'Invalid Instagram URL. Supported: /reel/, /p/, /tv/ links.' });

  console.log(`\n[/download] ▶ ${rawUrl}`);
  try {
    const data = await fetchInstagramData(rawUrl);
    console.log(`[/download] ✓ ${String(data.download).slice(0, 80)}...`);
    return res.json(data);
  } catch (err) {
    console.error(`[/download] ✗ ${err.message}`);
    return res.status(422).json({ status: false, message: err.message });
  }
});

app.get('/proxy-download', async (req, res) => {
  const { url, filename } = req.query;
  if (!url) return res.status(400).json({ status: false, message: 'Missing "url" parameter.' });

  const ALLOWED = ['cdninstagram.com', 'instagram.com', 'fbcdn.net', 'scontent'];
  let allowed = false;
  try { const p = new URL(url); allowed = ALLOWED.some(h => p.hostname.includes(h)); } catch {}
  if (!allowed) return res.status(403).json({ status: false, message: 'URL host not permitted.' });

  try {
    const upstream = await axios({ method: 'get', url, responseType: 'stream', timeout: 60000,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.instagram.com/', 'Origin': 'https://www.instagram.com' }
    });
    const safe = (filename || `zentrox_${Date.now()}.mp4`).replace(/[^a-zA-Z0-9._\-]/g, '_');
    res.setHeader('Content-Type', upstream.headers['content-type'] || 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
    res.setHeader('Cache-Control', 'no-cache');
    if (upstream.headers['content-length']) res.setHeader('Content-Length', upstream.headers['content-length']);
    upstream.data.pipe(res);
    upstream.data.on('error', err => { if (!res.headersSent) res.status(500).end(); console.error('[proxy]', err.message); });
  } catch (err) {
    if (!res.headersSent) res.status(502).json({ status: false, message: 'Upstream failed: ' + err.message });
  }
});

app.use((_req, res) => res.status(404).json({ status: false, message: 'Not found.' }));
app.use((err, _req, res, _next) => { console.error('[err]', err); res.status(500).json({ status: false, message: 'Internal error.' }); });

/* ═══════════════════════════════════════════════════════════
   START
═══════════════════════════════════════════════════════════ */
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║       ⚡ ZENTROX  Server  v2.0           ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  http://localhost:${PORT}                   ║`);
  console.log('║  POST /download       — extract video    ║');
  console.log('║  GET  /proxy-download — stream download  ║');
  console.log('║  GET  /health         — status check     ║');
  console.log('╚══════════════════════════════════════════╝\n');
});

module.exports = app;
