/**
 * SlideMeter — Auth Module
 * Separate screens for Presenter login and Participant join
 */

const Auth = (() => {

  // ── Presenter Login Screen ──────────────────────────────────────────────
  function renderPresenterLogin() {
    const el = document.getElementById('screen-auth');
    el.innerHTML = `
      <div class="auth-split">
        <!-- Left branding panel -->
        <div class="auth-left">
          <div class="auth-left-inner">
            <div class="auth-brand">
              <div class="auth-brand-icon"><i data-lucide="bar-chart-2" class="icon-lg" style="color:#fff"></i></div>
              <div class="auth-brand-name">Slide<span>Meter</span></div>
            </div>
            <h1 class="auth-headline">
              Run smarter<br/>live polls.<br/>
              <span class="auth-headline-accent">Zero fraud.</span>
            </h1>
            <p class="auth-desc">Enterprise-grade audience engagement with server-side duplicate vote prevention tied to identity.</p>
            <div class="auth-feature-list">
              <div class="auth-feature"><span class="auth-feature-icon"><i data-lucide="check" class="icon-xs"></i></span> Real-time vote sync via SSE</div>
              <div class="auth-feature"><span class="auth-feature-icon"><i data-lucide="check" class="icon-xs"></i></span> Zero duplicate votes</div>
              <div class="auth-feature"><span class="auth-feature-icon"><i data-lucide="check" class="icon-xs"></i></span> Custom themes &amp; branding</div>
              <div class="auth-feature"><span class="auth-feature-icon"><i data-lucide="check" class="icon-xs"></i></span> QR code join flow</div>
            </div>
          </div>
          <div class="auth-left-orb auth-orb-1"></div>
          <div class="auth-left-orb auth-orb-2"></div>
        </div>

        <!-- Right login form -->
        <div class="auth-right">
          <div class="auth-card">
            <div class="auth-card-logo">
              <div class="auth-card-logo-icon"><i data-lucide="bar-chart-2" class="icon-md" style="color:#fff"></i></div>
              Slide<span>Meter</span>
            </div>
            <div class="auth-card-title">Presenter Sign In</div>
            <div class="auth-card-subtitle">Sign in to manage your live polls and presentations</div>

            <form class="auth-form" onsubmit="Auth._submitPresenter(event)" id="presenter-form">
              <div class="form-group">
                <label class="label" for="auth-username">Username</label>
                <div class="input-icon-wrap">
                  <span class="input-icon"><i data-lucide="user" class="icon-sm"></i></span>
                  <input id="auth-username" type="text" class="input" placeholder="Enter your username"
                    required autocomplete="username" />
                </div>
              </div>
              <div class="form-group">
                <label class="label" for="auth-password">Password</label>
                <div class="input-icon-wrap">
                  <span class="input-icon"><i data-lucide="lock" class="icon-sm"></i></span>
                  <input id="auth-password" type="password" class="input" placeholder="Enter your password"
                    required autocomplete="current-password" />
                  <button type="button" class="input-icon-right" onclick="Auth._togglePassword()" id="pw-toggle" title="Show/hide password">
                    <i data-lucide="eye" class="icon-sm"></i>
                  </button>
                </div>
              </div>
              <div id="auth-error" class="auth-error hidden"></div>
              <button type="submit" class="btn btn-primary btn-lg auth-submit-btn" id="presenter-login-btn">
                <span>Sign In to Dashboard</span>
              </button>
            </form>

            <div class="auth-divider"><span>or</span></div>
            <div class="auth-switch-text">
              Are you a participant?
              <button class="auth-link-btn" onclick="Auth.renderParticipantJoin()">Join a session →</button>
            </div>
          </div>
        </div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // ── Participant Join Screen ─────────────────────────────────────────────
  function renderParticipantJoin() {
    const el = document.getElementById('screen-auth');
    el.innerHTML = `
      <div class="join-screen">
        <div class="join-card">
          <div class="join-header">
            <div class="join-logo">
              <div class="join-logo-icon"><i data-lucide="bar-chart-2" class="icon-md" style="color:#fff"></i></div>
              <div class="join-logo-name">Slide<span>Meter</span></div>
            </div>
            <div class="join-title">Join a Live Session</div>
            <div class="join-subtitle">Enter the session code your presenter shared with you</div>
          </div>

          <form class="auth-form" onsubmit="Auth._submitParticipant(event)">
            <div class="form-group">
              <label class="label" for="join-email">Google mail</label>
              <div class="input-icon-wrap">
                <span class="input-icon"><i data-lucide="mail" class="icon-sm"></i></span>
                <input id="join-email" type="email" class="input" placeholder="you@google.com"
                  required autocomplete="email" />
              </div>
            </div>
            <div class="form-group">
              <label class="label" for="join-code">Session Code</label>
              <input id="join-code" type="text" class="input session-code-input"
                placeholder="e.g. ABC123" maxlength="6" autocomplete="off" />
            </div>
            <div id="join-error" class="auth-error hidden"></div>
            <button type="submit" class="btn btn-primary btn-lg auth-submit-btn" id="participant-login-btn">
              <span>Join Session →</span>
            </button>
          </form>

          <div class="auth-divider"><span>or</span></div>
          <div class="auth-switch-text">
            Are you a presenter?
            <button class="auth-link-btn" onclick="Auth.renderPresenterLogin()">Sign in here →</button>
          </div>
        </div>

        <!-- Decorative background -->
        <div class="join-bg-shape join-shape-1"></div>
        <div class="join-bg-shape join-shape-2"></div>
      </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Auto-fill session code from URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const codeInput = document.getElementById('join-code');
    if (code && codeInput) codeInput.value = code.toUpperCase();

    // Auto-uppercase session code
    if (codeInput) {
      codeInput.addEventListener('input', () => {
        codeInput.value = codeInput.value.toUpperCase();
      });
    }
  }

  // ── Keep old render() for compatibility — defaults to presenter login ───
  function render() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'participant') {
      renderParticipantJoin();
    } else {
      renderPresenterLogin();
    }
  }

  // ── Toggle password visibility ──────────────────────────────────────────
  function _togglePassword() {
    const input = document.getElementById('auth-password');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  }

  // ── Presenter submit ────────────────────────────────────────────────────
  async function _submitPresenter(e) {
    e.preventDefault();
    const btn = document.getElementById('presenter-login-btn');
    const errEl = document.getElementById('auth-error');
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();

    if (!username || !password) return;

    // Clear error
    errEl.classList.add('hidden');
    errEl.textContent = '';

    btn.innerHTML = `<div class="spinner"></div><span>Signing in…</span>`;
    btn.disabled = true;

    try {
      await _delay(600);

      // Credential check
      if (username !== 'superadmin' || password !== 'admin@123') {
        errEl.textContent = '⚠️ Invalid username or password.';
        errEl.classList.remove('hidden');
        return;
      }

      const userHash = generateUserHash(username, password);

      State.set({
        user: { email: username + '@slidemeter.com', username, userHash, role: 'presenter' },
        currentScreen: 'dashboard',
      });

      App.navigate('dashboard');
      Toast.show('Welcome back, ' + username + '! 👋', 'success');
    } finally {
      btn.innerHTML = '<span>Sign In to Dashboard</span>';
      btn.disabled = false;
    }
  }

  // ── Participant submit ──────────────────────────────────────────────────
  async function _submitParticipant(e) {
    e.preventDefault();
    const btn   = document.getElementById('participant-login-btn');
    const errEl = document.getElementById('join-error');
    const email = document.getElementById('join-email').value.trim().toLowerCase();
    const code  = document.getElementById('join-code').value.trim().toUpperCase();

    errEl.classList.add('hidden');
    errEl.textContent = '';

    // Validate email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errEl.textContent = 'Please enter a valid email address.';
      errEl.classList.remove('hidden');
      return;
    }

    if (!code) {
      errEl.textContent = 'Please enter the session code from your presenter.';
      errEl.classList.remove('hidden');
      return;
    }

    btn.innerHTML = `<div class="spinner"></div><span>Joining…</span>`;
    btn.disabled = true;

    try {
      await _delay(400);
      // Session-scoped hash: email + session code → unique per session
      // Same email in same session → always same hash → duplicate blocked per-slide
      const userHash = generateUserHash(email, code);

      State.set({
        user: { email, userHash, role: 'participant' },
        sessionCode: code,
        currentScreen: 'participant',
      });
      App.navigate('participant');
      Toast.show('Joined session successfully', 'success');
    } finally {
      btn.innerHTML = '<span>Join Session →</span>';
      btn.disabled = false;
    }
  }

  function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  return { render, renderPresenterLogin, renderParticipantJoin, _togglePassword, _submitPresenter, _submitParticipant };
})();
