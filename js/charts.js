/**
 * LivePoll Secure — Chart Rendering Engine
 * Smooth, animated Bar / Donut / Pie charts using Canvas API
 */

const Charts = (() => {

  // ── Color palette for options ──
  const PALETTE = OPTION_COLORS;

  // ── Draw animated bar chart ──
  function renderBars(container, slide, counts, displayMode, textColor = 'rgba(255,255,255,0.85)', visColours = null) {
    const palette = visColours || PALETTE;
    const total = counts.reduce((a, b) => a + b, 0);
    const maxCount = Math.max(...counts, 1);

    container.innerHTML = `<div class="chart-bars"></div>`;
    const barsEl = container.querySelector('.chart-bars');

    if (total === 0 && !slide.options.length) {
      container.innerHTML = `<div class="chart-empty"><span class="chart-empty-icon">📊</span>No votes yet</div>`;
      return;
    }

    slide.options.forEach((opt, i) => {
      const count = counts[i] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
      const valueLabel = displayMode === 'percent' ? `${pct}%` : count;
      const color = opt.color || palette[i % palette.length];

      const col = document.createElement('div');
      col.className = 'chart-bar-col';
      col.innerHTML = `
        <div class="chart-bar-value" style="color:${textColor}">${valueLabel}</div>
        <div class="chart-bar-track">
          <div class="chart-bar-fill" style="height:0%; background: linear-gradient(to top, ${color}, ${adjustBrightness(color, 30)})" data-target="${heightPct}"></div>
        </div>
        <div class="chart-bar-label" style="color:${adjustAlpha(textColor, 0.55)}">${escHtml(opt.text)}</div>
      `;
      barsEl.appendChild(col);
    });

    // Animate in
    requestAnimationFrame(() => {
      container.querySelectorAll('.chart-bar-fill').forEach(el => {
        const target = el.dataset.target;
        requestAnimationFrame(() => {
          el.style.height = `${target}%`;
        });
      });
    });
  }

  // ── Update existing bar chart without full re-render ──
  function updateBars(container, slide, counts, displayMode, textColor = 'rgba(255,255,255,0.85)') {
    const cols = container.querySelectorAll('.chart-bar-col');
    if (!cols.length) { renderBars(container, slide, counts, displayMode, textColor); return; }

    const total = counts.reduce((a, b) => a + b, 0);
    const maxCount = Math.max(...counts, 1);

    cols.forEach((col, i) => {
      const count = counts[i] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
      const valueLabel = displayMode === 'percent' ? `${pct}%` : count;

      const valEl = col.querySelector('.chart-bar-value');
      const fillEl = col.querySelector('.chart-bar-fill');

      if (valEl) valEl.textContent = valueLabel;
      if (fillEl) {
        fillEl.style.height = `${heightPct}%`;
        const prevCount = parseInt(fillEl.dataset.count || '0', 10);
        if (prevCount !== count) {
          fillEl.classList.remove('updated'); // Reset animation
          void fillEl.offsetWidth; // Trigger reflow
          fillEl.classList.add('updated');
        }
        fillEl.dataset.count = count;
      }
    });
  }

  // ── Draw Donut chart on Canvas ──
  function renderDonut(container, slide, counts, displayMode, textColor = '#fff', visColours = null) {
    const palette = visColours || PALETTE;
    const total = counts.reduce((a, b) => a + b, 0);
    const size = Math.min(container.clientHeight || 160, 180);

    container.innerHTML = `
      <div class="chart-circular-wrap">
        <canvas class="chart-circular-canvas" width="${size}" height="${size}"></canvas>
        <div class="chart-legend"></div>
      </div>
    `;

    const canvas = container.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const legend = container.querySelector('.chart-legend');

    // Build legend
    slide.options.forEach((opt, i) => {
      const count = counts[i] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const label = displayMode === 'percent' ? `${pct}%` : count;
      const color = opt.color || palette[i % palette.length];

      const item = document.createElement('div');
      item.className = 'chart-legend-item';
      item.innerHTML = `
        <div class="chart-legend-dot" style="background:${color}"></div>
        <div class="chart-legend-label">${escHtml(opt.text)}</div>
        <div class="chart-legend-value">${label}</div>
      `;
      legend.appendChild(item);
    });

    // Animate donut
    _animateArc(ctx, canvas, slide, counts, total, 'donut', textColor, palette);
  }

  // ── Draw Pie chart on Canvas ──
  function renderPie(container, slide, counts, displayMode, textColor = '#fff', visColours = null) {
    const palette = visColours || PALETTE;
    const total = counts.reduce((a, b) => a + b, 0);
    const size = Math.min(container.clientHeight || 160, 180);

    container.innerHTML = `
      <div class="chart-circular-wrap">
        <canvas class="chart-circular-canvas" width="${size}" height="${size}"></canvas>
        <div class="chart-legend"></div>
      </div>
    `;

    const canvas = container.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const legend = container.querySelector('.chart-legend');

    slide.options.forEach((opt, i) => {
      const count = counts[i] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const label = displayMode === 'percent' ? `${pct}%` : count;
      const color = opt.color || palette[i % palette.length];

      const item = document.createElement('div');
      item.className = 'chart-legend-item';
      item.innerHTML = `
        <div class="chart-legend-dot" style="background:${color}"></div>
        <div class="chart-legend-label">${escHtml(opt.text)}</div>
        <div class="chart-legend-value">${label}</div>
      `;
      legend.appendChild(item);
    });

    _animateArc(ctx, canvas, slide, counts, total, 'pie', textColor, palette);
  }

  function _animateArc(ctx, canvas, slide, counts, total, type, textColor, palette) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = (canvas.width / 2) - 6;
    const innerR = type === 'donut' ? r * 0.55 : 0;
    let startAngle = -Math.PI / 2;
    let progress = 0;
    const duration = 700;
    const startTime = performance.now();

    function draw(t) {
      progress = Math.min((t - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (total === 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = type === 'donut' ? r - innerR : 2;
        ctx.stroke();
        if (progress < 1) requestAnimationFrame(draw);
        return;
      }

      let sa = -Math.PI / 2;
      slide.options.forEach((opt, i) => {
        const count = counts[i] || 0;
        const frac = (count / total) * Math.PI * 2 * ease;
        const color = opt.color || palette[i % palette.length];

        ctx.beginPath();
        if (type === 'donut') {
          ctx.arc(cx, cy, r, sa, sa + frac);
          ctx.arc(cx, cy, innerR, sa + frac, sa, true);
        } else {
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, r, sa, sa + frac);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // Segment gap
        if (count > 0 && total > count) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, r + 2, sa, sa + 0.01);
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        sa += frac;
      });

      // Center label for donut
      if (type === 'donut' && ease > 0.5) {
        ctx.fillStyle = textColor;
        ctx.font = `bold ${Math.round(r * 0.35)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(total, cx, cy);
        ctx.font = `500 ${Math.round(r * 0.17)}px Inter, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('votes', cx, cy + r * 0.28);
      }

      if (progress < 1) requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);
  }

  // ── Mini bars for participant results ──
  function renderMiniBars(container, slide, counts, displayMode, visColours = null) {
    const palette = visColours || PALETTE;
    const total = counts.reduce((a, b) => a + b, 0);
    container.innerHTML = `<div class="mini-bars"></div>`;
    const bars = container.querySelector('.mini-bars');

    slide.options.forEach((opt, i) => {
      const count = counts[i] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const color = opt.color || palette[i % palette.length];
      const label = displayMode === 'percent' ? `${pct}%` : count;

      const row = document.createElement('div');
      row.className = 'mini-bar-row';
      row.innerHTML = `
        <div class="mini-bar-label">${escHtml(opt.text)}</div>
        <div class="mini-bar-track">
          <div class="mini-bar-fill" style="width:0%; background:${color}"></div>
        </div>
        <div class="mini-bar-pct">${label}</div>
      `;
      bars.appendChild(row);
    });

    requestAnimationFrame(() => {
      bars.querySelectorAll('.mini-bar-fill').forEach((el, i) => {
        const count = counts[i] || 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        requestAnimationFrame(() => { el.style.width = `${pct}%`; });
      });
    });
  }

  // ── QR Code generator (pure JS, no external lib) ──
  function renderQR(canvas, text) {
    // Simple visual QR placeholder (a real implementation would use a QR lib)
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Draw a styled placeholder that looks like a QR code
    ctx.fillStyle = '#1a1a2e';
    const cellSize = size / 21;

    // Finder patterns (top-left, top-right, bottom-left)
    const drawFinder = (ox, oy) => {
      ctx.fillRect(ox, oy, 7 * cellSize, 7 * cellSize);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect((ox + cellSize), (oy + cellSize), 5 * cellSize, 5 * cellSize);
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect((ox + 2 * cellSize), (oy + 2 * cellSize), 3 * cellSize, 3 * cellSize);
    };

    ctx.fillStyle = '#1a1a2e';
    drawFinder(0, 0);
    drawFinder(14 * cellSize, 0);
    drawFinder(0, 14 * cellSize);

    // Random data modules based on text hash
    let hash = 0;
    for (let c of text) hash = (Math.imul(31, hash) + c.charCodeAt(0)) | 0;

    for (let row = 0; row < 21; row++) {
      for (let col = 0; col < 21; col++) {
        if ((row < 9 && col < 9) || (row < 9 && col > 11) || (row > 11 && col < 9)) continue;
        hash = (Math.imul(1103515245, hash) + 12345) | 0;
        if ((hash & 1) === 1) {
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(col * cellSize, row * cellSize, cellSize - 0.5, cellSize - 0.5);
        }
      }
    }

    // Timing pattern
    for (let i = 8; i < 13; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(i * cellSize, 6 * cellSize, cellSize, cellSize);
        ctx.fillRect(6 * cellSize, i * cellSize, cellSize, cellSize);
      }
    }
  }

  // ── Helpers ──
  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function adjustBrightness(hex, amount) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgb(${Math.min(255,r+amount)},${Math.min(255,g+amount)},${Math.min(255,b+amount)})`;
  }

  function adjustAlpha(color, alpha) {
    if (color.startsWith('rgba')) return color.replace(/[\d.]+\)$/, `${alpha})`);
    if (color.startsWith('rgb'))  return color.replace('rgb','rgba').replace(')', `,${alpha})`);
    return `rgba(255,255,255,${alpha})`;
  }

  return { renderBars, updateBars, renderDonut, renderPie, renderMiniBars, renderQR };
})();
