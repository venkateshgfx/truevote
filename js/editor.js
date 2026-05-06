/**
 * SlideMeter — Presenter Editor Module
 * 3-Column Workspace: Nav | Canvas | Inspector
 */

const Editor = (() => {
  let chartUpdateTimeout = null;
  let currentTab = 'slide';
  let _isEditing = false;  // True while user is typing in inputs

  function render() {
    const el = document.getElementById('screen-editor');
    const state = State.get();
    const slide = State.getActiveSlide();
    const user = state.user;
    const initials = user?.email ? user.email.slice(0,2).toUpperCase() : 'PR';

    el.innerHTML = `
      <!-- TOP BAR -->
      <header class="editor-topbar">
        <div class="topbar-left">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="App.navigate('dashboard')" title="Back to Dashboard">
            <i data-lucide="arrow-left" class="icon-md"></i>
          </button>
          <div class="topbar-logo">
            <div class="topbar-logo-icon"><i data-lucide="bar-chart-2" class="icon-md" style="color:#fff"></i></div>
            Slide<span style="color:var(--accent-primary)">Meter</span>
          </div>
          <div class="topbar-session">
            <span class="text-muted text-sm">Session:</span>
            <div class="session-code-badge" id="topbar-session-code" onclick="Editor._copyCode()" title="Click to copy">${state.sessionCode || '------'}</div>
            <button class="btn btn-ghost btn-sm btn-icon" onclick="QRHelper.showShareModal()" title="Show QR code &amp; join link">
              <i data-lucide="qr-code" class="icon-md"></i>
            </button>
            <div class="participant-count">
              <div class="participant-dot"></div>
              <span id="topbar-participant-count">${_getTotalUniqueVoters(state)}</span> voters
            </div>
          </div>
        </div>
        <div class="topbar-center">
          <span class="badge badge-accent">Slide ${state.activeSlideIndex + 1} / ${state.slides.length}</span>
        </div>
        <div class="topbar-right">
          <button class="btn btn-ghost btn-sm" onclick="Editor._exportCSV()" title="Export CSV">
            <i data-lucide="download" class="icon-sm"></i> Export CSV
          </button>
          <button class="btn btn-secondary btn-sm" onclick="QRHelper.showShareModal()" title="Invite participants via QR / link">
            <i data-lucide="share-2" class="icon-sm"></i> Share &amp; QR
          </button>
          <button class="btn btn-primary btn-sm" onclick="Editor._present()">
            <i data-lucide="play" class="icon-sm"></i> Present
          </button>
          <div class="user-menu" title="${user?.email}">
            <div class="user-avatar">${initials}</div>
            <span class="text-sm text-secondary">${user?.email?.split('@')[0] || 'Presenter'}</span>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="App.logout()" title="Sign out" style="color:var(--accent-danger)">
            <i data-lucide="log-out" class="icon-sm"></i> Sign Out
          </button>
        </div>
      </header>

      <!-- WORKSPACE -->
      <div class="editor-workspace">
        <!-- LEFT: Slide Navigator -->
        <aside class="editor-nav" id="editor-nav">
          <div class="nav-header">
            <span class="nav-title">Slides</span>
            <span class="badge badge-accent">${state.slides.length}</span>
          </div>
          <div class="slide-list" id="slide-list"></div>
          <div class="nav-footer">
            <div class="nav-add-label">Add Slide</div>
            <div class="nav-add-btns">
              <button class="btn btn-ghost btn-sm add-slide-btn" onclick="Editor._addSlide('poll')" title="Poll slide">
                <i data-lucide="bar-chart-2" class="icon-sm"></i> Poll
              </button>
              <button class="btn btn-ghost btn-sm add-slide-btn" onclick="Editor._addSlide('rating')" title="Star rating slide">
                <i data-lucide="star" class="icon-sm"></i> Rating
              </button>
              <button class="btn btn-ghost btn-sm add-slide-btn" onclick="Editor._addSlide('text')" title="Text / info slide">
                <i data-lucide="type" class="icon-sm"></i> Text
              </button>
              <button class="btn btn-ghost btn-sm add-slide-btn" onclick="Editor._addSlide('qr')" title="Session QR slide">
                <i data-lucide="qr-code" class="icon-sm"></i> QR
              </button>
            </div>
          </div>
        </aside>

        <!-- CENTER: Canvas Preview -->
        <main class="editor-canvas" id="editor-canvas">
          <div class="canvas-controls-top">
            <span class="canvas-slide-label">Slide ${state.activeSlideIndex + 1} Preview</span>
            <button class="btn btn-ghost btn-sm" onclick="Editor._clearResults()" title="Clear all votes for this slide">
              <i data-lucide="trash-2" class="icon-sm"></i> Clear Results
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('participant')" title="Preview participant view">
              <i data-lucide="eye" class="icon-sm"></i> Participant View
            </button>
          </div>

          <div class="canvas-wrapper" id="canvas-wrapper">
            <div class="canvas-slide-bg" id="canvas-bg"></div>
            <img class="canvas-logo hidden" id="canvas-logo" alt="Logo" />
            <div class="canvas-content">
              <div class="canvas-question" id="canvas-question"></div>
              <div class="canvas-subtitle" id="canvas-subtitle" style="display:none"></div>
              <div class="canvas-chart-area" id="canvas-chart-area"></div>
            </div>
            <div class="canvas-overlay">
              <button class="canvas-overlay-btn" id="canvas-poll-btn" onclick="Editor._togglePoll()"></button>
            </div>
            <div class="canvas-vote-count" id="canvas-vote-count">
              <i data-lucide="check-square" class="icon-sm" style="opacity:0.7"></i>
              <span id="canvas-vote-num">0</span> votes
            </div>
          </div>

          <div class="canvas-actions-row">
            <div class="canvas-stat">
              <span>Total Votes</span>
              <span class="canvas-stat-value" id="stat-votes">0</span>
            </div>
            <div class="canvas-stat">
              <span>Leading Option</span>
              <span class="canvas-stat-value" id="stat-leader" style="color:var(--accent-primary)">—</span>
            </div>
            <div class="canvas-stat">
              <span>Poll Status</span>
              <span class="canvas-stat-value" id="stat-status">Pending</span>
            </div>
            <div style="flex:1"></div>
          </div>
        </main>

        <!-- RIGHT: Properties Inspector -->
        <aside class="editor-inspector" id="editor-inspector">
          <div class="inspector-tabs">
            <div class="inspector-tab ${currentTab === 'slide' ? 'active' : ''}" onclick="Editor._switchTab('slide')">Slide</div>
            <div class="inspector-tab ${currentTab === 'settings' ? 'active' : ''}" onclick="Editor._switchTab('settings')">Settings</div>
          </div>

          <div id="inspector-slide-pane" class="${currentTab === 'settings' ? 'hidden' : ''}">
            <!-- SHARED: Question + Subtitle fields -->
            <div class="inspector-section">
              <div class="inspector-section-title">
                <i data-lucide="file-text" class="icon-sm"></i> Content
              </div>
              <div class="form-group">
                <label class="label" for="prop-question">Title / Question</label>
                <textarea id="prop-question" class="textarea" rows="3"
                  oninput="Editor._updateProp('question', this.value)"
                  placeholder="Type your question or slide title…"></textarea>
              </div>
              <div class="form-group" style="margin-top:var(--sp-3)">
                <label class="label" for="prop-subtitle">Subtitle / Description <span style="color:var(--text-muted);font-weight:400">(optional)</span></label>
                <textarea id="prop-subtitle" class="textarea" rows="2"
                  oninput="Editor._updateProp('subtitle', this.value)"
                  placeholder="Add extra context or instructions shown below the title…"></textarea>
              </div>
            </div>

            <!-- POLL pane -->
            <div id="inspector-poll-pane">
              <div class="inspector-section-title" style="margin-top:var(--sp-4)">
                <i data-lucide="list" class="icon-sm"></i> Options
              </div>
              <div class="options-list" id="options-list"></div>
              <button class="btn btn-ghost btn-sm add-option-btn" onclick="Editor._addOption()">
                ＋ Add Option
              </button>

              <!-- LOGIC -->
              <div class="inspector-section">
                <div class="inspector-section-title">
                  <i data-lucide="sliders" class="icon-sm"></i> Logic
                </div>
                <div class="toggle-wrap">
                  <div><div class="toggle-label">Multiple Selection</div></div>
                  <label class="toggle" title="Allow multiple picks">
                    <input type="checkbox" id="toggle-multi" onchange="Editor._updateProp('multiSelect', this.checked)" />
                    <div class="toggle-track"></div><div class="toggle-thumb"></div>
                  </label>
                </div>
                <div id="max-picks-row" class="form-group hidden" style="margin-top:var(--sp-3)">
                  <label class="label" for="prop-max-picks">Max Picks Allowed</label>
                  <select id="prop-max-picks" class="select" onchange="Editor._updateProp('maxPicks', parseInt(this.value))">
                    ${[2,3,4,5,6,7,8].map(n=>`<option value="${n}">${n} options</option>`).join('')}
                  </select>
                </div>
                <div class="toggle-wrap">
                  <div><div class="toggle-label">Timer Limit</div></div>
                  <label class="toggle">
                    <input type="checkbox" id="toggle-timer" onchange="Editor._updateProp('timerEnabled', this.checked)" />
                    <div class="toggle-track"></div><div class="toggle-thumb"></div>
                  </label>
                </div>
                <div id="timer-seconds-row" class="timer-input-row hidden">
                  <input type="number" id="prop-timer" class="input" min="5" max="600" value="60"
                    style="max-width:90px"
                    onchange="Editor._updateProp('timerSeconds', parseInt(this.value) || 60)" />
                  <span class="text-sm text-muted">seconds</span>
                </div>
                <div class="toggle-wrap">
                  <div><div class="toggle-label">Lock Submissions</div></div>
                  <label class="toggle">
                    <input type="checkbox" id="toggle-locked" onchange="Editor._updateProp('locked', this.checked)" />
                    <div class="toggle-track"></div><div class="toggle-thumb"></div>
                  </label>
                </div>
                <div class="toggle-wrap">
                  <div><div class="toggle-label">Show Chart on Mobile Devices</div></div>
                  <label class="toggle">
                    <input type="checkbox" id="toggle-show-results" onchange="Editor._updateProp('showResultsToAudience', this.checked)" />
                    <div class="toggle-track"></div><div class="toggle-thumb"></div>
                  </label>
                </div>
                <!-- LAYOUT -->
                <div class="inspector-section">
                  <div class="inspector-section-title">
                    <i data-lucide="layout-dashboard" class="icon-sm"></i> Chart Layout
                  </div>
                  <div class="layout-picker" id="layout-picker">
                    <button class="layout-option active" data-layout="bars" onclick="Editor._setLayout('bars')">
                      <span class="layout-option-icon"><i data-lucide="bar-chart-2" class="icon-md"></i></span>Bars
                    </button>
                    <button class="layout-option" data-layout="donut" onclick="Editor._setLayout('donut')">
                      <span class="layout-option-icon"><i data-lucide="pie-chart" class="icon-md"></i></span>Donut
                    </button>
                    <button class="layout-option" data-layout="pie" onclick="Editor._setLayout('pie')">
                      <span class="layout-option-icon"><i data-lucide="chart-pie" class="icon-md"></i></span>Pie
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- RATING pane -->
            <div id="inspector-rating-pane" class="hidden">
              <div class="inspector-section">
                <div class="inspector-section-title">
                  <i data-lucide="star" class="icon-sm"></i> Star Rating Settings
                </div>
                <div class="inspector-info-box">
                  <i data-lucide="info" class="icon-sm"></i>
                  Participants will rate with 1–5 stars. Results show average score and distribution.
                </div>
                <div class="toggle-wrap" style="margin-top:var(--sp-3)">
                  <div><div class="toggle-label">Timer Limit</div></div>
                  <label class="toggle">
                    <input type="checkbox" id="toggle-timer" onchange="Editor._updateProp('timerEnabled', this.checked)" />
                    <div class="toggle-track"></div><div class="toggle-thumb"></div>
                  </label>
                </div>
                <div class="toggle-wrap">
                  <div><div class="toggle-label">Lock Submissions</div></div>
                  <label class="toggle">
                    <input type="checkbox" id="toggle-locked" onchange="Editor._updateProp('locked', this.checked)" />
                    <div class="toggle-track"></div><div class="toggle-thumb"></div>
                  </label>
                </div>
                <div class="toggle-wrap">
                  <div><div class="toggle-label">Show Results to Audience</div></div>
                  <label class="toggle">
                    <input type="checkbox" id="toggle-show-results" onchange="Editor._updateProp('showResultsToAudience', this.checked)" />
                    <div class="toggle-track"></div><div class="toggle-thumb"></div>
                  </label>
                </div>
              </div>
            </div>

            <!-- TEXT pane -->
            <div id="inspector-text-pane" class="hidden">
              <div class="inspector-section">
                <div class="inspector-section-title">
                  <i data-lucide="type" class="icon-sm"></i> Text Content
                </div>
                <div class="inspector-info-box">
                  <i data-lucide="info" class="icon-sm"></i>
                  This slide is for displaying information only. No voting occurs.
                </div>
                <div class="form-group" style="margin-top:var(--sp-3)">
                  <label class="label" for="prop-text-body">Body Text</label>
                  <textarea id="prop-text-body" class="textarea" rows="6"
                    oninput="Editor._updateProp('body', this.value)"
                    placeholder="Enter the content to display on this slide…"></textarea>
                </div>
              </div>
            </div>

            <!-- QR pane -->
            <div id="inspector-qr-pane" class="hidden">
              <div class="inspector-section">
                <div class="inspector-section-title">
                  <i data-lucide="qr-code" class="icon-sm"></i> Session QR Slide
                </div>
                <div class="inspector-info-box">
                  <i data-lucide="info" class="icon-sm"></i>
                  Shows a large QR code with the session join link. Use the <strong>Subtitle</strong> field above to add a scan instruction.
                </div>
              </div>
            </div>
          </div>

          <div id="inspector-settings-pane" class="${currentTab === 'slide' ? 'hidden' : ''}">
            <!-- DESIGN -->
            <div class="inspector-section">
              <div class="inspector-section-title">
                <i data-lucide="palette" class="icon-sm"></i> Design
              </div>

              <div class="form-group">
                <label class="label">Current Theme</label>
                <div style="display:flex; gap:var(--sp-2); align-items:center;">
                  <select class="select select-sm" style="flex:1" onchange="ThemeManager.applyTheme(this.value)">
                    ${(state.themes || []).map(t => `<option value="${t.id}" ${t.id === state.activeThemeId ? 'selected' : ''}>${t.name}</option>`).join('')}
                  </select>
                  <button class="btn btn-ghost btn-sm btn-icon" onclick="ThemeManager.openModal(State.get().activeThemeId)" title="Edit theme">
                    <i data-lucide="pencil" class="icon-sm"></i>
                  </button>
                  <button class="btn btn-secondary btn-sm" onclick="ThemeManager.openModal()">＋ New</button>
                </div>
              </div>

              <div class="form-group">
                <label class="label">Universal Background Color</label>
                <div class="color-picker-row">
                  <div class="color-swatch">
                    <input type="color" id="prop-bg-color" value="${state.presSettings?.themeBgColor || '#1a2547'}"
                      oninput="Editor._togglePresSetting('themeBgColor', this.value)" />
                  </div>
                  <input type="text" id="prop-bg-hex" class="input color-hex-input"
                    value="${state.presSettings?.themeBgColor || '#1a2547'}" placeholder="#1a2547"
                    oninput="Editor._onHexInput(this.value)" />
                </div>
              </div>

              <div class="form-group">
                <label class="label">Universal Background Image <span class="text-muted">(max 1MB)</span></label>
                <div class="upload-area" id="bg-upload-area">
                  <input type="file" accept="image/*" onchange="Editor._uploadGlobalImage(event, 'themeBgImage')" id="bg-image-input" />
                  <div class="upload-placeholder" id="bg-placeholder">
                    <i data-lucide="image" class="icon-xl" style="opacity:0.4;display:block;margin:0 auto 8px"></i>
                    Click to upload background image
                  </div>
                  <img class="upload-preview-img hidden" id="bg-preview" alt="Background" />
                </div>
              </div>

              <div class="form-group">
                <label class="label">Universal Logo Image <span class="text-muted">(top-right)</span></label>
                <div class="upload-area" id="logo-upload-area">
                  <input type="file" accept="image/*" onchange="Editor._uploadGlobalImage(event, 'themeLogo')" id="logo-image-input" />
                  <div class="upload-placeholder" id="logo-placeholder">
                    <i data-lucide="building-2" class="icon-xl" style="opacity:0.4;display:block;margin:0 auto 8px"></i>
                    Click to upload company logo
                  </div>
                  <img class="upload-preview-img hidden" id="logo-preview" alt="Logo" />
                </div>
              </div>
            </div>

            <!-- PRESENTATION SETTINGS -->
            <div class="inspector-section">
              <div class="inspector-section-title">
                <i data-lucide="monitor" class="icon-sm"></i> Presentation Screen
              </div>
              <div class="form-group toggle-wrap">
                <span class="toggle-label">Show QR Sidebar</span>
                <label class="toggle">
                  <input type="checkbox" id="pres-show-qr" onchange="Editor._togglePresSetting('showQR', this.checked)">
                  <div class="toggle-track"></div>
                  <div class="toggle-thumb"></div>
                </label>
              </div>
              <div class="form-group toggle-wrap">
                <span class="toggle-label">Show Chart on Big Screen</span>
                <label class="toggle">
                  <input type="checkbox" id="pres-show-results" onchange="Editor._togglePresSetting('showResults', this.checked)">
                  <div class="toggle-track"></div>
                  <div class="toggle-thumb"></div>
                </label>
              </div>
            </div>
          </div>
        </aside>
      </div>
    `;

    _renderSlideList();
    _updateCanvas();
    _populateInspector();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // ── Slide Navigator ──
  function _renderSlideList() {
    const state = State.get();
    const list = document.getElementById('slide-list');
    if (!list) return;
    list.innerHTML = '';

    state.slides.forEach((slide, i) => {
      const status = state.pollStatus[slide.id] || 'pending';
      const votes = State.getTotalVotes(slide.id);
      const slideType = slide.type || 'poll';
      const total = state.slides.length;
      const typeBadge = slideType !== 'poll'
        ? `<span class="slide-thumb-type ${slideType}">${slideType}</span>`
        : '';
      const el = document.createElement('div');
      el.className = `slide-thumb ${i === state.activeSlideIndex ? 'active' : ''}`;
      el.onclick = () => { State.set({ activeSlideIndex: i }); Editor._refresh(); };
      el.innerHTML = `
        <div class="slide-thumb-number">${i + 1}</div>
        <div class="slide-thumb-status ${status}"></div>
        ${typeBadge}
        <div class="slide-thumb-question">${_truncate(slide.question, 45)}</div>
        <div style="font-size:9px;color:rgba(255,255,255,0.5);display:flex;align-items:center;gap:2px;margin-top:2px">
          ${slideType === 'poll' || slideType === 'rating' ? `<i data-lucide="check-square" style="width:9px;height:9px"></i> ${votes}` : ''}
        </div>
        <div class="slide-thumb-move">
          <button class="slide-thumb-move-btn" title="Move up"
            onclick="event.stopPropagation(); Editor._moveSlide(${i}, -1)"
            ${i === 0 ? 'disabled' : ''}>&#9650;</button>
          <button class="slide-thumb-move-btn" title="Move down"
            onclick="event.stopPropagation(); Editor._moveSlide(${i}, 1)"
            ${i === total - 1 ? 'disabled' : ''}>&#9660;</button>
        </div>
        <button class="slide-thumb-delete" onclick="event.stopPropagation(); Editor._deleteSlide(${i})" title="Delete slide">
          <i data-lucide="x" style="width:10px;height:10px"></i>
        </button>
      `;
      // Apply bg color
      el.style.background = slide.bgColor || '#1a2547';
      list.appendChild(el);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: Array.from(list.querySelectorAll('[data-lucide]')) });
  }

  // ── Canvas ──
  function _updateCanvas() {
    const state = State.get();
    const slide = State.getActiveSlide();
    if (!slide) return;

    const bg = document.getElementById('canvas-bg');
    const questionEl = document.getElementById('canvas-question');
    const chartArea = document.getElementById('canvas-chart-area');
    const pollBtn = document.getElementById('canvas-poll-btn');
    const voteNum = document.getElementById('canvas-vote-num');
    const logoEl = document.getElementById('canvas-logo');

    if (!bg || !questionEl) return;

    // Background
    if (slide.bgImage) {
      bg.style.backgroundImage = `url(${slide.bgImage})`;
      bg.style.backgroundSize = 'cover';
      bg.style.backgroundPosition = 'center';
      bg.style.backgroundColor = '';
    } else if (state.presSettings?.themeBgImage) {
      bg.style.backgroundImage = `url(${state.presSettings.themeBgImage})`;
      bg.style.backgroundSize = 'cover';
      bg.style.backgroundPosition = 'center';
      bg.style.backgroundColor = '';
    } else {
      bg.style.backgroundImage = '';
      bg.style.backgroundColor = slide.bgColor || state.presSettings?.themeBgColor || '#1a2547';
    }

    // Question
    questionEl.textContent = slide.question || 'No question set';
    questionEl.style.color = state.presSettings?.themeTextColor || '#ffffff';
    questionEl.style.fontFamily = state.presSettings?.themeFontFamily || 'Inter';

    // Subtitle (canvas preview)
    const canvasSubEl = document.getElementById('canvas-subtitle');
    if (canvasSubEl) {
      canvasSubEl.textContent = slide.subtitle || '';
      canvasSubEl.style.display = slide.subtitle ? '' : 'none';
      canvasSubEl.style.color = state.presSettings?.themeTextColor || '#ffffff';
    }

    // Logo
    const logoSrc = slide.logoImage || state.presSettings?.themeLogo;
    if (logoSrc) {
      logoEl.src = logoSrc;
      logoEl.classList.remove('hidden');
    } else {
      logoEl.classList.add('hidden');
    }

    // ── Slide-type specific rendering ──
    const slideType = slide.type || 'poll';

    if (slideType === 'text') {
      // Text slide: show body, hide poll button & vote count
      if (chartArea) chartArea.innerHTML = `<div class="canvas-text-body" style="color:${state.presSettings?.themeTextColor||'#ffffff'};">${_escAttr(slide.body||'')}</div>`;
      if (pollBtn) pollBtn.style.display = 'none';
      if (voteNum) voteNum.parentElement.style.display = 'none';
      return;
    }

    if (slideType === 'qr') {
      // QR slide: render live QR
      if (pollBtn) pollBtn.style.display = 'none';
      if (voteNum) voteNum.parentElement.style.display = 'none';
      if (chartArea) {
        chartArea.innerHTML = `<div class="canvas-qr-preview" id="canvas-qr-inner"></div>`;
        const qrEl = document.getElementById('canvas-qr-inner');
        if (qrEl) QRHelper.renderPresQR(qrEl, state.sessionCode || '------', 120);
      }
      return;
    }

    if (slideType === 'rating') {
      // Rating slide: show star distribution preview
      if (pollBtn) pollBtn.style.display = '';
      if (voteNum) voteNum.parentElement.style.display = '';
      const counts = State.getVoteCounts(slide.id);
      const total = State.getTotalVotes(slide.id);
      if (chartArea) _renderRatingChart(chartArea, slide, counts, total, state.presSettings?.themeTextColor || '#ffffff');
      const status = state.pollStatus[slide.id] || 'pending';
      pollBtn.className = `canvas-overlay-btn poll-${status}`;
      if (status === 'open') {
        pollBtn.innerHTML = '<i data-lucide="circle-stop" class="icon-md"></i> Poll Open — Click to Stop';
      } else if (status === 'closed') {
        pollBtn.innerHTML = '<i data-lucide="rotate-ccw" class="icon-md"></i> Poll Closed — Click to Reopen';
      } else {
        pollBtn.innerHTML = '<i data-lucide="play" class="icon-md"></i> Start Rating';
      }
      if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [pollBtn] });
      if (voteNum) voteNum.textContent = total;
      const counts2 = State.getVoteCounts(slide.id);
      _updateStats(slide, state, counts2, total);
      return;
    }

    // Default poll slide
    if (pollBtn) pollBtn.style.display = '';
    if (voteNum) voteNum.parentElement.style.display = '';
    const status = state.pollStatus[slide.id] || 'pending';
    pollBtn.className = `canvas-overlay-btn poll-${status}`;
    if (status === 'open') {
      pollBtn.innerHTML = '<i data-lucide="circle-stop" class="icon-md"></i> Poll Open — Click to Stop';
    } else if (status === 'closed') {
      pollBtn.innerHTML = '<i data-lucide="rotate-ccw" class="icon-md"></i> Poll Closed — Click to Reopen';
    } else {
      pollBtn.innerHTML = '<i data-lucide="play" class="icon-md"></i> Start Poll';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [pollBtn] });

    const total = State.getTotalVotes(slide.id);
    if (voteNum) voteNum.textContent = total;

    const counts = State.getVoteCounts(slide.id);
    const visColours = state.presSettings?.themeVisColours;
    const txtColor = state.presSettings?.themeTextColor || '#ffffff';

    if (slide.layout === 'donut') {
      Charts.renderDonut(chartArea, slide, counts, 'percent', txtColor, visColours);
    } else if (slide.layout === 'pie') {
      Charts.renderPie(chartArea, slide, counts, 'percent', txtColor, visColours);
    } else {
      Charts.renderBars(chartArea, slide, counts, 'percent', txtColor, visColours);
    }

    _updateStats(slide, state, counts, total);
  }

  function _renderRatingChart(container, slide, counts, total, textColor) {
    const maxStars = slide.maxStars || 5;
    const avg = total > 0
      ? counts.reduce((s, c, i) => s + c * (i + 1), 0) / total
      : 0;
    container.innerHTML = `
      <div class="canvas-rating-preview">
        <div class="canvas-rating-avg" style="color:${textColor}">${avg > 0 ? avg.toFixed(1) : '—'}</div>
        <div class="canvas-rating-stars">${Array.from({length:maxStars},(_,i)=>`<span class="canvas-star ${i < Math.round(avg) ? 'filled':''}">★</span>`).join('')}</div>
        <div class="canvas-rating-votes" style="color:${textColor}">${total} rating${total!==1?'s':''}</div>
        <div class="canvas-rating-bars">
          ${Array.from({length:maxStars},(_,i)=>{
            const star = maxStars - i;
            const c = counts[star-1]||0;
            const pct = total>0 ? Math.round((c/total)*100) : 0;
            return `<div class="canvas-rating-row">
              <span class="canvas-rating-row-label" style="color:${textColor}">${star}★</span>
              <div class="canvas-rating-row-track"><div class="canvas-rating-row-fill" style="width:${pct}%;background:#f59e0b"></div></div>
              <span class="canvas-rating-row-pct" style="color:${textColor}">${pct}%</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  function _updateStats(slide, state, counts, total) {
    const statusEl = document.getElementById('stat-status');
    const voteEl = document.getElementById('stat-votes');
    const leaderEl = document.getElementById('stat-leader');
    const partCount = document.getElementById('topbar-participant-count');

    if (statusEl) {
      const s = state.pollStatus[slide.id] || 'pending';
      statusEl.textContent = s.charAt(0).toUpperCase() + s.slice(1);
      statusEl.style.color = s === 'open' ? 'var(--accent-success)' : s === 'closed' ? 'var(--accent-danger)' : 'var(--text-muted)';
    }
    if (voteEl) voteEl.textContent = total;
    if (leaderEl) {
      const maxIdx = counts.indexOf(Math.max(...counts));
      leaderEl.textContent = total > 0 ? _truncate(slide.options[maxIdx]?.text || '—', 16) : '—';
    }
    if (partCount) partCount.textContent = _getTotalUniqueVoters(state);
  }

  // (removed duplicate _startLiveRefresh — single definition at bottom)

  // ── Inspector ──
  function _populateInspector() {
    const state = State.get();
    const slide = State.getActiveSlide();

    // Global Settings (independent of active slide)
    const bgColor = document.getElementById('prop-bg-color');
    const bgHex = document.getElementById('prop-bg-hex');
    const themeBg = state.presSettings?.themeBgColor || '#1a2547';
    if (bgColor) bgColor.value = themeBg;
    if (bgHex) bgHex.value = themeBg;

    const bgArea = document.getElementById('bg-upload-area');
    const bgPlaceholder = document.getElementById('bg-placeholder');
    const bgPreview = document.getElementById('bg-preview');
    if (state.presSettings?.themeBgImage) {
      bgArea?.classList.add('has-image');
      bgPlaceholder?.classList.add('hidden');
      if (bgPreview) { bgPreview.src = state.presSettings.themeBgImage; bgPreview.classList.remove('hidden'); }
    } else {
      bgArea?.classList.remove('has-image');
      bgPlaceholder?.classList.remove('hidden');
      bgPreview?.classList.add('hidden');
    }

    const logoArea = document.getElementById('logo-upload-area');
    const logoPlaceholder = document.getElementById('logo-placeholder');
    const logoPreview = document.getElementById('logo-preview');
    if (state.presSettings?.themeLogo) {
      logoArea?.classList.add('has-image');
      logoPlaceholder?.classList.add('hidden');
      if (logoPreview) { logoPreview.src = state.presSettings.themeLogo; logoPreview.classList.remove('hidden'); }
    } else {
      logoArea?.classList.remove('has-image');
      logoPlaceholder?.classList.remove('hidden');
      logoPreview?.classList.add('hidden');
    }

    _setToggle('pres-show-qr', state.presSettings?.showQR);
    _setToggle('pres-show-results', state.presSettings?.showResults);

    // Slide-specific Settings
    if (!slide) return;

    const qEl = document.getElementById('prop-question');
    if (qEl) qEl.value = slide.question || '';

    const subEl = document.getElementById('prop-subtitle');
    if (subEl) subEl.value = slide.subtitle || '';

    const slideType = slide.type || 'poll';

    // Show/hide slide-type-specific inspector panels
    const pollPane = document.getElementById('inspector-poll-pane');
    const ratingPane = document.getElementById('inspector-rating-pane');
    const textPane = document.getElementById('inspector-text-pane');
    const qrPane = document.getElementById('inspector-qr-pane');

    if (pollPane)   pollPane.classList.toggle('hidden', slideType !== 'poll');
    if (ratingPane) ratingPane.classList.toggle('hidden', slideType !== 'rating');
    if (textPane)   textPane.classList.toggle('hidden', slideType !== 'text');
    if (qrPane)     qrPane.classList.toggle('hidden', slideType !== 'qr');

    if (slideType === 'poll') {
      _renderOptionsList(slide);
      _setToggle('toggle-multi', slide.multiSelect);
      _setToggle('toggle-timer', slide.timerEnabled);
      _setToggle('toggle-locked', slide.locked);
      _setToggle('toggle-show-results', slide.showResultsToAudience);
      document.getElementById('max-picks-row')?.classList.toggle('hidden', !slide.multiSelect);
      document.getElementById('timer-seconds-row')?.classList.toggle('hidden', !slide.timerEnabled);
      const maxPicks = document.getElementById('prop-max-picks');
      if (maxPicks) maxPicks.value = slide.maxPicks || 2;
      const timer = document.getElementById('prop-timer');
      if (timer) timer.value = slide.timerSeconds || 60;
      document.querySelectorAll('.layout-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layout === slide.layout);
      });
    } else if (slideType === 'rating') {
      _setToggle('toggle-timer', slide.timerEnabled);
      _setToggle('toggle-locked', slide.locked);
      _setToggle('toggle-show-results', slide.showResultsToAudience);
    } else if (slideType === 'text') {
      const bodyEl = document.getElementById('prop-text-body');
      if (bodyEl) bodyEl.value = slide.body || '';
    }
    // QR: subtitle handled by shared prop-subtitle field above
  }

  function _renderOptionsList(slide) {
    const list = document.getElementById('options-list');
    if (!list) return;
    list.innerHTML = '';

    slide.options.forEach((opt, i) => {
      const item = document.createElement('div');
      item.className = 'option-item';
      item.innerHTML = `
        <div class="option-color-dot" style="background:${opt.color}"></div>
        <input type="text" class="input option-input" value="${_escAttr(opt.text)}"
          oninput="Editor._updateOption(${i}, 'text', this.value)"
          placeholder="Option ${i + 1}" />
        <button class="option-delete-btn" onclick="Editor._deleteOption(${i})" title="Remove option">✕</button>
      `;
      list.appendChild(item);
    });
  }

  // ── Live Refresh ──
  // (removed duplicate _startLiveRefresh — single definition at bottom)

  // ── Property Updates ──
  function _updateProp(key, value) {
    _isEditing = true;
    const i = State.get().activeSlideIndex;
    State.updateSlide(i, { [key]: value });
    _updateCanvasDebounced();

    if (key === 'multiSelect') {
      document.getElementById('max-picks-row')?.classList.toggle('hidden', !value);
    }
    if (key === 'timerEnabled') {
      document.getElementById('timer-seconds-row')?.classList.toggle('hidden', !value);
    }
    if (key === 'bgColor') {
      const hexInput = document.getElementById('prop-bg-hex');
      if (hexInput) hexInput.value = value;
    }
    // Clear editing flag after a short delay (allows subscriber to skip)
    clearTimeout(_editingTimeout);
    _editingTimeout = setTimeout(() => { _isEditing = false; }, 300);
  }

  function _updateCanvasDebounced() {
    clearTimeout(chartUpdateTimeout);
    chartUpdateTimeout = setTimeout(() => _updateCanvas(), 80);
  }

  function _onHexInput(value) {
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      const colorInput = document.getElementById('prop-bg-color');
      if (colorInput) colorInput.value = value;
      _togglePresSetting('themeBgColor', value);
    }
  }

  let _editingTimeout = null;

  function _updateOption(index, key, value) {
    _isEditing = true;
    const slide = State.getActiveSlide();
    if (!slide) return;
    const options = slide.options.map((o, i) => i === index ? { ...o, [key]: value } : o);
    const slideIdx = State.get().activeSlideIndex;
    State.updateSlide(slideIdx, { options });
    _updateCanvasDebounced();
    // Clear editing flag after a short delay
    clearTimeout(_editingTimeout);
    _editingTimeout = setTimeout(() => { _isEditing = false; }, 300);
  }

  function _addOption() {
    const slide = State.getActiveSlide();
    if (!slide) return;
    if (slide.options.length >= 8) { Toast.show('Maximum 8 options allowed', 'warning'); return; }
    const color = OPTION_COLORS[slide.options.length % OPTION_COLORS.length];
    const options = [...slide.options, { text: `Option ${slide.options.length + 1}`, color }];
    const i = State.get().activeSlideIndex;
    State.updateSlide(i, { options });
    _renderOptionsList({ ...slide, options });
    _updateCanvasDebounced();
  }

  function _deleteOption(index) {
    const slide = State.getActiveSlide();
    if (!slide || slide.options.length <= 2) { Toast.show('Minimum 2 options required', 'warning'); return; }
    const options = slide.options.filter((_, i) => i !== index);
    const slideIdx = State.get().activeSlideIndex;
    State.updateSlide(slideIdx, { options });
    _renderOptionsList({ ...slide, options });
    _updateCanvasDebounced();
  }

  function _setLayout(layout) {
    const i = State.get().activeSlideIndex;
    State.updateSlide(i, { layout });
    document.querySelectorAll('.layout-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layout === layout);
    });
    _updateCanvasDebounced();
  }

  // ── Image Uploads ──
  function _uploadGlobalImage(event, key) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { Toast.show('Image must be under 1MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      _togglePresSetting(key, e.target.result);
      _refresh();
    };
    reader.readAsDataURL(file);
  }

  // ── Slide Management ──
  function _addSlide(type = 'poll') {
    State.addSlide(type);
    _refresh();
    const labels = { poll: 'Poll slide', rating: 'Rating slide', text: 'Text slide', qr: 'QR slide' };
    Toast.show(`${labels[type] || 'Slide'} added`, 'success');
  }

  function _moveSlide(index, direction) {
    State.moveSlide(index, direction);
    _refresh();
  }

  function _deleteSlide(index) {
    if (State.get().slides.length <= 1) { Toast.show('Cannot delete the last slide', 'warning'); return; }
    if (!confirm('Delete this slide? All votes will be lost.')) return;
    State.deleteSlide(index);
    _refresh();
    Toast.show('Slide deleted', 'info');
  }

  // ── Poll Control ──
  function _togglePoll() {
    const slide = State.getActiveSlide();
    if (!slide) return;
    const current = State.get().pollStatus[slide.id] || 'pending';
    const next = current === 'open' ? 'closed' : 'open';
    State.setPollStatus(slide.id, next);
    _updateCanvas();
    Toast.show(next === 'open' ? '🟢 Poll opened — participants can now vote' : '🔴 Poll closed', next === 'open' ? 'success' : 'info');
  }

  // ── Actions ──
  function _clearResults() {
    const slide = State.getActiveSlide();
    if (!slide) return;
    if (!confirm('Clear all votes for this slide?')) return;
    const votes = { ...State.get().votes, [slide.id]: {} };
    State.set({ votes });
    State.setPollStatus(slide.id, 'pending');
    _updateCanvas();
    Toast.show('Results cleared', 'info');
  }

  function _present() {
    App.navigate('presentation');
  }

  function _copyCode() {
    const code = State.get().sessionCode;
    navigator.clipboard.writeText(code).then(() => Toast.show(`Session code ${code} copied!`, 'info'));
  }

  function _exportCSV() {
    const slide = State.getActiveSlide();
    if (!slide) return;
    const csv = State.exportCSV(slide.id);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slidemeter_${slide.id}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.show('CSV exported successfully', 'success');
  }

  function _refresh() {
    render();
  }

  // ── Helpers ──
  function _setToggle(id, value) {
    const el = document.getElementById(id);
    if (el) el.checked = !!value;
  }

  function _togglePresSetting(key, val) {
    const s = { ...State.get().presSettings, [key]: val };
    State.set({ presSettings: s });
  }

  function _switchTab(tab) {
    currentTab = tab;
    _refresh();
  }

  function _startLiveRefresh() {
    State.subscribe((state, changed) => {
      // Only refresh if editor is currently active
      if (!document.getElementById('screen-editor')?.classList.contains('active')) return;

      // Skip full re-render while user is actively typing in inputs
      if (_isEditing) {
        _updateCanvasDebounced();
        _renderSlideList();
        return;
      }

      // If active slide index changed, full re-render needed
      if (changed.activeSlideIndex || changed.pollStatus) {
        _refresh();
      } else if (changed.slides) {
        // Slides changed but not from editing — update canvas + slide list
        _renderSlideList();
        _updateCanvas();
      } else if (changed.votes) {
        // Only votes changed — just update the canvas charts
        _updateCanvas();
      }
    });
  }

  function _getTotalUniqueVoters(state) {
    const all = new Set();
    Object.values(state.votes || {}).forEach(sv => Object.keys(sv).forEach(h => all.add(h)));
    return all.size;
  }

  function _truncate(str, len) {
    return str && str.length > len ? str.slice(0, len) + '…' : str;
  }

  function _escAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return {
    render, _refresh,
    _addSlide, _moveSlide, _deleteSlide,
    _togglePoll, _clearResults, _present, _copyCode, _exportCSV,
    _updateProp, _updateOption, _addOption, _deleteOption,
    _setLayout, _onHexInput,
    _uploadGlobalImage,
    _updateCanvasDebounced,
    _switchTab,
    _togglePresSetting,
    _startLiveRefresh,
    _shareQR: () => QRHelper.showShareModal(),
  };
})();

// Initialize editor live sync once
Editor._startLiveRefresh();

// Expose _getTotalUniqueVoters on State
function _getTotalUniqueVoters(state) {
  const all = new Set();
  Object.values(state.votes || {}).forEach(sv => Object.keys(sv).forEach(h => all.add(h)));
  return all.size;
}
