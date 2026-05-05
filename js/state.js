/**
 * LivePoll Secure — Global Application State
 * Single source of truth. Uses BroadcastChannel for cross-tab sync.
 */

const OPTION_COLORS = [
  '#6366f1','#8b5cf6','#06b6d4','#10b981',
  '#f59e0b','#ef4444','#ec4899','#84cc16',
];

const State = (() => {
  let _state = {
    currentScreen: 'auth',   // auth | editor | presentation | participant
    user: null,               // { email, ldapId, userHash, role }
    sessionCode: null,
    slides: [],
    activeSlideIndex: 0,
    votes: {},                // { [slideId]: { [userHash]: [optionIndices] } }
    pollStatus: {},           // { [slideId]: 'pending' | 'open' | 'closed' }
    presSettings: {
      displayMode: 'percent', // 'percent' | 'count'
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

  try {
    channel = new BroadcastChannel('livepoll_secure_v1');
    channel.onmessage = (e) => {
      if (e.data && e.data.type === 'STATE_UPDATE') {
        const patch = e.data.patch;
        Object.assign(_state, patch);
        _notify(patch);
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
      
      // Push navigation to server if presenter changed the slide
      if (patch.activeSlideIndex !== undefined && typeof API !== 'undefined' && _state.user?.role === 'presenter') {
        API.pushNavigate(patch.activeSlideIndex);
      }

      // Push slides to server if presenter changed them
      if (patch.slides !== undefined && typeof API !== 'undefined' && _state.user?.role === 'presenter') {
        API.pushSlides(patch.slides);
      }

      // Push presSettings to server if presenter changed them
      if (patch.presSettings !== undefined && typeof API !== 'undefined' && _state.user?.role === 'presenter') {
        API.pushPresSettings(patch.presSettings);
      }

      _notify(patch);
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
    castVote(slideId, userHash, optionIndices, email, ldapId) {
      const slideVotes = { ...(_state.votes[slideId] || {}) };

      // UNIQUE constraint enforcement (DB-level simulation)
      if (slideVotes[userHash]) {
        return { success: false, reason: 'DUPLICATE_VOTE' };
      }

      slideVotes[userHash] = { options: optionIndices, ts: new Date().toISOString(), email, ldapId };
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

    // ── Export ──
    exportCSV(slideId) {
      const slide = _state.slides.find(s => s.id === slideId);
      if (!slide) return '';
      const rows = [['User Email', 'LDAP ID', 'Slide ID', 'Question', 'Selected Options', 'Timestamp (UTC)']];
      const slideVotes = _state.votes[slideId] || {};
      Object.entries(slideVotes).forEach(([hash, v]) => {
        const opts = v.options.map(i => slide.options[i]?.text || '').join('; ');
        const email = v.email || 'Hidden';
        const ldapId = v.ldapId || 'Hidden';
        rows.push([email, ldapId, slideId, `"${slide.question}"`, `"${opts}"`, v.ts]);
      });
      return rows.map(r => r.join(',')).join('\n');
    },
  };
})();

// ── Hash Generator ──
function generateUserHash(email, ldapId) {
  const raw = `${email.toLowerCase()}:${ldapId}`;
  return btoa(raw).replace(/=/g, '');
}

// ── Session Code Generator ──
function generateSessionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Seed initial demo slides ──
function seedDemoData() {
  const demoSlides = [
    {
      id: 'slide_1',
      question: 'What is your primary programming language?',
      options: [
        { text: 'TypeScript', color: OPTION_COLORS[0] },
        { text: 'Python', color: OPTION_COLORS[1] },
        { text: 'Go', color: OPTION_COLORS[2] },
        { text: 'Rust', color: OPTION_COLORS[3] },
        { text: 'Java', color: OPTION_COLORS[4] },
      ],
      multiSelect: false, maxPicks: 1, timerEnabled: true, timerSeconds: 30,
      locked: false, bgColor: '#0f172a', bgImage: null, logoImage: null,
      layout: 'bars', showResultsToAudience: true,
    },
    {
      id: 'slide_2',
      question: 'Which cloud providers does your team use? (Select all that apply)',
      options: [
        { text: 'AWS', color: OPTION_COLORS[0] },
        { text: 'Google Cloud', color: OPTION_COLORS[2] },
        { text: 'Azure', color: OPTION_COLORS[3] },
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
        { text: '🔥 Very Confident', color: OPTION_COLORS[3] },
        { text: '👍 Somewhat Confident', color: OPTION_COLORS[0] },
        { text: '😐 Neutral', color: OPTION_COLORS[4] },
        { text: '😟 Concerned', color: OPTION_COLORS[6] },
      ],
      multiSelect: false, maxPicks: 1, timerEnabled: false, timerSeconds: 60,
      locked: false, bgColor: '#064e3b', bgImage: null, logoImage: null,
      layout: 'pie', showResultsToAudience: false,
    },
  ];

  const votes = { slide_1: {}, slide_2: {}, slide_3: {} };
  const pollStatus = { slide_1: 'open', slide_2: 'pending', slide_3: 'pending' };

  // Seed some demo votes
  const demoVoters = [
    ['alice@corp.com','ldap001'], ['bob@corp.com','ldap002'],
    ['carol@corp.com','ldap003'], ['dave@corp.com','ldap004'],
    ['eve@corp.com','ldap005'],   ['frank@corp.com','ldap006'],
  ];
  const s1opts = [[0],[1],[1],[2],[0],[3]];
  demoVoters.forEach(([e,l], i) => {
    const h = generateUserHash(e,l);
    votes['slide_1'][h] = { options: s1opts[i], ts: new Date().toISOString() };
  });

  State.set({ 
    slides: demoSlides, 
    votes, 
    pollStatus,
    activeThemeId: 'theme_default',
    themes: [
      {
        id: 'theme_default',
        name: 'AhaSlides (Default)',
        logo: null,
        bgImage: null,
        bgColor: '#1a2547',
        textColor: '#ffffff',
        fontFamily: 'Inter',
        visColours: ['#ff3366', '#33ffcc', '#ff9966', '#333366', '#cc3366']
      },
      {
        id: 'theme_vibrant',
        name: 'Vibrant Night',
        logo: null,
        bgImage: null,
        bgColor: '#0f172a',
        textColor: '#f8fafc',
        fontFamily: 'Plus Jakarta Sans',
        visColours: ['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b']
      }
    ]
  });
}
