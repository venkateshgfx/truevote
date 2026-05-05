/**
 * LivePoll Secure — Participant Experience
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

    el.innerHTML = `
      <header class="part-header">
        <div class="part-header-logo">
          <div class="part-header-logo-icon">📊</div>
          LivePoll<span style="color:var(--accent-primary)">Secure</span>
        </div>
        <div class="part-user-info">
          <div class="part-user-hash" title="${user?.userHash || ''}">${hashDisplay}</div>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="App.navigate('auth')" title="Leave session" style="font-size:14px">🚪</button>
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

    // Apply universal theme
    if (state.presSettings?.themeBgImage) {
      screen.style.backgroundImage = `url(${state.presSettings.themeBgImage})`;
      screen.style.backgroundSize = 'cover';
      screen.style.backgroundPosition = 'center';
      screen.style.backgroundColor = '';
    } else {
      screen.style.backgroundImage = '';
      screen.style.backgroundColor = state.presSettings?.themeBgColor || '';
    }

    // Apply universal logo if exists
    const logoIcon = document.querySelector('.part-header-logo-icon');
    if (logoIcon && state.presSettings?.themeLogo) {
      logoIcon.innerHTML = `<img src="${state.presSettings.themeLogo}" style="width:100%; height:100%; object-fit:contain;" />`;
      logoIcon.style.background = 'transparent';
    }

    // Text & Fonts
    if (state.presSettings?.themeTextColor) {
      screen.style.color = state.presSettings.themeTextColor;
    }
    if (state.presSettings?.themeFontFamily) {
      screen.style.fontFamily = state.presSettings.themeFontFamily;
    }

    if (!slide) {
      content.innerHTML = `
        <div class="part-waiting">
          <div class="waiting-animation">
            <div class="waiting-ring"></div>
            <div class="waiting-ring"></div>
            <div class="waiting-ring"></div>
            <div class="waiting-icon">📊</div>
          </div>
          <div class="waiting-title">No Session Active</div>
          <div class="waiting-subtitle">No presentation is currently running. Please wait for the presenter to begin.</div>
          <div class="waiting-pulse-dots">
            <div class="waiting-dot"></div>
            <div class="waiting-dot"></div>
            <div class="waiting-dot"></div>
          </div>
        </div>
      `;
      return;
    }

    const status = state.pollStatus[slide.id] || 'pending';
    const userHash = state.user?.userHash || '';
    const slideVotes = state.votes[slide.id] || {};
    const alreadyVoted = !!slideVotes[userHash];

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
          <span class="part-poll-status-badge closed">
            <span class="status-badge-dot"></span> Not Started
          </span>
        </div>
        <div class="part-waiting" style="min-height:50vh">
          <div class="waiting-animation">
            <div class="waiting-ring"></div>
            <div class="waiting-ring"></div>
            <div class="waiting-ring"></div>
            <div class="waiting-icon">⏳</div>
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
          <span class="part-feedback-icon">✅</span>
          <span>Vote submitted successfully! Your response has been recorded.</span>
        </div>
      `;
    } else if (status === 'closed' && !hasVoted) {
      feedbackHTML = `
        <div class="part-feedback error">
          <span class="part-feedback-icon">🔒</span>
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
        <div class="part-results-title">📊 Live Results (${total} votes)</div>
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

    // Single-choice auto-submit
    if (!isMulti && pollOpen) {
      // Already handled by click → auto-submit after 200ms animation
    }
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

    const { userHash, email, ldapId } = state.user;
    let result;

    if (API.isAvailable()) {
      // ── Server-side duplicate check (works across incognito / devices) ──
      result = await API.castVote(slide.id, userHash, selectedOptions, email, ldapId);

      if (result.success) {
        // Mirror into local state so UI updates immediately
        State.castVote(slide.id, userHash, selectedOptions, email, ldapId);
      }
    } else {
      // ── Fallback: localStorage-only duplicate check ──────────────────────
      result = State.castVote(slide.id, userHash, selectedOptions, email, ldapId);
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
        if (slideChanged) { selectedOptions = []; hasVoted = false; }
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
        if (changed.activeSlideIndex) { selectedOptions = []; hasVoted = false; }
        _renderContent();
      }
    });
  }

  function _escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { render, _selectOption, _submitVote };
})();
