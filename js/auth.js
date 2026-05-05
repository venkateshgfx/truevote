/**
 * LivePoll Secure — Auth Screen
 */

const Auth = (() => {
  function render() {
    const el = document.getElementById('screen-auth');
    el.innerHTML = `
      <div class="auth-panel-left">
        <div class="auth-bg-gradient"></div>
        <div class="auth-grid-overlay"></div>
        <div class="auth-orb auth-orb-1"></div>
        <div class="auth-orb auth-orb-2"></div>
        <div class="auth-brand-content">
          <div class="auth-logo">
            <div class="auth-logo-icon">📊</div>
            <div class="auth-logo-text">LivePoll<span>Secure</span></div>
          </div>
          <div class="auth-badge">
            <div class="auth-badge-dot"></div>
            Enterprise Grade · Zero Duplicate Votes
          </div>
          <h1 class="auth-headline">Real-time Polls.<br/>Verified Votes.<br/>Zero Fraud.</h1>
          <p class="auth-subtext">The only polling platform that enforces unique-vote constraints at the database level, tied to corporate identity — making duplicate submissions impossible.</p>
          <div class="auth-stats">
            <div class="auth-stat-item">
              <div class="auth-stat-value">5,000</div>
              <div class="auth-stat-label">Concurrent Participants</div>
            </div>
            <div class="auth-stat-item">
              <div class="auth-stat-value">100%</div>
              <div class="auth-stat-label">Vote Integrity</div>
            </div>
            <div class="auth-stat-item">
              <div class="auth-stat-value">&lt;1s</div>
              <div class="auth-stat-label">Real-time Sync</div>
            </div>
          </div>
        </div>
      </div>

      <div class="auth-panel-right">
        <div class="auth-card">
          <div class="auth-card-header">
            <div class="auth-card-title">Welcome back</div>
            <div class="auth-card-subtitle">Authenticate with your corporate identity to continue</div>
          </div>

          <div class="auth-tabs">
            <button class="auth-tab active" id="tab-presenter" onclick="Auth._switchTab('presenter')">🎤 Presenter</button>
            <button class="auth-tab" id="tab-participant" onclick="Auth._switchTab('participant')">👥 Join Session</button>
          </div>

          <!-- Presenter Form -->
          <div id="auth-presenter-form">
            <form class="auth-form" onsubmit="Auth._submitPresenter(event)">
              <div class="form-group">
                <label class="label" for="auth-email">Corporate Email</label>
                <div class="input-icon-wrap">
                  <span class="input-icon">✉️</span>
                  <input id="auth-email" type="email" class="input" placeholder="you@company.com" value="presenter@enterprise.com" required autocomplete="email" />
                </div>
              </div>
              <div class="form-group">
                <label class="label" for="auth-ldap">LDAP ID</label>
                <div class="input-icon-wrap">
                  <span class="input-icon">🔑</span>
                  <input id="auth-ldap" type="text" class="input" placeholder="e.g. LDAP-2024-001" value="PRES-001" required autocomplete="off" />
                </div>
              </div>
              <button type="submit" class="btn btn-primary btn-lg auth-submit-btn" id="presenter-login-btn">
                <span>Launch Presenter Dashboard</span>
              </button>
              <div class="auth-info-box">
                🔒 <strong>Your credentials generate a deterministic hash</strong> that uniquely identifies you in the system. Passwords are never stored.
              </div>
            </form>
          </div>

          <!-- Participant Form -->
          <div id="auth-participant-form" class="hidden">
            <form class="join-session-form" onsubmit="Auth._submitParticipant(event)">
              <div class="form-group">
                <label class="label" for="join-email">Corporate Email</label>
                <div class="input-icon-wrap">
                  <span class="input-icon">✉️</span>
                  <input id="join-email" type="email" class="input" placeholder="you@company.com" value="participant@enterprise.com" required />
                </div>
              </div>
              <div class="form-group">
                <label class="label" for="join-ldap">LDAP ID</label>
                <div class="input-icon-wrap">
                  <span class="input-icon">🔑</span>
                  <input id="join-ldap" type="text" class="input" placeholder="LDAP-2024-001" value="PART-001" required />
                </div>
              </div>
              <div class="form-group">
                <label class="label" for="join-code">Session Code</label>
                <input id="join-code" type="text" class="input session-code-input" placeholder="ABC123" maxlength="6" autocomplete="off" />
              </div>
              <button type="submit" class="btn btn-primary btn-lg auth-submit-btn" id="participant-login-btn">
                <span>Join Session →</span>
              </button>
              <div class="auth-info-box">
                🛡️ <strong>Duplicate vote prevention</strong>: Your unique identity hash ensures each vote is counted exactly once, regardless of device.
              </div>
            </form>
          </div>

          <div class="auth-security-badges">
            <div class="security-badge">
              <div class="security-badge-icon">🔒</div> LDAP-Tied Identity
            </div>
            <div class="security-badge">
              <div class="security-badge-icon">⚡</div> Real-time Sync
            </div>
            <div class="security-badge">
              <div class="security-badge-icon">🛡️</div> Zero Duplicates
            </div>
            <div class="security-badge">
              <div class="security-badge-icon">📊</div> CSV Export
            </div>
          </div>
        </div>
      </div>
    `;

    // Auto-fill session code if in URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      Auth._switchTab('participant');
      const codeInput = document.getElementById('join-code');
      if (codeInput) codeInput.value = code.toUpperCase();
    }

    // Session code input auto-uppercase
    const codeIn = document.getElementById('join-code');
    if (codeIn) codeIn.addEventListener('input', () => { codeIn.value = codeIn.value.toUpperCase(); });
  }

  function _switchTab(tab) {
    document.getElementById('tab-presenter').classList.toggle('active', tab === 'presenter');
    document.getElementById('tab-participant').classList.toggle('active', tab === 'participant');
    document.getElementById('auth-presenter-form').classList.toggle('hidden', tab !== 'presenter');
    document.getElementById('auth-participant-form').classList.toggle('hidden', tab !== 'participant');
  }

  async function _submitPresenter(e) {
    e.preventDefault();
    const btn = document.getElementById('presenter-login-btn');
    const email = document.getElementById('auth-email').value.trim();
    const ldapId = document.getElementById('auth-ldap').value.trim();

    if (!email || !ldapId) return;

    btn.innerHTML = `<div class="spinner"></div><span>Authenticating…</span>`;
    btn.disabled = true;

    try {
      await delay(800); // Simulate auth round-trip

      const userHash = generateUserHash(email, ldapId);
      const existingCode = State.get().sessionCode;
      const sessionCode = existingCode || generateSessionCode();

      State.set({
        user: { email, ldapId, userHash, role: 'presenter' },
        sessionCode,
        currentScreen: 'editor',
      });

      App.navigate('editor');
      Toast.show('Logged in as Presenter ✓', 'success');
    } finally {
      btn.innerHTML = '<span>Launch Presenter Dashboard</span>';
      btn.disabled = false;
    }
  }

  async function _submitParticipant(e) {
    e.preventDefault();
    const btn = document.getElementById('participant-login-btn');
    const email = document.getElementById('join-email').value.trim();
    const ldapId = document.getElementById('join-ldap').value.trim();
    const code = document.getElementById('join-code').value.trim().toUpperCase();

    if (!email || !ldapId) return;
    if (!code) {
      Toast.show('Please enter the session code from the presenter', 'warning');
      btn.innerHTML = '<span>Join Session →</span>';
      btn.disabled = false;
      return;
    }

    btn.innerHTML = `<div class="spinner"></div><span>Verifying…</span>`;
    btn.disabled = true;

    try {
      await delay(600);

      const userHash = generateUserHash(email, ldapId);
      State.set({
        user:          { email, ldapId, userHash, role: 'participant' },
        sessionCode:   code,   // adopt the presenter's code
        currentScreen: 'participant',
      });
      App.navigate('participant');
      Toast.show('Joined session successfully ✓', 'success');
    } finally {
      btn.innerHTML = '<span>Join Session →</span>';
      btn.disabled = false;
    }
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  return { render, _switchTab, _submitPresenter, _submitParticipant };
})();
