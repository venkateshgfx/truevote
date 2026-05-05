/**
 * LivePoll Secure — Fullscreen Presentation Mode
 */

const Presentation = (() => {
  let timerInterval = null;
  let timerRemaining = 0;
  let navHideTimeout = null;
  let liveRefreshInterval = null;

  function render() {
    const el = document.getElementById('screen-presentation');
    const state = State.get();

    el.innerHTML = `
      <!-- Hamburger -->
      <button class="pres-hamburger" id="pres-hamburger" onclick="Presentation._toggleSidebar()" title="Settings">☰</button>

      <!-- Settings Sidebar -->
      <div class="pres-settings-sidebar" id="pres-sidebar">
        <div>
          <div class="sidebar-header">
            <div class="sidebar-title">⚙️ Settings</div>
            <button class="sidebar-close" onclick="Presentation._toggleSidebar()">✕</button>
          </div>

          <div class="sidebar-setting-row">
            <div>
              <div class="sidebar-setting-label">Results Display</div>
              <div class="sidebar-setting-sub">How vote counts appear</div>
            </div>
            <div class="view-mode-toggle">
              <button class="view-mode-btn active" id="mode-pct" onclick="Presentation._setDisplayMode('percent')">%</button>
              <button class="view-mode-btn" id="mode-cnt" onclick="Presentation._setDisplayMode('count')">#</button>
            </div>
          </div>

          <div class="sidebar-setting-row">
            <div>
              <div class="sidebar-setting-label">QR Code</div>
              <div class="sidebar-setting-sub">Show joining QR on slide</div>
            </div>
            <label class="toggle" style="flex-shrink:0">
              <input type="checkbox" id="toggle-qr" checked onchange="Presentation._toggleQR(this.checked)" />
              <div class="toggle-track"></div>
              <div class="toggle-thumb"></div>
            </label>
          </div>

          <div class="sidebar-setting-row">
            <div>
              <div class="sidebar-setting-label">Instruction Bar</div>
              <div class="sidebar-setting-sub">Top joining instructions</div>
            </div>
            <label class="toggle" style="flex-shrink:0">
              <input type="checkbox" id="toggle-bar" checked onchange="Presentation._toggleBar(this.checked)" />
              <div class="toggle-track"></div>
              <div class="toggle-thumb"></div>
            </label>
          </div>
        </div>

        <div style="margin-top:auto; display:flex; flex-direction:column; gap:var(--sp-3)">
          <button class="btn btn-danger btn-sm sidebar-action-btn" onclick="Presentation._resetSlide()">
            🗑 Reset Slide Data
          </button>
          <button class="btn btn-secondary btn-sm sidebar-action-btn" onclick="Presentation._exit()">
            ← Exit Presentation
          </button>
        </div>
      </div>

        <!-- Logo & Exit Overlay -->
        <div class="pres-logo-zone">
          <img class="pres-logo hidden" id="pres-logo" alt="Logo" />
          <button class="pres-exit-btn" onclick="Presentation._exit()" title="Exit Presentation (ESC)">
            ✕ Exit
          </button>
        </div>

        <!-- Content -->
        <div class="pres-content">
          <div class="pres-left">
            <div class="pres-question" id="pres-question"></div>
            <div class="pres-chart-zone" id="pres-chart-zone"></div>
          </div>
          <div class="pres-qr-sidebar" id="pres-right">
            <button class="pres-qr-close" id="pres-qr-close" onclick="Presentation._toggleQR(false)" title="Hide QR">✕</button>
            <div class="pres-qr-code-wrap">
              <div class="pres-qr-code-box" id="pres-qr-box"></div>
            </div>
            <div class="pres-qr-info">
              <div class="pres-qr-join-label">Join at:</div>
              <div class="pres-qr-url" id="pres-qr-url"></div>
              <div class="pres-qr-session-code" id="pres-qr-session-code">${state.sessionCode || '------'}</div>
            </div>
          </div>
        </div>

        <!-- Vote Counter -->
        <div class="pres-vote-counter" id="pres-vote-counter">
          <div class="pres-vote-number" id="pres-vote-num">0</div>
          <div class="pres-vote-label">votes</div>
        </div>

        <!-- Timer Bar -->
        <div class="pres-timer-bar hidden" id="pres-timer-bar">
          <div class="pres-timer-progress" id="pres-timer-progress" style="width:100%"></div>
        </div>

        <!-- Navigation (Auto-hides) -->
        <div class="pres-nav" id="pres-nav">
          <button class="pres-nav-btn" id="pres-prev-btn" onclick="Presentation._prevSlide()" title="Previous (Left Arrow)">◀</button>
          <span class="pres-nav-slide-counter" id="pres-nav-counter">1 / ${state.slides.length}</span>
          <button class="pres-nav-btn" id="pres-next-btn" onclick="Presentation._nextSlide()" title="Next (Right Arrow or Space)">▶</button>
          <div class="pres-nav-separator"></div>
          <button class="pres-nav-poll-btn start" id="pres-poll-btn" onclick="Presentation._togglePoll()" title="Toggle Poll (P)">▶ Start Poll</button>
        </div>
      </div>
    `;

    _updateSlide();
    _setupKeyboard();
    _setupAutoHide();
  }

  function _updateSlide() {
    const state = State.get();
    const slide = State.getActiveSlide();
    if (!slide) return;

    const status = state.pollStatus[slide.id] || 'pending';
    const total = State.getTotalVotes(slide.id);
    const counts = State.getVoteCounts(slide.id);

    // Background — apply to screen-presentation directly
    const el = document.getElementById('screen-presentation');
    if (el) {
      if (slide.bgImage) {
        el.style.backgroundImage = `url(${slide.bgImage})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.style.backgroundColor = '';
      } else if (state.presSettings?.themeBgImage) {
        el.style.backgroundImage = `url(${state.presSettings.themeBgImage})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.style.backgroundColor = '';
      } else {
        el.style.backgroundImage = '';
        el.style.backgroundColor = slide.bgColor || state.presSettings?.themeBgColor || '#1a2547';
      }
    }

    // Question
    const qEl = document.getElementById('pres-question');
    if (qEl) {
      qEl.textContent = slide.question || '';
      qEl.style.color = state.presSettings?.themeTextColor || '#ffffff';
      qEl.style.fontFamily = state.presSettings?.themeFontFamily || 'Inter';
    }

    // Logo
    const logoEl = document.getElementById('pres-logo');
    const logoSrc = slide.logoImage || state.presSettings?.themeLogo;
    if (logoEl) {
      if (logoSrc) { logoEl.src = logoSrc; logoEl.classList.remove('hidden'); }
      else logoEl.classList.add('hidden');
    }

    // Chart
    const chartZone = document.getElementById('pres-chart-zone');
    if (chartZone) {
      if (!state.presSettings.showResults) {
        chartZone.style.opacity = '0';
      } else {
        chartZone.style.opacity = '1';
        const displayMode = state.presSettings.displayMode;
        const visColours = state.presSettings?.themeVisColours;
        const txtColor = state.presSettings?.themeTextColor || '#ffffff';

        if (slide.layout === 'donut') {
          Charts.renderDonut(chartZone, slide, counts, displayMode, txtColor, visColours);
        } else if (slide.layout === 'pie') {
          Charts.renderPie(chartZone, slide, counts, displayMode, txtColor, visColours);
        } else {
          Charts.renderBars(chartZone, slide, counts, displayMode, txtColor, visColours);
        }
      }
    }

    // Vote number
    const voteNum = document.getElementById('pres-vote-num');
    if (voteNum) voteNum.textContent = total;

    // Poll status badge
    const badge = document.getElementById('pres-poll-badge');
    const badgeText = document.getElementById('pres-poll-badge-text');
    if (badge && badgeText) {
      badge.className = `pres-poll-status ${status}`;
      badgeText.textContent = status === 'open' ? '🟢 Poll Open' : status === 'closed' ? '🔴 Poll Closed' : '⏳ Waiting to start';
    }

    // Nav poll button
    const pollBtn = document.getElementById('pres-poll-btn');
    if (pollBtn) {
      if (status === 'open') {
        pollBtn.textContent = '⏹ Stop Poll';
        pollBtn.className = 'pres-nav-poll-btn stop';
      } else {
        pollBtn.textContent = '▶ Start Poll';
        pollBtn.className = 'pres-nav-poll-btn start';
      }
    }

    // Nav buttons
    const prevBtn = document.getElementById('pres-prev-btn');
    const nextBtn = document.getElementById('pres-next-btn');
    const counter = document.getElementById('pres-nav-counter');
    const idx = state.activeSlideIndex;
    if (prevBtn) prevBtn.disabled = idx === 0;
    if (nextBtn) nextBtn.disabled = idx === state.slides.length - 1;
    if (counter) counter.textContent = `${idx + 1} / ${state.slides.length}`;

    // QR Code sidebar toggle & render
    const presRight = document.getElementById('pres-right');
    if (presRight) presRight.style.display = state.presSettings.showQR ? 'flex' : 'none';
    const qrBox = document.getElementById('pres-qr-box');
    if (qrBox && state.presSettings.showQR) {
      const joinUrl = QRHelper.getJoinUrl(state.sessionCode);
      QRHelper.renderPresQR(qrBox, state.sessionCode, 200);
      // Populate URL text
      const urlEl = document.getElementById('pres-qr-url');
      if (urlEl) {
        // Show shortened URL: hostname + path
        try {
          const u = new URL(joinUrl);
          urlEl.textContent = u.host + u.pathname;
        } catch (e) {
          urlEl.textContent = joinUrl.replace(/^https?:\/\//, '').split('?')[0];
        }
      }
      const codeEl = document.getElementById('pres-qr-session-code');
      if (codeEl) codeEl.textContent = state.sessionCode || '------';
    }

    // Timer
    if (slide.timerEnabled && status === 'open' && timerRemaining <= 0) {
      _startTimer(slide.timerSeconds);
    } else if (status !== 'open') {
      _stopTimer();
    }

    // Sidebar sync
    const modePct = document.getElementById('mode-pct');
    const modeCnt = document.getElementById('mode-cnt');
    if (modePct) modePct.classList.toggle('active', state.presSettings.displayMode === 'percent');
    if (modeCnt) modeCnt.classList.toggle('active', state.presSettings.displayMode === 'count');
  }

  function _startLiveRefresh() {
    State.subscribe((state, changed) => {
      if (!document.getElementById('screen-presentation')?.classList.contains('active')) return;
      if (changed.pollStatus || changed.activeSlideIndex || changed.slides || changed.presSettings) {
        _updateSlide();
      } else if (changed.votes) {
        _liveUpdateChart();
      }
    });
  }

  function _liveUpdateChart() {
    const state = State.get();
    const slide = State.getActiveSlide();
    if (!slide) return;

    const counts = State.getVoteCounts(slide.id);
    const chartZone = document.getElementById('pres-chart-zone');
    if (!chartZone) return;

    const displayMode = state.presSettings.displayMode;
    const visColours = state.presSettings?.themeVisColours;
    const txtColor = state.presSettings?.themeTextColor || '#ffffff';

    if (slide.layout === 'bars') {
      Charts.updateBars(chartZone, slide, counts, displayMode, txtColor, visColours);
    } else if (slide.layout === 'donut') {
      Charts.renderDonut(chartZone, slide, counts, displayMode, txtColor, visColours);
    } else if (slide.layout === 'pie') {
      Charts.renderPie(chartZone, slide, counts, displayMode, txtColor, visColours);
    }

    const voteNum = document.getElementById('pres-vote-num');
    if (voteNum) voteNum.textContent = State.getTotalVotes(slide.id);
  }

  // ── Keyboard navigation ──
  function _setupKeyboard() {
    const handler = (e) => {
      if (!document.getElementById('screen-presentation')?.classList.contains('active')) return;
      if (e.key === 'Escape') { Presentation._exit(); document.removeEventListener('keydown', handler); }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); Presentation._nextSlide(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); Presentation._prevSlide(); }
      if (e.key === 'p' || e.key === 'P') Presentation._togglePoll();
    };
    document.addEventListener('keydown', handler);
  }

  // ── Auto-hide nav ──
  function _setupAutoHide() {
    const slide = document.getElementById('pres-slide');
    if (!slide) return;
    slide.addEventListener('mousemove', () => {
      const nav = document.getElementById('pres-nav');
      if (nav) nav.classList.remove('auto-hide');
      clearTimeout(navHideTimeout);
      navHideTimeout = setTimeout(() => { nav?.classList.add('auto-hide'); }, 3000);
    });
  }

  // ── Timer ──
  function _startTimer(seconds) {
    _stopTimer();
    timerRemaining = seconds;
    const bar = document.getElementById('pres-timer-bar');
    const progress = document.getElementById('pres-timer-progress');
    if (bar) bar.classList.remove('hidden');

    timerInterval = setInterval(() => {
      timerRemaining--;
      if (progress) progress.style.width = `${(timerRemaining / seconds) * 100}%`;
      if (timerRemaining <= 0) {
        _stopTimer();
        const slide = State.getActiveSlide();
        if (slide) {
          State.setPollStatus(slide.id, 'closed');
          Toast.show('⏰ Timer expired — poll closed', 'warning');
        }
      }
    }, 1000);
  }

  function _stopTimer() {
    clearInterval(timerInterval);
    timerRemaining = 0;
    const bar = document.getElementById('pres-timer-bar');
    if (bar) bar.classList.add('hidden');
  }

  // ── Controls ──
  function _togglePoll() {
    const slide = State.getActiveSlide();
    if (!slide) return;
    const current = State.get().pollStatus[slide.id] || 'pending';
    const next = current === 'open' ? 'closed' : 'open';
    State.setPollStatus(slide.id, next);
    if (next === 'open' && slide.timerEnabled) _startTimer(slide.timerSeconds);
    else _stopTimer();
    _updateSlide();
  }

  function _nextSlide() {
    const state = State.get();
    if (state.activeSlideIndex < state.slides.length - 1) {
      State.set({ activeSlideIndex: state.activeSlideIndex + 1 });
      _stopTimer();
      _updateSlide();
    }
  }

  function _prevSlide() {
    const state = State.get();
    if (state.activeSlideIndex > 0) {
      State.set({ activeSlideIndex: state.activeSlideIndex - 1 });
      _stopTimer();
      _updateSlide();
    }
  }

  function _toggleSidebar() {
    document.getElementById('pres-sidebar')?.classList.toggle('open');
  }

  function _setDisplayMode(mode) {
    const settings = { ...State.get().presSettings, displayMode: mode };
    State.set({ presSettings: settings });
    document.getElementById('mode-pct')?.classList.toggle('active', mode === 'percent');
    document.getElementById('mode-cnt')?.classList.toggle('active', mode === 'count');
    _updateSlide();
  }

  function _toggleQR(show) {
    const sidebar = document.getElementById('pres-right');
    if (sidebar) sidebar.style.display = show ? 'flex' : 'none';
    const settings = { ...State.get().presSettings, showQR: show };
    State.set({ presSettings: settings });
  }

  function _toggleBar(show) {
    const bar = document.getElementById('pres-inst-bar');
    if (bar) bar.classList.toggle('hidden', !show);
    const settings = { ...State.get().presSettings, showInstructionBar: show };
    State.set({ presSettings: settings });
  }

  function _resetSlide() {
    const slide = State.getActiveSlide();
    if (!slide) return;
    if (!confirm('Reset all votes for this slide?')) return;
    const votes = { ...State.get().votes, [slide.id]: {} };
    State.set({ votes });
    State.setPollStatus(slide.id, 'pending');
    _stopTimer();
    _updateSlide();
    Toast.show('Slide data reset', 'info');
  }

  function _exit() {
    clearInterval(liveRefreshInterval);
    _stopTimer();
    App.navigate('editor');
    Editor._refresh();
  }

  // ── Brightness calculation ──
  function _getBrightness(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  return {
    render, _exit,
    _nextSlide, _prevSlide, _togglePoll, _toggleSidebar, _setDisplayMode, _toggleQR, _toggleBar, _resetSlide,
    _startLiveRefresh
  };
})();

// Initialize presentation live sync once
Presentation._startLiveRefresh();
