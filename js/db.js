/**
 * LivePoll Secure — DB simulation layer
 * Wraps localStorage + in-memory state for persistence
 */

const DB = (() => {
  const KEY = 'livepoll_secure_db_v2'; // v2 includes presentations

  function save() {
    try {
      const s = State.get();
      localStorage.setItem(KEY, JSON.stringify({
        slides: s.slides,
        votes: s.votes,
        pollStatus: s.pollStatus,
        sessionCode: s.sessionCode,
        themes: s.themes,
        activeThemeId: s.activeThemeId,
        presSettings: s.presSettings,
        user: s.user,
        currentScreen: s.currentScreen,
        presentations: s.presentations,
        activePresentationId: s.activePresentationId,
      }));
    } catch(e) { /* storage quota */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      State.set(data, false);
      return true;
    } catch(e) { return false; }
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  // Auto-save on state changes
  State.subscribe(() => save());

  return { save, load, clear };
})();
