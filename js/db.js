/**
 * SlideMeter — DB simulation layer
 * Wraps localStorage + in-memory state for persistence
 */

const DB = (() => {
  const KEY          = 'slidemeter_db_v1';     // main state store
  const SEEDED_FLAG  = 'slidemeter_seeded_v1'; // set after first-run seed

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
    localStorage.removeItem(SEEDED_FLAG);
  }

  /** True if seedDemoData has already run at least once on this device */
  function hasBeenSeeded() {
    return !!localStorage.getItem(SEEDED_FLAG);
  }

  /** Call after seedDemoData completes so it never re-runs */
  function markSeeded() {
    localStorage.setItem(SEEDED_FLAG, '1');
  }

  // Auto-save on every state change
  State.subscribe(() => save());

  return { save, load, clear, hasBeenSeeded, markSeeded };
})();
