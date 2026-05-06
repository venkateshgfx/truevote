/**
 * SlideMeter — Backend Server
 * Pure Node.js (no npm packages). Serves static files + vote API.
 *
 *  POST /api/vote         — cast a vote (duplicate = 409)
 *  GET  /api/votes        — return all server-side votes
 *  POST /api/poll-status  — presenter opens/closes a poll
 *  POST /api/navigate     — presenter changes active slide
 *  POST /api/session      — register session code
 *  GET  /api/state        — current shared state snapshot
 *  GET  /api/events       — SSE stream for real-time updates
 */

const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const PORT       = process.env.PORT || 3000;
const STATIC_DIR = __dirname;

// ── Shared server-side state ────────────────────────────────────────────────
const serverState = {
  sessionCode:      null,
  activeSlideIndex: 0,
  slides:           [],    // synced from presenter
  votes:            {},    // { slideId: { userHash: { options, ts } } }
  pollStatus:       {},    // { slideId: 'pending'|'open'|'closed' }
  presSettings:     {},    // theme/branding settings from presenter
};

// ── SSE client registry ─────────────────────────────────────────────────────
const clients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => { try { res.write(msg); } catch { clients.delete(res); } });
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css' : 'text/css',
  '.js'  : 'application/javascript',
  '.json': 'application/json',
  '.png' : 'image/png',
  '.jpg' : 'image/jpeg',
  '.svg' : 'image/svg+xml',
  '.ico' : 'image/x-icon',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end',  () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(); } });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

// ── Request router ──────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url  = new URL(req.url, `http://localhost:${PORT}`);
  const path_ = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── POST /api/vote ─────────────────────────────────────────────────────
  if (path_ === '/api/vote' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: 'Bad JSON' }); }
    const { slideId, userHash, options, email, ldapId } = body;
    if (!slideId || !userHash || !Array.isArray(options))
      return json(res, 400, { error: 'Missing fields' });

    if (!serverState.votes[slideId]) serverState.votes[slideId] = {};

    if (serverState.votes[slideId][userHash])
      return json(res, 409, { success: false, reason: 'DUPLICATE_VOTE' });

    serverState.votes[slideId][userHash] = { options, ts: new Date().toISOString(), email, ldapId };
    broadcast('vote', { slideId, slideVotes: serverState.votes[slideId] });
    return json(res, 200, { success: true });
  }

  // ── GET /api/votes ─────────────────────────────────────────────────────
  if (path_ === '/api/votes' && req.method === 'GET')
    return json(res, 200, serverState.votes);

  // ── POST /api/poll-status ──────────────────────────────────────────────
  if (path_ === '/api/poll-status' && req.method === 'POST') {
    const { slideId, status } = await readBody(req).catch(() => ({}));
    if (slideId && status) {
      serverState.pollStatus[slideId] = status;
      broadcast('pollStatus', { slideId, status });
    }
    return json(res, 200, { ok: true });
  }

  // ── POST /api/navigate ─────────────────────────────────────────────────
  if (path_ === '/api/navigate' && req.method === 'POST') {
    const { activeSlideIndex } = await readBody(req).catch(() => ({}));
    if (typeof activeSlideIndex === 'number') {
      serverState.activeSlideIndex = activeSlideIndex;
      broadcast('navigate', { activeSlideIndex });
    }
    return json(res, 200, { ok: true });
  }

  // ── POST /api/slides ───────────────────────────────────────────────────
  if (path_ === '/api/slides' && req.method === 'POST') {
    const { slides } = await readBody(req).catch(() => ({}));
    if (Array.isArray(slides)) {
      serverState.slides = slides;
      broadcast('slides', { slides });
    }
    return json(res, 200, { ok: true });
  }

  // ── POST /api/session ──────────────────────────────────────────────────
  if (path_ === '/api/session' && req.method === 'POST') {
    const { sessionCode } = await readBody(req).catch(() => ({}));
    if (sessionCode) serverState.sessionCode = sessionCode;
    return json(res, 200, { ok: true });
  }

  // ── POST /api/presSettings ─────────────────────────────────────────────
  if (path_ === '/api/presSettings' && req.method === 'POST') {
    const { presSettings } = await readBody(req).catch(() => ({}));
    if (presSettings) {
      serverState.presSettings = presSettings;
      broadcast('presSettings', { presSettings });
    }
    return json(res, 200, { ok: true });
  }

  // ── GET /api/state ─────────────────────────────────────────────────────
  if (path_ === '/api/state' && req.method === 'GET')
    return json(res, 200, serverState);

  // ── GET /api/events (SSE) ──────────────────────────────────────────────
  if (path_ === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(`event: init\ndata: ${JSON.stringify(serverState)}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  // ── Favicon — return inline SVG so the browser tab doesn't spin ──────────
  if (path_ === '/favicon.ico' || path_ === '/favicon.svg') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#4f46e5"/>
      <rect x="6" y="18" width="4" height="8" rx="1" fill="white"/>
      <rect x="12" y="12" width="4" height="14" rx="1" fill="white"/>
      <rect x="18" y="8" width="4" height="18" rx="1" fill="white"/>
      <rect x="24" y="14" width="4" height="12" rx="1" fill="white"/>
    </svg>`;
    res.writeHead(200, {
      'Content-Type':  'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    });
    res.end(svg);
    return;
  }

  // ── Static file serving ────────────────────────────────────────────────
  let filePath = path.join(STATIC_DIR, path_ === '/' ? 'index.html' : path_);
  // SPA fallback — serve index.html for unknown paths (but NOT favicon)
  if (!fs.existsSync(filePath)) filePath = path.join(STATIC_DIR, 'index.html');

  const ext  = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  🗳  LivePoll Secure — Backend Server`);
  console.log(`  ✅  http://localhost:${PORT}`);
  console.log(`  📡  http://${getLocalIP()}:${PORT}  (LAN / mobile)`);
  console.log(`  🔒  Server-side duplicate vote prevention ACTIVE\n`);
});

function getLocalIP() {
  const { networkInterfaces } = require('os');
  for (const iface of Object.values(networkInterfaces())) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return 'localhost';
}
