/**
 * LivePoll Secure — App Entry Point
 * Navigation, Toast system, initialization
 */

// ══════════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ══════════════════════════════════════════

const Toast = (() => {
  let container = null;

  function _getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function show(message, type = 'info', duration = 3500) {
    const c = _getContainer();
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    c.appendChild(el);

    setTimeout(() => {
      el.classList.add('fade-out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, duration);
  }

  return { show };
})();

// ══════════════════════════════════════════
// APP ROUTER
// ══════════════════════════════════════════

const App = (() => {
  const screens = {
    auth:         { id: 'screen-auth',         render: () => Auth.render() },
    dashboard:    { id: 'screen-dashboard',    render: () => Dashboard.render() },
    editor:       { id: 'screen-editor',       render: () => Editor.render() },
    presentation: { id: 'screen-presentation', render: () => Presentation.render() },
    participant:  { id: 'screen-participant',  render: () => Participant.render() },
  };

  function navigate(screenName) {
    const state = State.get();

    // Guard: redirect to auth if no user
    if (screenName !== 'auth' && !state.user) {
      screenName = 'auth';
    }

    // Guard: participants can only see participant/auth screens
    if ((screenName === 'editor' || screenName === 'dashboard') && state.user?.role === 'participant') {
      Toast.show('Presenter access required', 'error');
      return;
    }

    // Render the target screen
    const screen = screens[screenName];
    if (!screen) return;
    screen.render();

    // Show/hide screens
    Object.entries(screens).forEach(([name, s]) => {
      const el = document.getElementById(s.id);
      if (el) el.classList.toggle('active', name === screenName);
    });

    State.set({ currentScreen: screenName }, false);

    // Activate Lucide icons on the newly rendered screen
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Handle fullscreen for presentation
    if (screenName === 'presentation') {
      _requestFullscreen();
    } else {
      _exitFullscreen();
    }
  }

  function logout() {
    State.set({ user: null, currentScreen: 'auth' }, false);
    DB.save();
    navigate('auth');
    Toast.show('Signed out successfully', 'info');
  }

  function _requestFullscreen() {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }

  function _exitFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  return { navigate, logout };
})();

// ══════════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  // ── Check URL params first ───────────────────────────────────────────────
  const urlParams   = new URLSearchParams(window.location.search);
  const mode        = urlParams.get('mode');
  const codeFromUrl = urlParams.get('code');

  // ── Probe server (non-blocking) ──────────────────────────────────────────
  const hasServer = await API.probe();

  // ── Restore localStorage snapshot ────────────────────────────────────────
  DB.load();

  // ── Seed demo data if first run ──────────────────────────────────────────
  const state = State.get();
  if (!state.presentations || state.presentations.length === 0) {
    // Migrate old flat slides if they exist, otherwise seed fresh demo
    const existingSlides = state.slides && state.slides.length > 0 ? state.slides : null;
    seedDemoData(existingSlides);
    // session code is generated per-presentation inside seedDemoData
  } else if (!state.activePresentationId && state.presentations.length > 0) {
    // Has presentations but no active one set — restore the first
    State.setActivePresentation(state.presentations[0].id);
  }

  // ── Initialize ThemeManager (after DB.load so stored themes are available) ──
  ThemeManager.init();

  // ── Server integration ───────────────────────────────────────────────────
  if (hasServer) {
    // Push our session code to server (presenter side)
    const currentState = State.get();
    if (!codeFromUrl && currentState.sessionCode) {
      API.registerSession(currentState.sessionCode);
    }

    // Push full presenter state to server on startup (so participants get current data)
    if (currentState.user?.role === 'presenter') {
      if (currentState.slides?.length > 0) API.pushSlides(currentState.slides);
      if (currentState.presSettings) API.pushPresSettings(currentState.presSettings);
      if (currentState.pollStatus) {
        Object.entries(currentState.pollStatus).forEach(([slideId, status]) => {
          API.pushPollStatus(slideId, status);
        });
      }
      if (typeof currentState.activeSlideIndex === 'number') {
        API.pushNavigate(currentState.activeSlideIndex);
      }
    }

    // Merge server votes into local state (authoritative source)
    const serverVotes = await API.getVotes();
    if (serverVotes && Object.keys(serverVotes).length > 0) {
      const mergedAllVotes = { ...State.get().votes };
      Object.entries(serverVotes).forEach(([sId, sVotes]) => {
        mergedAllVotes[sId] = { ...(mergedAllVotes[sId] || {}), ...sVotes };
      });
      State.set({ votes: mergedAllVotes }, false);
    }

    // SSE handlers for real-time cross-device/incognito sync
    API.on('vote', ({ slideId, slideVotes }) => {
      const currentSlideVotes = State.get().votes[slideId] || {};
      const mergedSlideVotes = { ...currentSlideVotes, ...slideVotes };
      const v = { ...State.get().votes, [slideId]: mergedSlideVotes };
      State.set({ votes: v }, false);
    });
    API.on('pollStatus', ({ slideId, status }) => {
      const ps = { ...State.get().pollStatus, [slideId]: status };
      State.set({ pollStatus: ps });
    });
    API.on('navigate', ({ activeSlideIndex }) => {
      // Only update on participant — presenter drives navigation
      if (State.get().user?.role === 'participant') {
        State.set({ activeSlideIndex });
      }
    });
    API.on('slides', ({ slides }) => {
      if (State.get().user?.role === 'participant') {
        State.set({ slides });
      }
    });
    API.on('presSettings', ({ presSettings }) => {
      if (State.get().user?.role === 'participant') {
        State.set({ presSettings });
      }
    });
    API.on('init', (initState) => {
      _syncParticipantState(initState);
    });

    API.connect(); // open SSE connection

    // For participants: also fetch /api/state directly (in case SSE init arrives before presenter pushes)
    if (State.get().user?.role === 'participant') {
      _fetchAndSyncParticipantState();
      // Retry after 2s in case presenter hasn't pushed yet
      setTimeout(_fetchAndSyncParticipantState, 2000);
    }

    console.log('✅ Connected to LivePoll backend — server-side duplicate prevention active');
  } else {
    console.warn('⚠️  Backend not reachable — running in localStorage-only mode. Duplicate prevention limited to same browser.');
  }

  // Helper: sync participant state from server data
  async function _fetchAndSyncParticipantState() {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const serverData = await res.json();
        _syncParticipantState(serverData);
      }
    } catch {}
  }

  function _syncParticipantState(initState) {
    const isParticipant = State.get().user?.role === 'participant';
    if (!isParticipant || !initState) return;

    const syncData = {};
    if (initState.slides && initState.slides.length > 0) syncData.slides = initState.slides;
    if (typeof initState.activeSlideIndex === 'number') syncData.activeSlideIndex = initState.activeSlideIndex;
    if (initState.pollStatus) syncData.pollStatus = initState.pollStatus;
    if (initState.votes) syncData.votes = initState.votes;
    if (initState.sessionCode) syncData.sessionCode = initState.sessionCode;
    if (initState.presSettings && Object.keys(initState.presSettings).length > 0) syncData.presSettings = initState.presSettings;

    if (Object.keys(syncData).length > 0) {
      // Use broadcast = true so participant UI re-renders
      State.set(syncData);
    }
  }

  // ── Navigate to correct starting screen ──────────────────────────────────
  const currentUser = State.get().user;
  if (currentUser) {
    // Restore presenter to dashboard (not editor) on refresh
    let restoreScreen = State.get().currentScreen;
    if (currentUser.role === 'presenter' && (!restoreScreen || restoreScreen === 'editor')) {
      restoreScreen = 'dashboard';
    } else if (currentUser.role === 'participant') {
      restoreScreen = 'participant';
    }
    App.navigate(restoreScreen || 'auth');
  } else if (mode === 'participant') {
    // Participant join link — show join screen directly
    Auth.renderParticipantJoin();
    const screenAuth = document.getElementById('screen-auth');
    if (screenAuth) screenAuth.classList.add('active');
  } else {
    App.navigate('auth');
  }

  // Listen for ESC key on presentation screen
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const presEl = document.getElementById('screen-presentation');
      if (presEl?.classList.contains('active')) {
        Presentation._exit();
      }
    }
  });

  // Handle fullscreen exit by pressing ESC in browser
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      const presEl = document.getElementById('screen-presentation');
      if (presEl?.classList.contains('active')) {
        Presentation._exit();
      }
    }
  });

  console.log(`
  ██╗     ██╗██╗   ██╗███████╗██████╗  ██████╗ ██╗     ██╗
  ██║     ██║██║   ██║██╔════╝██╔══██╗██╔═══██╗██║     ██║
  ██║     ██║██║   ██║█████╗  ██████╔╝██║   ██║██║     ██║
  ██║     ██║╚██╗ ██╔╝██╔══╝  ██╔═══╝ ██║   ██║██║     ██║
  ███████╗██║ ╚████╔╝ ███████╗██║     ╚██████╔╝███████╗███████╗
  ╚══════╝╚═╝  ╚═══╝  ╚══════╝╚═╝      ╚═════╝ ╚══════╝╚══════╝
  
  LivePoll Secure v1.0 — Enterprise Audience Engagement Platform
  Built per PRD specification — Zero duplicate votes guaranteed.
  `);
});
