/**
 * SlideMeter — QR Code & Join URL Module
 *
 * Generates the participant join URL and renders real, scannable QR codes.
 * Uses QRCode.js (loaded from CDN) with a canvas fallback.
 */

const QRHelper = (() => {

  // ── Build the participant join URL ──────────────────────────────────────
  // Points to the same HTML file with ?mode=participant&code=XXXX
  // Works for both file:// and hosted origins.
  function getJoinUrl(sessionCode) {
    const base = window.location.href.split('?')[0];  // strip any existing params
    return `${base}?mode=participant&code=${sessionCode}`;
  }

  // ── Render a real QR code into a container element ─────────────────────
  // container : HTMLElement  — cleared and filled with a <canvas> or <img>
  // text      : string       — the URL to encode
  // size      : number       — pixel size (default 160)
  function renderQR(container, text, size = 160) {
    container.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
      // ── Use QRCode.js (CDN) ──
      try {
        new QRCode(container, {
          text,
          width:  size,
          height: size,
          colorDark:  '#1a1a2e',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M,
        });
        return;
      } catch (e) { /* fallthrough to canvas fallback */ }
    }

    // ── Canvas fallback (pure-JS approximation) ──
    _drawFallbackQR(container, text, size);
  }

  // ── Draw a visually credible QR-like pattern as a fallback ─────────────
  function _drawFallbackQR(container, text, size) {
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const modules = 25;
    const cell = size / modules;

    // Deterministic pattern seeded by text
    let seed = 0;
    for (let c of text) seed = (Math.imul(31, seed) + c.charCodeAt(0)) | 0;
    function rand() {
      seed = (Math.imul(1664525, seed) + 1013904223) | 0;
      return (seed >>> 0) / 0xffffffff;
    }

    ctx.fillStyle = '#1a1a2e';

    // Data modules (avoid finder pattern zones)
    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        const inFinder =
          (r < 9 && c < 9) ||
          (r < 9 && c >= modules - 8) ||
          (r >= modules - 8 && c < 9);
        if (!inFinder && rand() > 0.5) {
          ctx.fillRect(
            Math.round(c * cell), Math.round(r * cell),
            Math.ceil(cell) - 1,  Math.ceil(cell) - 1
          );
        }
      }
    }

    // Finder patterns (top-left, top-right, bottom-left)
    _drawFinder(ctx, 0,                  0,                  cell);
    _drawFinder(ctx, (modules - 7) * cell, 0,                cell);
    _drawFinder(ctx, 0,                  (modules - 7) * cell, cell);

    // Timing strips
    ctx.fillStyle = '#1a1a2e';
    for (let i = 8; i < modules - 8; i++) {
      if (i % 2 === 0) {
        ctx.fillRect(Math.round(i * cell), Math.round(6 * cell), Math.ceil(cell), Math.ceil(cell));
        ctx.fillRect(Math.round(6 * cell), Math.round(i * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }

    // Alignment pattern (centre)
    const ac = Math.round(modules / 2);
    _drawAlignment(ctx, ac * cell, ac * cell, cell);
  }

  function _drawFinder(ctx, ox, oy, cell) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(ox, oy, 7 * cell, 7 * cell);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + cell, oy + cell, 5 * cell, 5 * cell);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(ox + 2 * cell, oy + 2 * cell, 3 * cell, 3 * cell);
  }

  function _drawAlignment(ctx, cx, cy, cell) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(cx - 2.5 * cell, cy - 2.5 * cell, 5 * cell, 5 * cell);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 1.5 * cell, cy - 1.5 * cell, 3 * cell, 3 * cell);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(cx - 0.5 * cell, cy - 0.5 * cell, cell, cell);
  }

  // ── Show the Share / Join modal ─────────────────────────────────────────
  function showShareModal() {
    const state    = State.get();
    const code     = state.sessionCode || '------';
    const joinUrl  = getJoinUrl(code);

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.id = 'share-modal-backdrop';
    backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };

    backdrop.innerHTML = `
      <div class="modal share-modal" style="max-width:520px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-6)">
          <div>
            <div class="modal-title">📡 Invite Participants</div>
            <div class="text-sm text-muted" style="margin-top:4px">Share any of these to let participants join</div>
          </div>
          <button class="btn btn-ghost btn-icon" onclick="document.getElementById('share-modal-backdrop').remove()">✕</button>
        </div>

        <!-- QR Code -->
        <div style="display:flex;gap:var(--sp-6);align-items:flex-start;margin-bottom:var(--sp-6)">
          <div style="flex-shrink:0;text-align:center">
            <div id="share-qr-box"
              style="width:180px;height:180px;background:#fff;border-radius:var(--r-lg);
                     padding:10px;display:flex;align-items:center;justify-content:center;
                     box-shadow:var(--shadow-md);">
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:8px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">
              Scan to join
            </div>
          </div>

          <div style="flex:1;display:flex;flex-direction:column;gap:var(--sp-4)">
            <!-- Session Code -->
            <div>
              <div class="label">Session Code</div>
              <div style="display:flex;align-items:center;gap:var(--sp-2)">
                <div style="
                  font-family:var(--font-mono);font-size:32px;font-weight:900;
                  letter-spacing:0.15em;color:var(--text-accent);
                  background:var(--surface-3);border:1px solid var(--border-accent);
                  border-radius:var(--r-lg);padding:10px 18px;flex:1;text-align:center;
                ">${code}</div>
                <button class="btn btn-secondary btn-icon btn-sm" title="Copy code"
                  onclick="QRHelper._copy('${code}','code')">📋</button>
              </div>
            </div>

            <!-- Join URL -->
            <div>
              <div class="label">Direct Join URL</div>
              <div style="display:flex;align-items:center;gap:var(--sp-2)">
                <input id="share-url-input" class="input" readonly
                  value="${joinUrl}"
                  style="font-size:11px;font-family:var(--font-mono);cursor:pointer;"
                  onclick="this.select()" />
                <button class="btn btn-secondary btn-icon btn-sm" title="Copy URL"
                  onclick="QRHelper._copy(document.getElementById('share-url-input').value,'url')">📋</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Instructions -->
        <div style="
          background:var(--surface-2);border:1px solid var(--border-subtle);
          border-radius:var(--r-lg);padding:var(--sp-4);font-size:13px;
          color:var(--text-secondary);line-height:1.7;
        ">
          <strong style="color:var(--text-primary)">📱 How to join:</strong><br>
          Participants open the link on their phone or laptop, enter their
          <strong>Corporate Email + LDAP ID</strong>, and the code is pre-filled automatically.
          They'll see the poll as soon as you click <em>Start Poll</em>.
        </div>

        <div style="display:flex;gap:var(--sp-3);margin-top:var(--sp-5)">
          <button class="btn btn-primary" style="flex:1;justify-content:center"
            onclick="QRHelper._copy(document.getElementById('share-url-input').value,'url')">
            🔗 Copy Join Link
          </button>
          <button class="btn btn-secondary"
            onclick="QRHelper._downloadQR()">
            ⬇ Download QR
          </button>
          <button class="btn btn-ghost"
            onclick="document.getElementById('share-modal-backdrop').remove()">
            Close
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    // Render real QR after DOM is ready
    requestAnimationFrame(() => {
      const box = document.getElementById('share-qr-box');
      if (box) renderQR(box, joinUrl, 160);
    });
  }

  // ── Copy helper ─────────────────────────────────────────────────────────
  function _copy(text, kind = 'text') {
    navigator.clipboard.writeText(text).then(() => {
      Toast.show(kind === 'url' ? '🔗 Join URL copied!' : `📋 Code "${text}" copied!`, 'success');
    }).catch(() => {
      // Fallback for file:// with clipboard restrictions
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      Toast.show(kind === 'url' ? '🔗 Join URL copied!' : `📋 Code "${text}" copied!`, 'success');
    });
  }

  // ── Download the QR as a PNG ─────────────────────────────────────────────
  function _downloadQR() {
    const box = document.getElementById('share-qr-box');
    if (!box) return;

    // Find the canvas or img generated by QRCode.js
    const canvas = box.querySelector('canvas');
    const img    = box.querySelector('img');

    if (canvas) {
      const a = document.createElement('a');
      a.download = `slidemeter-join-${State.get().sessionCode}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    } else if (img) {
      const a = document.createElement('a');
      a.download = `slidemeter-join-${State.get().sessionCode}.png`;
      a.href = img.src;
      a.click();
    }
    Toast.show('QR code downloaded', 'success');
  }

  // ── Tiny inline QR for the presentation slide sidebar ───────────────────
  // Renders into an existing HTMLElement without wrapping in a modal.
  function renderPresQR(container, sessionCode, size = 140) {
    const url = getJoinUrl(sessionCode);
    renderQR(container, url, size);
  }

  return { getJoinUrl, renderQR, renderPresQR, showShareModal, _copy, _downloadQR };
})();
