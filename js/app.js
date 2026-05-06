/**
 * SlideMeter — App Entry Point
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
    // Preserve presentations — only clear session/auth state
    const savedPresentations    = State.get().presentations;
    const savedActivePres       = State.get().activePresentationId;

    State.set({
      user:          null,
      currentScreen: 'auth',
      // Explicitly keep presentations so they're saved with the cleared user
      presentations:        savedPresentations,
      activePresentationId: savedActivePres,
    }, false);

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

  // ── Seed demo data ONLY on true first run ────────────────────────────────
  const state = State.get();
  if (!DB.hasBeenSeeded() && (!state.presentations || state.presentations.length === 0)) {
    // Genuine first run — inject demo presentation
    const existingSlides = state.slides?.length > 0 ? state.slides : null;
    seedDemoData(existingSlides);
    DB.markSeeded(); // prevent re-seeding on every refresh
  } else if (state.presentations?.length > 0 && !state.activePresentationId) {
    // Has presentations but no active one — restore first
    State.setActivePresentation(state.presentations[0].id);
  }

  // ── Initialize ThemeManager (after DB.load so stored themes are available) ──
  ThemeManager.init();

  // ── Server integration ───────────────────────────────────────────────────
  if (hasServer) {
    // Session code registration only (no slide data — broadcast starts when presenter clicks Present)
    if (!codeFromUrl && state.sessionCode) {
      API.registerSession(state.sessionCode);
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

    // ── Load presentations from cloud (cross-browser sync) ────────────────
    // Cloud is the AUTHORITATIVE source for presentations.
    // Local-only presentations are NOT uploaded back — if they aren't on
    // the server it means they were deleted by the presenter and should stay gone.
    const cloudPresentations = await API.fetchPresentations();
    if (cloudPresentations !== null) {
      if (cloudPresentations.length > 0) {
        // Cloud has presentations — it wins. Merge content by updatedAt.
        const localMap = {};
        (State.get().presentations || []).forEach(p => { localMap[p.id] = p; });

        const mergedPresentations = cloudPresentations.map(cp => {
          const lp = localMap[cp.id];
          // If local copy is newer (presenter just saved), prefer it; otherwise take cloud
          return (lp && new Date(lp.updatedAt) > new Date(cp.updatedAt)) ? lp : cp;
        });

        State.set({ presentations: mergedPresentations }, false);

        // Restore active presentation if needed
        const st = State.get();
        if (mergedPresentations.length > 0 && !st.activePresentationId) {
          State.setActivePresentation(mergedPresentations[0].id);
        } else if (st.activePresentationId) {
          const active = mergedPresentations.find(p => p.id === st.activePresentationId);
          if (active) State.setActivePresentation(active.id);
          else State.setActivePresentation(mergedPresentations[0].id);
        }
      } else {
        // Cloud is empty (all deleted) — clear local presentations too
        State.set({ presentations: [], activePresentationId: null }, false);
      }
    }
    // If cloudPresentations is null (server unreachable), keep local state as-is

    // SSE handlers — all use broadcast=false to prevent shouldSync from
    // writing server data back over saved presentations
    API.on('presentations', ({ presentations }) => {
      if (!presentations || State.get().user?.role === 'participant') return;
      // Merge incoming cloud presentations into local state
      const localMap = {};
      (State.get().presentations || []).forEach(p => { localMap[p.id] = p; });
      presentations.forEach(cp => {
        const lp = localMap[cp.id];
        if (!lp || new Date(cp.updatedAt) >= new Date(lp.updatedAt || 0)) {
          localMap[cp.id] = cp;
        }
      });
      // Remove presentations that were deleted on server
      const serverIds = new Set(presentations.map(p => p.id));
      Object.keys(localMap).forEach(id => {
        if (!serverIds.has(id)) delete localMap[id];
      });
      State.set({ presentations: Object.values(localMap) }, false);
      // Re-render dashboard if it's active
      if (document.getElementById('screen-dashboard')?.classList.contains('active')) {
        Dashboard.render();
      }
    });
    API.on('vote', ({ slideId, slideVotes }) => {
      const currentSlideVotes = State.get().votes[slideId] || {};
      const mergedSlideVotes = { ...currentSlideVotes, ...slideVotes };
      const v = { ...State.get().votes, [slideId]: mergedSlideVotes };
      State.set({ votes: v }, false); // broadcast=false: votes come from server, not local edit
    });
    API.on('pollStatus', ({ slideId, status }) => {
      // Only participants receive pollStatus from server — presenter drives it
      if (State.get().user?.role !== 'participant') return;
      const ps = { ...State.get().pollStatus, [slideId]: status };
      State.set({ pollStatus: ps }, false);
    });
    API.on('navigate', ({ activeSlideIndex }) => {
      if (State.get().user?.role === 'participant') {
        State.set({ activeSlideIndex }, false);
      }
    });
    API.on('slides', ({ slides }) => {
      if (State.get().user?.role === 'participant') {
        State.set({ slides }, false);
      }
    });
    API.on('presSettings', ({ presSettings }) => {
      if (State.get().user?.role === 'participant') {
        State.set({ presSettings }, false);
      }
    });
    API.on('init', (initState) => {
      // For participants: sync real-time state
      _syncParticipantState(initState);
      // For presenters: cloud presentations are authoritative — replace local list
      if (State.get().user?.role === 'presenter') {
        if (initState.presentations?.length > 0) {
          // Prefer local copy if it's newer (presenter just saved locally)
          const localMap = {};
          (State.get().presentations || []).forEach(p => { localMap[p.id] = p; });
          const merged = initState.presentations.map(cp => {
            const lp = localMap[cp.id];
            return (lp && new Date(lp.updatedAt) > new Date(cp.updatedAt)) ? lp : cp;
          });
          State.set({ presentations: merged }, false);
        } else if (initState.presentations !== undefined) {
          // Server has no presentations (all deleted) — clear local list
          State.set({ presentations: [], activePresentationId: null }, false);
        }
      }
    });

    API.connect(); // open SSE connection

    // For participants: also fetch /api/state directly (in case SSE init arrives before presenter pushes)
    if (State.get().user?.role === 'participant') {
      _fetchAndSyncParticipantState();
      // Retry after 2s in case presenter hasn't pushed yet
      setTimeout(_fetchAndSyncParticipantState, 2000);
    }

    console.log('✅ Connected to SlideMeter backend — server-side duplicate prevention active');
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
      // broadcast=false: server data should never trigger shouldSync or re-broadcast
      State.set(syncData, false);
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
  
  SlideMeter v1.0 — Real-Time Audience Polling Platform
  Built per PRD specification — Zero duplicate votes guaranteed.
  `);
});
