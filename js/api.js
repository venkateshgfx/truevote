/**
 * LivePoll Secure — API Client
 * Communicates with server.js for vote storage and real-time sync.
 * Falls back gracefully to localStorage-only mode if server is unreachable.
 */
const API = (() => {
  let _serverAvailable = null; // null = unknown, true/false after probe
  let _eventSource = null;
  const _handlers = { vote: [], pollStatus: [], navigate: [], init: [], slides: [], presSettings: [] };

  // ── Detect if we're running under the Node server (not file://) ──────────
  async function probe() {
    if (window.location.protocol === 'file:') { _serverAvailable = false; return false; }
    try {
      const r = await fetch('/api/state', { signal: AbortSignal.timeout(1500) });
      _serverAvailable = r.ok;
    } catch {
      _serverAvailable = false;
    }
    return _serverAvailable;
  }

  function isAvailable() { return _serverAvailable === true; }

  // ── Vote (server-side duplicate prevention) ──────────────────────────────
  async function castVote(slideId, userHash, options, email) {
    if (!isAvailable())
      return { success: false, reason: 'SERVER_UNAVAILABLE' };
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slideId, userHash, options, email }),
      });
      return await res.json();
    } catch {
      return { success: false, reason: 'NETWORK_ERROR' };
    }
  }

  // ── Fetch all votes (sync on load) ───────────────────────────────────────
  async function getVotes() {
    if (!isAvailable()) return null;
    try {
      const res = await fetch('/api/votes');
      return await res.json();
    } catch { return null; }
  }

  // ── Push poll-status change to server ────────────────────────────────────
  async function pushPollStatus(slideId, status) {
    if (!isAvailable()) return;
    fetch('/api/poll-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slideId, status }),
    }).catch(() => {});
  }

  // ── Push slide navigation to server ─────────────────────────────────────
  async function pushNavigate(activeSlideIndex) {
    if (!isAvailable()) return;
    fetch('/api/navigate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeSlideIndex }),
    }).catch(() => {});
  }

  // ── Push slide updates to server ────────────────────────────────────────
  async function pushSlides(slides) {
    if (!isAvailable()) return;
    fetch('/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slides }),
    }).catch(() => {});
  }

  // ── Push presSettings to server ──────────────────────────────────────────
  async function pushPresSettings(presSettings) {
    if (!isAvailable()) return;
    fetch('/api/presSettings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presSettings }),
    }).catch(() => {});
  }

  // ── Register session code with server ────────────────────────────────────
  async function registerSession(sessionCode) {
    if (!isAvailable()) return;
    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionCode }),
    }).catch(() => {});
  }

  // ── SSE subscription ──────────────────────────────────────────────────────
  function connect() {
    if (!isAvailable() || _eventSource) return;
    _eventSource = new EventSource('/api/events');

    _eventSource.addEventListener('init', e => {
      _dispatch('init', JSON.parse(e.data));
    });
    _eventSource.addEventListener('vote', e => {
      _dispatch('vote', JSON.parse(e.data));
    });
    _eventSource.addEventListener('pollStatus', e => {
      _dispatch('pollStatus', JSON.parse(e.data));
    });
    _eventSource.addEventListener('navigate', e => {
      _dispatch('navigate', JSON.parse(e.data));
    });
    _eventSource.addEventListener('slides', e => {
      _dispatch('slides', JSON.parse(e.data));
    });
    _eventSource.addEventListener('presSettings', e => {
      _dispatch('presSettings', JSON.parse(e.data));
    });
    _eventSource.onerror = () => {
      // Auto-reconnect is built into EventSource
    };
  }

  function on(event, handler) {
    if (_handlers[event]) _handlers[event].push(handler);
  }

  function _dispatch(event, data) {
    (_handlers[event] || []).forEach(h => { try { h(data); } catch {} });
  }

  return { probe, isAvailable, castVote, getVotes, pushPollStatus, pushNavigate, pushSlides, pushPresSettings, registerSession, connect, on };
})();
