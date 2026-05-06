/**
 * SlideMeter — Global Application State
 * Single source of truth. Uses BroadcastChannel for cross-tab sync.
 */

const OPTION_COLORS = [
  '#6366f1','#8b5cf6','#06b6d4','#10b981',
  '#f59e0b','#ef4444','#ec4899','#84cc16',
];

const State = (() => {
  let _state = {
    currentScreen: 'auth',
    user: null,
    sessionCode: null,
    slides: [],
    activeSlideIndex: 0,
    votes: {},
    pollStatus: {},
    presentations: [],         // [{ id, name, slides, votes, pollStatus, createdAt, updatedAt }]
    activePresentationId: null,
    presSettings: {
      displayMode: 'percent',
      showQR: true,
      showResults: true,
      showInstructionBar: true,
      themeBgColor: '#1a2547',
      themeVisColours: ['#ff3366', '#33ffcc', '#ff9966', '#333366', '#cc3366'],
      themeFontFamily: 'Inter',
      themeTextColor: '#ffffff'
    },
    themes: [],
    activeThemeId: null,
  };

  const listeners = new Set();
  let channel = null;
  let _isPresenting = false; // true only while presentation screen is active
  let _cloudSaveTimer = null; // debounce timer for cloud presentation saves

  try {
    channel = new BroadcastChannel('slidemeter_v1');
    channel.onmessage = (e) => {
      if (e.data && e.data.type === 'STATE_UPDATE') {
        const patch = e.data.patch;

        // NEVER accept presentations/activePresentationId from other tabs.
        // Each browser tab loads its own presentations from localStorage.
        // Allowing cross-tab presentation overwrites is what causes data loss
        // when an incognito window (fresh localStorage) seeds demo data and
        // broadcasts it — overwriting the real window's saved presentations.
        const safePatch = { ...patch };
        delete safePatch.presentations;
        delete safePatch.activePresentationId;

        if (Object.keys(safePatch).length > 0) {
          Object.assign(_state, safePatch);
          _notify(safePatch);
        }
      }
    };
  } catch (e) { /* BroadcastChannel not available */ }

  function _notify(changed) {
    listeners.forEach(fn => fn(_state, changed));
  }

  function _broadcast(patch) {
    if (channel) channel.postMessage({ type: 'STATE_UPDATE', patch });
  }

  return {
    get() { return _state; },

    set(patch, broadcast = true) {
      Object.assign(_state, patch);
      if (broadcast) _broadcast(patch);

      // Auto-sync back into active presentation on any relevant field change.
      // Use !== undefined checks — empty {} and [] are falsy so || would miss them.
      // Only run for presenter role — participants must never write server-received
      // data back into the presentations array (would corrupt saved presentations).
      const shouldSync = _state.activePresentationId &&
        _state.user?.role === 'presenter' &&
        (
          patch.slides          !== undefined ||
          patch.votes           !== undefined ||
          patch.pollStatus      !== undefined ||
          patch.sessionCode     !== undefined ||
          patch.activeSlideIndex !== undefined
        );

      if (shouldSync) {
        _state.presentations = _state.presentations.map(p =>
          p.id === _state.activePresentationId
            ? {
                ...p,
                slides:           _state.slides,
                votes:            _state.votes,
                pollStatus:       _state.pollStatus,
                sessionCode:      _state.sessionCode,
                activeSlideIndex: _state.activeSlideIndex,
                updatedAt:        new Date().toISOString(),
              }
            : p
        );
        // Push updated presentation to cloud so other browsers see it
        const updatedPres = _state.presentations.find(p => p.id === _state.activePresentationId);
        if (updatedPres && typeof API !== 'undefined') {
          // Debounce cloud save to avoid flooding on rapid edits
          clearTimeout(_cloudSaveTimer);
          _cloudSaveTimer = setTimeout(() => API.savePresentation(updatedPres), 500);
        }
      }

      // Push to server ONLY while actively presenting — not during editing/dashboard
      if (_isPresenting && typeof API !== 'undefined' && _state.user?.role === 'presenter') {
        if (patch.activeSlideIndex !== undefined) API.pushNavigate(patch.activeSlideIndex);
        if (patch.slides          !== undefined) API.pushSlides(patch.slides);
        if (patch.presSettings    !== undefined) API.pushPresSettings(patch.presSettings);
        if (patch.pollStatus      !== undefined) {
          Object.entries(_state.pollStatus).forEach(([sid, st]) => API.pushPollStatus(sid, st));
        }
      }

      _notify(patch);
    },

    /** Call when entering/exiting presentation mode */
    setPresenting(val) {
      _isPresenting = !!val;
    },

    isPresenting() {
      return _isPresenting;
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    // ── Slide helpers ──
    getActiveSlide() {
      return _state.slides[_state.activeSlideIndex] || null;
    },

    addSlide() {
      const id = `slide_${Date.now()}`;
      const slide = {
        id,
        question: 'New Question?',
        options: [
          { text: 'Option A', color: OPTION_COLORS[0] },
          { text: 'Option B', color: OPTION_COLORS[1] },
          { text: 'Option C', color: OPTION_COLORS[2] },
        ],
        multiSelect: false,
        maxPicks: 1,
        timerEnabled: false,
        timerSeconds: 60,
        locked: false,
        bgColor: '#1a2547',
        bgImage: null,
        logoImage: null,
        layout: 'bars',   // 'bars' | 'donut' | 'pie'
        showResultsToAudience: true,
      };
      const newSlides = [..._state.slides, slide];
      const newVotes = { ..._state.votes, [id]: {} };
      const newPoll = { ..._state.pollStatus, [id]: 'pending' };
      this.set({ slides: newSlides, votes: newVotes, pollStatus: newPoll, activeSlideIndex: newSlides.length - 1 });
      return slide;
    },

    deleteSlide(index) {
      const newSlides = _state.slides.filter((_, i) => i !== index);
      if (!newSlides.length) return;
      const newIndex = Math.min(index, newSlides.length - 1);
      this.set({ slides: newSlides, activeSlideIndex: newIndex });
    },

    updateSlide(index, patch) {
      const newSlides = _state.slides.map((s, i) => i === index ? { ...s, ...patch } : s);
      this.set({ slides: newSlides });
    },

    // ── Voting ──
    castVote(slideId, userHash, optionIndices, email) {
      const slideVotes = { ...(_state.votes[slideId] || {}) };

      // UNIQUE constraint enforcement (DB-level simulation)
      if (slideVotes[userHash]) {
        return { success: false, reason: 'DUPLICATE_VOTE' };
      }

      slideVotes[userHash] = { options: optionIndices, ts: new Date().toISOString(), email };
      const newVotes = { ..._state.votes, [slideId]: slideVotes };
      this.set({ votes: newVotes });
      return { success: true };
    },

    getVoteCounts(slideId) {
      const slide = _state.slides.find(s => s.id === slideId);
      if (!slide) return [];
      const slideVotes = _state.votes[slideId] || {};
      const counts = slide.options.map(() => 0);
      Object.values(slideVotes).forEach(v => {
        v.options.forEach(idx => { if (counts[idx] !== undefined) counts[idx]++; });
      });
      return counts;
    },

    getTotalVotes(slideId) {
      return Object.keys(_state.votes[slideId] || {}).length;
    },

    setPollStatus(slideId, status) {
      const newPoll = { ..._state.pollStatus, [slideId]: status };
      this.set({ pollStatus: newPoll });
      // Propagate to server so all devices (incognito included) receive via SSE
      if (typeof API !== 'undefined') API.pushPollStatus(slideId, status);
    },

    // ── Presentations management ──
    createPresentation(name) {
      const id = `pres_${Date.now()}`;
      const sessionCode = generateSessionCode();
      const pres = {
        id,
        name: name || 'New Presentation',
        sessionCode,
        slides: [],
        votes: {},
        pollStatus: {},
        activeSlideIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const presentations = [..._state.presentations, pres];
      this.set({ presentations }, false); // don't broadcast to other tabs
      this.setActivePresentation(id);
      // Persist to cloud so other browsers see it
      if (typeof API !== 'undefined') API.savePresentation(pres);
      return pres;
    },

    renamePresentation(id, name) {
      const presentations = _state.presentations.map(p =>
        p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p
      );
      this.set({ presentations }, false);
      // Persist renamed copy to cloud
      const updated = presentations.find(p => p.id === id);
      if (updated && typeof API !== 'undefined') API.savePresentation(updated);
    },

    deletePresentation(id) {
      const presentations = _state.presentations.filter(p => p.id !== id);
      this.set({ presentations }, false);
      // Remove from cloud
      if (typeof API !== 'undefined') API.deletePresentation(id);
      if (_state.activePresentationId === id) {
        if (presentations.length > 0) {
          this.setActivePresentation(presentations[0].id);
        } else {
          this.set({ activePresentationId: null, slides: [], votes: {}, pollStatus: {}, activeSlideIndex: 0 }, false);
        }
      }
    },

    setActivePresentation(id) {
      const pres = _state.presentations.find(p => p.id === id);
      if (!pres) return;
      // Each presentation has its own session code
      const sessionCode = pres.sessionCode || generateSessionCode();
      // Persist generated code back if it was missing
      if (!pres.sessionCode) {
        _state.presentations = _state.presentations.map(p =>
          p.id === id ? { ...p, sessionCode } : p
        );
      }
      this.set({
        activePresentationId: id,
        sessionCode,
        slides:      pres.slides      || [],
        votes:       pres.votes       || {},
        pollStatus:  pres.pollStatus  || {},
        // Restore the saved slide index, clamped to valid range
        activeSlideIndex: Math.min(
          pres.activeSlideIndex ?? 0,
          Math.max((pres.slides?.length || 1) - 1, 0)
        ),
      });
      // Register new session code with server
      if (typeof API !== 'undefined') API.registerSession(sessionCode);
    },

    // ── Export ──
    exportCSV(slideId) {
      const slide = _state.slides.find(s => s.id === slideId);
      if (!slide) return '';
      const rows = [['User Email', 'Slide ID', 'Question', 'Selected Options', 'Timestamp (UTC)']];
      const slideVotes = _state.votes[slideId] || {};
      Object.entries(slideVotes).forEach(([hash, v]) => {
        const opts  = v.options.map(i => slide.options[i]?.text || '').join('; ');
        const email = v.email || 'Anonymous';
        rows.push([email, slideId, `"${slide.question}"`, `"${opts}"`, v.ts]);
      });
      return rows.map(r => r.join(',')).join('\n');
    },
  };
})();

// ── User Hash Generator ──
// Produces a strong session-scoped hash: same email always maps to the same
// hash within one session, but different sessions give different hashes.
// Uses a MurmurHash3-inspired 64-bit approach for collision resistance.
function generateUserHash(email, sessionCode = '') {
  const raw = `${email.toLowerCase().trim()}:${sessionCode}`;
  let h1 = 0xdeadbeef ^ raw.length;
  let h2 = 0x41c6ce57 ^ raw.length;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  // Combine to 64-bit hex string (16 chars)
  const hi = (h2 >>> 0).toString(16).padStart(8, '0');
  const lo = (h1 >>> 0).toString(16).padStart(8, '0');
  return hi + lo;
}

// ── Session Code Generator ──
function generateSessionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Seed initial demo data ──
function seedDemoData(existingSlides) {
  const now = new Date().toISOString();
  const demoSlides = existingSlides || [
    {
      id: 'slide_1',
      question: 'What is your primary programming language?',
      options: [
        { text: 'TypeScript', color: OPTION_COLORS[0] },
        { text: 'Python',     color: OPTION_COLORS[1] },
        { text: 'Go',         color: OPTION_COLORS[2] },
        { text: 'Rust',       color: OPTION_COLORS[3] },
        { text: 'Java',       color: OPTION_COLORS[4] },
      ],
      multiSelect: false, maxPicks: 1, timerEnabled: true, timerSeconds: 30,
      locked: false, bgColor: '#0f172a', bgImage: null, logoImage: null,
      layout: 'bars', showResultsToAudience: true,
    },
    {
      id: 'slide_2',
      question: 'Which cloud providers does your team use? (Select all that apply)',
      options: [
        { text: 'AWS',        color: OPTION_COLORS[0] },
        { text: 'Google Cloud', color: OPTION_COLORS[2] },
        { text: 'Azure',      color: OPTION_COLORS[3] },
        { text: 'On-Premise', color: OPTION_COLORS[4] },
      ],
      multiSelect: true, maxPicks: 3, timerEnabled: false, timerSeconds: 60,
      locked: false, bgColor: '#1e1b4b', bgImage: null, logoImage: null,
      layout: 'donut', showResultsToAudience: true,
    },
    {
      id: 'slide_3',
      question: 'Rate your confidence in our Q3 roadmap delivery',
      options: [
        { text: '🔥 Very Confident',    color: OPTION_COLORS[3] },
        { text: '👍 Somewhat Confident', color: OPTION_COLORS[0] },
        { text: '😐 Neutral',            color: OPTION_COLORS[4] },
        { text: '😟 Concerned',          color: OPTION_COLORS[6] },
      ],
      multiSelect: false, maxPicks: 1, timerEnabled: false, timerSeconds: 60,
      locked: false, bgColor: '#064e3b', bgImage: null, logoImage: null,
      layout: 'pie', showResultsToAudience: false,
    },
  ];

  const votes = existingSlides ? {} : { slide_1: {}, slide_2: {}, slide_3: {} };
  const pollStatus = existingSlides ? {} : { slide_1: 'open', slide_2: 'pending', slide_3: 'pending' };

  // Declare presId and demoSessionCode BEFORE the seed block so they're in scope
  const presId = `pres_${Date.now()}`;
  const demoSessionCode = generateSessionCode();

  // Seed some demo votes if fresh
  if (!existingSlides) {
    const demoVoters = [
      'alice@corp.com', 'bob@corp.com', 'carol@corp.com',
      'dave@corp.com',  'eve@corp.com',  'frank@corp.com',
    ];
    const s1opts = [[0],[1],[1],[2],[0],[3]];
    demoVoters.forEach((email, i) => {
      const h = generateUserHash(email, presId); // session-scoped salt
      votes['slide_1'][h] = { options: s1opts[i], ts: now, email };
    });
  }

  const demoPres = {
    id: presId,
    name: existingSlides ? 'My Presentation' : 'Demo: Tech Team Pulse',
    sessionCode: demoSessionCode,
    slides: demoSlides,
    votes,
    pollStatus,
    createdAt: now,
    updatedAt: now,
  };

  const themes = [
    {
      id: 'theme_default',
      name: 'Default Blue',
      logo: null, bgImage: null,
      bgColor: '#1a2547', textColor: '#ffffff', fontFamily: 'Inter',
      visColours: ['#ff3366', '#33ffcc', '#ff9966', '#333366', '#cc3366']
    },
    {
      id: 'theme_vibrant',
      name: 'Vibrant Night',
      logo: null, bgImage: null,
      bgColor: '#0f172a', textColor: '#f8fafc', fontFamily: 'Inter',
      visColours: ['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b']
    }
  ];

  State.set({
    presentations: [demoPres],
    activePresentationId: presId,
    sessionCode: demoSessionCode,
    slides: demoSlides,
    votes,
    pollStatus,
    activeSlideIndex: 0,
    activeThemeId: 'theme_default',
    themes,
  }, false); // broadcast=false — never push seed data to other tabs
}
