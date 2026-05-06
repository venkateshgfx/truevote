/**
 * SlideMeter — Participant Experience
 * Mobile-first reactive polling interface
 */

const Participant = (() => {
  let selectedOptions = [];
  let hasVoted = false;
  let liveInterval = null;
  let lastSlideId = null;
  let lastPollStatus = null;


  function render() {
    const el = document.getElementById('screen-participant');
    const state = State.get();
    const user = state.user;
    const hashDisplay = user?.userHash ? user.userHash.slice(0,12) + '…' : '—';

    // Show the presenter's logo if configured, otherwise no logo section
    const presLogo = state.presSettings?.themeLogo;
    const logoHTML = presLogo
      ? `<div class="part-header-logo">
           <img src="${presLogo}" class="part-header-pres-logo" alt="Presentation logo" />
         </div>`
      : `<div class="part-header-logo"></div>`; // empty placeholder for flex spacing

    el.innerHTML = `
      <header class="part-header">
        ${logoHTML}
        <div class="part-user-info">
          <span class="part-user-email" title="${user?.email || ''}">
            <i data-lucide="user" class="icon-xs"></i> ${user?.email || 'Anonymous'}
          </span>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="App.navigate('auth')" title="Leave session">
            <i data-lucide="log-out" class="icon-sm"></i>
          </button>
        </div>
      </header>
      <div class="part-content" id="part-content"></div>
    `;

    _resetState();
    _renderContent();
    _startPolling();
  }

  function _resetState() {
    selectedOptions = [];
    hasVoted = false;
    lastSlideId = null;
    lastPollStatus = null;
  }

  function _renderContent() {
    const state = State.get();
    const slide = State.getActiveSlide();
    const content = document.getElementById('part-content');
    const screen = document.getElementById('screen-participant');
    if (!content || !screen) return;

    // Only apply custom font — keep the light-mode background intact.
    // DO NOT apply presenter's dark bg/text colors to the participant screen.
    if (state.presSettings?.themeFontFamily) {
      screen.style.fontFamily = state.presSettings.themeFontFamily;
    }

    // Apply logo to header icon if custom logo exists
    const logoIcon = document.querySelector('.part-header-logo-icon');
    if (logoIcon && state.presSettings?.themeLogo) {
      logoIcon.innerHTML = `<img src="${state.presSettings.themeLogo}" style="width:100%;height:100%;object-fit:contain;" />`;
      logoIcon.style.background = 'transparent';
    }

    if (!slide) {
      const sessionCode = state.sessionCode || '------';
      const presLogo    = state.presSettings?.themeLogo;
      const userName    = state.user?.email?.split('@')[0] || 'there';

      content.innerHTML = `
        <div class="part-lobby">

          ${presLogo ? `
            <div class="part-lobby-logo">
              <img src="${presLogo}" alt="Presentation logo" />
            </div>` : `
            <div class="part-lobby-icon">
              <i data-lucide="bar-chart-2" class="icon-2xl" style="color:#fff"></i>
            </div>`
          }

          <div class="part-lobby-greeting">
            Welcome, <strong>${_escHtml(userName)}</strong>! 👋
          </div>

          <div class="part-lobby-status">
            <div class="part-lobby-status-dot"></div>
            Waiting for presenter to begin…
          </div>

          <div class="part-lobby-code-card">
            <div class="part-lobby-code-label">
              <i data-lucide="hash" class="icon-xs"></i> Your Session Code
            </div>
            <div class="part-lobby-code">${sessionCode}</div>
          </div>

          <div class="part-lobby-instructions">
            <div class="part-lobby-instructions-title">
              <i data-lucide="info" class="icon-sm"></i> How it works
            </div>
            <ol class="part-lobby-steps">
              <li>
                <span class="step-num">1</span>
                <span>Keep this tab open — polls will appear automatically when the presenter starts</span>
              </li>
              <li>
                <span class="step-num">2</span>
                <span>Select your answer when a question appears and tap <strong>Submit</strong></span>
              </li>
              <li>
                <span class="step-num">3</span>
                <span>Your vote is saved securely — you can't vote twice on the same question</span>
              </li>
            </ol>
          </div>

          <div class="part-lobby-pulse">
            <div class="waiting-dot"></div>
            <div class="waiting-dot"></div>
            <div class="waiting-dot"></div>
          </div>

        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    const status = state.pollStatus[slide.id] || 'pending';
    const userHash = state.user?.userHash || '';
    const slideVotes = state.votes[slide.id] || {};
    const alreadyVoted = !!slideVotes[userHash];
    const slideType = slide.type || 'poll';

    // ── Text slide ── (information only, no voting)
    if (slideType === 'text') {
      content.innerHTML = `
        <div class="part-slide-info">
          <span class="part-slide-num">Slide ${state.activeSlideIndex + 1} of ${state.slides.length}</span>
          <span class="part-poll-status-badge" style="background:rgba(99,102,241,0.15);color:#a5b4fc">
            <span class="status-badge-dot" style="background:#6366f1"></span> Info
          </span>
        </div>
        <div class="part-text-slide">
          <div class="part-text-title">${_escHtml(slide.question)}</div>
          <div class="part-text-body">${_escHtml(slide.body || '')}</div>
        </div>`;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    // ── QR slide ── (shows join QR code)
    if (slideType === 'qr') {
      content.innerHTML = `
        <div class="part-slide-info">
          <span class="part-slide-num">Slide ${state.activeSlideIndex + 1} of ${state.slides.length}</span>
        </div>
        <div class="part-qr-slide">
          <div class="part-qr-title">${_escHtml(slide.question)}</div>
          ${slide.subtitle ? `<div class="part-qr-subtitle">${_escHtml(slide.subtitle)}</div>` : ''}
          <div class="part-qr-box" id="part-qr-code-box"></div>
          <div class="part-qr-code-label">${state.sessionCode || '------'}</div>
        </div>`;
      requestAnimationFrame(() => {
        const box = document.getElementById('part-qr-code-box');
        if (box) QRHelper.renderPresQR(box, state.sessionCode || '------', 200);
      });
      return;
    }

    // ── Rating slide ──
    if (slideType === 'rating') {
      // Reset state if slide changed
      if (lastSlideId !== slide.id) {
        selectedOptions = [];
        hasVoted = alreadyVoted;
        lastSlideId = slide.id;
        _ratingShowResults = false; // hide group results when slide changes
      } else {
        hasVoted = hasVoted || alreadyVoted;
      }
      lastPollStatus = status;

      const maxStars = slide.maxStars || 5;
      const counts = State.getVoteCounts(slide.id);
      const total = State.getTotalVotes(slide.id);
      const avg = total > 0 ? counts.reduce((s,c,i)=>s+c*(i+1),0)/total : 0;
      const myRating = alreadyVoted ? (slideVotes[userHash]?.options?.[0] ?? -1) : (selectedOptions[0] ?? -1);
      const pollOpen = status === 'open' && !hasVoted && !alreadyVoted && !slide.locked;
      const voted = hasVoted || alreadyVoted;

      let feedbackHTML = '';
      if (voted) {
        const starLabel = myRating >= 0 ? `You gave ${myRating + 1} ★` : 'Your rating was recorded.';
        feedbackHTML = `
          <div class="part-feedback success">
            <span class="part-feedback-icon"><i data-lucide="check-circle" class="icon-md"></i></span>
            <span>${starLabel} — Thank you!</span>
          </div>`;
      } else if (status === 'closed' && !voted) {
        feedbackHTML = `
          <div class="part-feedback error">
            <span class="part-feedback-icon"><i data-lucide="lock" class="icon-md"></i></span>
            <span>Rating period is now closed.</span>
          </div>`;
      }

      // Your own star display (after voting — stars are filled up to myRating, disabled)
      const starsHTML = `
        <div class="part-star-rating ${!pollOpen ? 'voted' : ''}" id="part-stars">
          ${Array.from({length:maxStars},(_,i)=>`
            <button class="part-star-btn ${i <= myRating ? 'active' : ''}"
              data-star="${i}"
              ${!pollOpen ? 'disabled' : ''}
              aria-label="${i+1} star">&#9733;</button>`).join('')}
        </div>`;



      content.innerHTML = `
        <div class="part-slide-info">
          <span class="part-slide-num">Slide ${state.activeSlideIndex + 1} of ${state.slides.length}</span>
          <span class="part-poll-status-badge ${status}">
            <span class="status-badge-dot"></span>
            ${status === 'open' ? 'Rating Open' : status === 'closed' ? 'Rating Closed' : 'Not Started'}
          </span>
        </div>
        ${status === 'pending' ? `<div class="part-waiting" style="min-height:50vh">
          <div class="waiting-animation"><div class="waiting-ring"></div><div class="waiting-ring"></div><div class="waiting-ring"></div>
            <div class="waiting-icon"><i data-lucide="star" class="icon-xl" style="color:var(--text-muted)"></i></div>
          </div>
          <div class="waiting-title">Waiting for Presenter</div>
          <div class="waiting-subtitle">${_escHtml(slide.question)}</div>
          <div class="waiting-pulse-dots"><div class="waiting-dot"></div><div class="waiting-dot"></div><div class="waiting-dot"></div></div>
        </div>` : `
        <div class="part-question">${_escHtml(slide.question)}</div>
        ${slide.subtitle ? `<div class="part-slide-subtitle">${_escHtml(slide.subtitle)}</div>` : ''}
        ${feedbackHTML}
        ${starsHTML}
        ${pollOpen && myRating >= 0 ? `
          <button class="btn btn-primary btn-lg part-submit-btn" id="part-rating-submit-btn">
            Submit Rating (${myRating+1} &#9733;)
          </button>` : ''}

        `}`;

      if (typeof lucide !== 'undefined') lucide.createIcons();

      // ── Wire up star clicks via direct JS (never inline onclick) ──
      const starsEl = document.getElementById('part-stars');
      if (starsEl && pollOpen) {
        starsEl.addEventListener('click', function(e) {
          const btn = e.target.closest('[data-star]');
          if (!btn || btn.disabled) return;
          const idx = parseInt(btn.dataset.star, 10);
          if (!isNaN(idx)) _selectStar(idx);
        });
      }

      // ── Wire up submit button ──
      const submitBtnEl = document.getElementById('part-rating-submit-btn');
      if (submitBtnEl) submitBtnEl.addEventListener('click', _submitVote);



      return;
    }

    // ── Default: poll slide ──
    // Reset local state if slide changed
    if (lastSlideId !== slide.id) {
      selectedOptions = [];
      hasVoted = alreadyVoted;
      lastSlideId = slide.id;
    } else {
      hasVoted = hasVoted || alreadyVoted;
    }
    lastPollStatus = status;

    if (status === 'pending') {
      content.innerHTML = `
        <div class="part-slide-info">
          <span class="part-slide-num">Slide ${state.activeSlideIndex + 1} of ${state.slides.length}</span>
          <span class="part-poll-status-badge pending">
            <span class="status-badge-dot"></span> Not Started
          </span>
        </div>
        <div class="part-waiting" style="min-height:50vh">
          <div class="waiting-animation">
            <div class="waiting-ring"></div>
            <div class="waiting-ring"></div>
            <div class="waiting-ring"></div>
            <div class="waiting-icon">
              <i data-lucide="clock" class="icon-xl" style="color:var(--text-muted)"></i>
            </div>
          </div>
          <div class="waiting-title">Waiting for Presenter</div>
          <div class="waiting-subtitle">${_escHtml(slide.question)}</div>
          <div class="waiting-pulse-dots">
            <div class="waiting-dot"></div>
            <div class="waiting-dot"></div>
            <div class="waiting-dot"></div>
          </div>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    const counts = State.getVoteCounts(slide.id);
    const total = State.getTotalVotes(slide.id);
    const showResults = slide.showResultsToAudience && (hasVoted || alreadyVoted);
    const isMulti = slide.multiSelect;
    const maxPicks = slide.maxPicks || 1;
    const votedOptions = alreadyVoted ? (slideVotes[userHash]?.options || []) : selectedOptions;
    const pollOpen = status === 'open' && !hasVoted && !alreadyVoted && !slide.locked;

    // Timer
    let timerHTML = '';
    if (slide.timerEnabled && status === 'open' && !hasVoted) {
      timerHTML = `
        <div class="part-timer-bar">
          <div class="part-timer-fill" style="width:100%"></div>
        </div>
      `;
    }

    // Feedback
    let feedbackHTML = '';
    if (alreadyVoted || hasVoted) {
      feedbackHTML = `
        <div class="part-feedback success">
          <span class="part-feedback-icon"><i data-lucide="check-circle" class="icon-md"></i></span>
          <span>Your response for this slide has been recorded.</span>
        </div>
      `;
    } else if (status === 'closed' && !hasVoted) {
      feedbackHTML = `
        <div class="part-feedback error">
          <span class="part-feedback-icon"><i data-lucide="lock" class="icon-md"></i></span>
          <span>This poll is now closed. Voting is no longer accepted.</span>
        </div>
      `;
    }

    // Options HTML
    const optionsHTML = slide.options.map((opt, i) => {
      const isSelected = votedOptions.includes(i);
      const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
      const isDisabled = !pollOpen || (isMulti && selectedOptions.length >= maxPicks && !selectedOptions.includes(i));

      let metaHTML = '';
      if (showResults) {
        metaHTML = `
          <div class="part-option-meta">
            <span class="part-option-pct">${pct}%</span>
            <span class="part-option-votes">${counts[i]}</span>
          </div>
        `;
      }

      return `
        <div class="part-option ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''} ${!pollOpen ? 'voted' : ''} ${isMulti ? 'multi' : ''}"
          id="opt-${i}"
          onclick="Participant._selectOption(${i})"
          role="button"
          aria-pressed="${isSelected}"
          tabindex="${pollOpen ? '0' : '-1'}">
          ${showResults ? `<div class="part-option-progress" style="width:${pct}%"></div>` : ''}
          <div class="part-option-check">${isSelected ? '✓' : ''}</div>
          <div class="part-option-color" style="background:${opt.color}"></div>
          <div class="part-option-text">${_escHtml(opt.text)}</div>
          ${metaHTML}
        </div>
      `;
    }).join('');

    // Multi-select hint
    let hintHTML = '';
    if (isMulti && pollOpen) {
      hintHTML = `<div class="part-hint">Select up to <strong>${maxPicks} options</strong> (${selectedOptions.length} / ${maxPicks} chosen)</div>`;
    }

    // Submit button (for multi-select)
    let submitHTML = '';
    if (isMulti && pollOpen) {
      const disabled = selectedOptions.length === 0 ? 'disabled' : '';
      submitHTML = `
        <button class="btn btn-primary btn-lg part-submit-btn" id="part-submit-btn" ${disabled}
          onclick="Participant._submitVote()">
          Submit Vote (${selectedOptions.length} selected)
        </button>
      `;
    }

    // Results section
    let resultsHTML = '';
    if (showResults) {
      resultsHTML = `
        <div class="part-results-title">
          <i data-lucide="bar-chart-3" class="icon-sm"></i> Live Results (${total} votes)
        </div>
        <div id="part-mini-chart"></div>
      `;
    }

    content.innerHTML = `
      <div class="part-slide-info">
        <span class="part-slide-num">Slide ${state.activeSlideIndex + 1} of ${state.slides.length}</span>
        <span class="part-poll-status-badge ${status}">
          <span class="status-badge-dot"></span>
          ${status === 'open' ? 'Poll Open' : 'Poll Closed'}
        </span>
      </div>

      ${timerHTML}

      <div class="part-question">${_escHtml(slide.question)}</div>
      ${slide.subtitle ? `<div class="part-slide-subtitle">${_escHtml(slide.subtitle)}</div>` : ''}

      ${feedbackHTML}

      <div class="part-options" id="part-options">
        ${optionsHTML}
      </div>

      ${hintHTML}
      ${submitHTML}
      ${resultsHTML}
    `;

    // Render mini chart
    if (showResults) {
      const miniChart = document.getElementById('part-mini-chart');
      if (miniChart) Charts.renderMiniBars(miniChart, slide, counts, state.presSettings?.displayMode || 'percent', state.presSettings?.themeVisColours);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }


  function _selectOption(index) {
    const state = State.get();
    const slide = State.getActiveSlide();
    if (!slide) return;

    const status = state.pollStatus[slide.id] || 'pending';
    const userHash = state.user?.userHash || '';
    const alreadyVoted = !!(state.votes[slide.id] || {})[userHash];

    if (hasVoted || alreadyVoted || status !== 'open' || slide.locked) return;

    if (slide.multiSelect) {
      if (selectedOptions.includes(index)) {
        selectedOptions = selectedOptions.filter(i => i !== index);
      } else {
        if (selectedOptions.length >= (slide.maxPicks || 1)) return;
        selectedOptions.push(index);
      }

      // Update UI
      slide.options.forEach((_, i) => {
        const el = document.getElementById(`opt-${i}`);
        if (!el) return;
        const isSelected = selectedOptions.includes(i);
        el.classList.toggle('selected', isSelected);
        const check = el.querySelector('.part-option-check');
        if (check) check.textContent = isSelected ? '✓' : '';
        // Disable if max reached and not selected
        const isMaxed = selectedOptions.length >= (slide.maxPicks || 1) && !isSelected;
        el.classList.toggle('disabled', isMaxed);
      });

      // Update hint
      const hint = document.querySelector('.part-hint');
      if (hint) hint.innerHTML = `Select up to <strong>${slide.maxPicks} options</strong> (${selectedOptions.length} / ${slide.maxPicks} chosen)`;

      // Update submit button
      const submitBtn = document.getElementById('part-submit-btn');
      if (submitBtn) {
        submitBtn.disabled = selectedOptions.length === 0;
        submitBtn.textContent = `Submit Vote (${selectedOptions.length} selected)`;
      }
    } else {
      // Single choice — select and auto-submit
      selectedOptions = [index];
      _submitVote();
    }
  }

  async function _submitVote() {
    const state = State.get();
    const slide = State.getActiveSlide();
    if (!slide || !state.user) return;

    if (selectedOptions.length === 0) {
      Toast.show('Please select an option first', 'warning');
      return;
    }

    const { userHash, email } = state.user;
    let result;

    if (API.isAvailable()) {
      // ── Server-side duplicate check (works across incognito / devices) ──
      result = await API.castVote(slide.id, userHash, selectedOptions, email);

      if (result.success) {
        // Mirror into local state so UI updates immediately
        State.castVote(slide.id, userHash, selectedOptions, email);
      }
    } else {
      // ── Fallback: localStorage-only duplicate check ──────────────────────
      result = State.castVote(slide.id, userHash, selectedOptions, email);
    }

    if (result.success) {
      hasVoted = true;
      Toast.show('✅ Vote submitted successfully!', 'success');
      _renderContent();
    } else if (result.reason === 'DUPLICATE_VOTE') {
      hasVoted = true;
      Toast.show('🛡️ Duplicate vote blocked — your vote is already recorded', 'error');
      _renderContent();
    } else {
      Toast.show('⚠️ Could not submit vote. Please try again.', 'warning');
    }
  }

  function _startPolling() {
    clearInterval(liveInterval);
    liveInterval = setInterval(() => {
      if (!document.getElementById('screen-participant')?.classList.contains('active')) {
        clearInterval(liveInterval);
        return;
      }

      const state = State.get();
      const slide = State.getActiveSlide();
      if (!slide) { _renderContent(); return; }

      const currentStatus = state.pollStatus[slide.id] || 'pending';
      const slideChanged = lastSlideId !== slide.id;
      const statusChanged = lastPollStatus !== currentStatus;

      if (slideChanged || statusChanged) {
        // Only reset selection when the actual slide changes, not just status
        if (slideChanged) { selectedOptions = []; hasVoted = false; _ratingShowResults = false; }
        _renderContent();
        return;
      }

      // Just update results if voted
      const userHash = state.user?.userHash || '';
      const alreadyVoted = !!(state.votes[slide.id] || {})[userHash];
      if ((hasVoted || alreadyVoted) && slide.showResultsToAudience) {
        const miniChart = document.getElementById('part-mini-chart');
        if (miniChart) {
          const counts = State.getVoteCounts(slide.id);
          Charts.renderMiniBars(miniChart, slide, counts, state.presSettings?.displayMode || 'percent');
        }
      }
    }, 1000);

    State.subscribe((s, changed) => {
      if (!document.getElementById('screen-participant')?.classList.contains('active')) return;
      if (changed.activeSlideIndex || changed.pollStatus || changed.slides) {
        // Only reset selection on slide navigation, not poll open/close
        if (changed.activeSlideIndex) { selectedOptions = []; hasVoted = false; _ratingShowResults = false; }
        _renderContent();
      }
    });
  }

  function _selectStar(index) {
    const state = State.get();
    const slide = State.getActiveSlide();
    if (!slide || slide.type !== 'rating') return;
    const status = state.pollStatus[slide.id] || 'pending';
    const userHash = state.user?.userHash || '';
    const alreadyVoted = !!(state.votes[slide.id] || {})[userHash];
    if (hasVoted || alreadyVoted || status !== 'open' || slide.locked) return;

    selectedOptions = [index];

    // Re-render — this will show the submit button (myRating >= 0 now)
    // and re-attach all event listeners including the new star click handler
    _renderContent();
  }


  function _escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { render, _selectOption, _selectStar, _submitVote };
})();
