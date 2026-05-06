/**
 * SlideMeter — Presenter Dashboard
 * Home screen with full presentations management
 * Uses Lucide icons throughout
 */

const Dashboard = (() => {

  // Call after every innerHTML render to activate Lucide SVGs
  function _icons() {
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // ── Main render ────────────────────────────────────────────────────────
  function render() {
    const el = document.getElementById('screen-dashboard');
    const state = State.get();
    const user = state.user;
    const username = user?.username || user?.email?.split('@')[0] || 'Presenter';
    const initials = username.slice(0, 2).toUpperCase();

    el.innerHTML = `
      <div class="dash-layout">

        <!-- ── Sidebar ── -->
        <aside class="dash-sidebar">
          <div class="dash-sidebar-logo">
            <div class="dash-logo-icon">
              <i data-lucide="bar-chart-2" class="icon-lg" style="color:#fff"></i>
            </div>
            <div class="dash-logo-text">Slide<span>Meter</span></div>
          </div>

          <nav class="dash-nav">
            <button class="dash-nav-item active" id="dash-nav-home" onclick="Dashboard._setTab('home')">
              <i data-lucide="home" class="icon-md dash-nav-icon"></i><span>Home</span>
            </button>
            <button class="dash-nav-item" id="dash-nav-presentations" onclick="Dashboard._setTab('presentations')">
              <i data-lucide="layout-list" class="icon-md dash-nav-icon"></i><span>My Presentations</span>
              <span class="dash-nav-badge">${state.presentations?.length || 0}</span>
            </button>
            <button class="dash-nav-item" id="dash-nav-settings" onclick="Dashboard._setTab('settings')">
              <i data-lucide="settings" class="icon-md dash-nav-icon"></i><span>Settings</span>
            </button>
          </nav>

          <div class="dash-sidebar-footer">
            <div class="dash-user-chip">
              <div class="dash-user-avatar">${initials}</div>
              <div class="dash-user-info">
                <div class="dash-user-name">${username}</div>
                <div class="dash-user-role">Presenter</div>
              </div>
            </div>
            <button class="dash-signout-btn" onclick="App.logout()">
              <i data-lucide="log-out" class="icon-sm"></i> Sign Out
            </button>
          </div>
        </aside>

        <!-- ── Main Content ── -->
        <main class="dash-main" id="dash-main-area">
          ${_renderHomeTab(state)}
        </main>
      </div>

      <!-- Create Presentation Modal -->
      <div class="dash-modal-backdrop hidden" id="new-pres-modal">
        <div class="dash-modal">
          <div class="dash-modal-title">New Presentation</div>
          <div class="form-group" style="margin-top:16px">
            <label class="label" for="new-pres-name">Presentation Name</label>
            <input id="new-pres-name" class="input" type="text"
              placeholder="e.g. Q2 Town Hall, Team Survey…"
              maxlength="60"
              onkeydown="if(event.key==='Enter')Dashboard._confirmCreate()" />
          </div>
          <div class="dash-modal-actions">
            <button class="btn btn-ghost btn-sm" onclick="Dashboard._closeModal()">Cancel</button>
            <button class="btn btn-primary btn-sm" onclick="Dashboard._confirmCreate()">
              <i data-lucide="plus" class="icon-sm"></i> Create
            </button>
          </div>
        </div>
      </div>

      <!-- Rename Modal -->
      <div class="dash-modal-backdrop hidden" id="rename-pres-modal">
        <div class="dash-modal">
          <div class="dash-modal-title">Rename Presentation</div>
          <div class="form-group" style="margin-top:16px">
            <label class="label" for="rename-pres-input">New Name</label>
            <input id="rename-pres-input" class="input" type="text"
              maxlength="60"
              onkeydown="if(event.key==='Enter')Dashboard._confirmRename()" />
          </div>
          <div class="dash-modal-actions">
            <button class="btn btn-ghost btn-sm" onclick="Dashboard._closeModal()">Cancel</button>
            <button class="btn btn-primary btn-sm" onclick="Dashboard._confirmRename()">
              <i data-lucide="check" class="icon-sm"></i> Save
            </button>
          </div>
        </div>
      </div>

      <!-- Delete Confirm Modal -->
      <div class="dash-modal-backdrop hidden" id="delete-pres-modal">
        <div class="dash-modal">
          <div class="dash-modal-title" style="color:var(--accent-danger)">
            <i data-lucide="trash-2" class="icon-lg" style="vertical-align:middle;margin-right:6px"></i>Delete Presentation
          </div>
          <p style="margin-top:12px;color:var(--text-secondary);font-size:14px">
            Are you sure you want to delete <strong id="delete-pres-name-label"></strong>?
            This action cannot be undone.
          </p>
          <div class="dash-modal-actions" style="margin-top:20px">
            <button class="btn btn-ghost btn-sm" onclick="Dashboard._closeModal()">Cancel</button>
            <button class="btn btn-danger btn-sm" onclick="Dashboard._confirmDelete()">
              <i data-lucide="trash-2" class="icon-sm"></i> Delete
            </button>
          </div>
        </div>
      </div>
    `;

    _icons();
    _attachListeners();
  }

  // ── Event delegation for pres actions (avoids inline onclick escaping issues) ──
  function _attachListeners() {
    const el = document.getElementById('screen-dashboard');
    if (!el) return;
    // Remove any previous listener by cloning (avoids duplicates on re-render)
    el.addEventListener('click', _handleDashAction);
  }

  function _handleDashAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id     = btn.dataset.id;
    const name   = btn.dataset.name || '';
    if (action === 'select')  Dashboard._selectPresentation(id);
    if (action === 'edit')    Dashboard._selectAndEdit(id);
    if (action === 'present') Dashboard._selectAndPresent(id);
    if (action === 'rename')  Dashboard._renamePres(id, name);
    if (action === 'delete')  Dashboard._showDeleteModal(id, name);
  }

  // ── Tab: Home ──────────────────────────────────────────────────────────
  function _renderHomeTab(state) {
    const presentations = state.presentations || [];
    const activePres    = presentations.find(p => p.id === state.activePresentationId);
    const sessionCode   = state.sessionCode || '------';
    const username      = state.user?.username || 'Presenter';

    return `
      <header class="dash-topbar">
        <div class="dash-topbar-left">
          <div class="dash-welcome">Welcome back, <strong>${username}</strong>!</div>
        </div>
        <div class="dash-topbar-right">
          <div class="dash-session-pill">
            <span class="dash-session-dot"></span>
            <i data-lucide="wifi" class="icon-sm"></i>
            <strong>${sessionCode}</strong>
            <button class="dash-copy-btn" onclick="Dashboard._copyCode()" title="Copy">
              <i data-lucide="copy" class="icon-sm"></i>
            </button>
            <button class="dash-qr-btn" onclick="QRHelper.showShareModal()" title="QR">
              <i data-lucide="qr-code" class="icon-sm"></i>
            </button>
          </div>
        </div>
      </header>

      <div class="dash-actions-row">
        <button class="dash-action-card dash-action-primary" onclick="Dashboard._newPresentation()">
          <i data-lucide="plus-circle" class="dash-action-icon icon-xl"></i>
          <div class="dash-action-label">New Presentation</div>
          <div class="dash-action-sub">Create a fresh poll set</div>
        </button>
        <button class="dash-action-card" onclick="${activePres ? "Dashboard._openEditor()" : "Dashboard._newPresentation()"}">
          <i data-lucide="pencil" class="dash-action-icon icon-xl"></i>
          <div class="dash-action-label">Edit Current</div>
          <div class="dash-action-sub">${activePres ? _truncate(activePres.name, 22) : 'None selected'}</div>
        </button>
        <button class="dash-action-card" onclick="Dashboard._present()">
          <i data-lucide="play-circle" class="dash-action-icon icon-xl"></i>
          <div class="dash-action-label">Present Now</div>
          <div class="dash-action-sub">Go fullscreen</div>
        </button>
        <button class="dash-action-card" onclick="QRHelper.showShareModal()">
          <i data-lucide="share-2" class="dash-action-icon icon-xl"></i>
          <div class="dash-action-label">Invite Participants</div>
          <div class="dash-action-sub">Share QR or link</div>
        </button>
      </div>

      <div class="dash-grid">
        <div class="dash-card dash-card-wide">
          <div class="dash-card-header">
            <div class="dash-card-title">
              <i data-lucide="layout-list" class="icon-md" style="margin-right:6px;vertical-align:middle"></i>
              Recent Presentations
            </div>
            <button class="btn btn-primary btn-sm" onclick="Dashboard._newPresentation()">
              <i data-lucide="plus" class="icon-sm"></i> New
            </button>
          </div>
          <div class="dash-pres-list">${_renderPresList(presentations, state.activePresentationId)}</div>
        </div>

        <div class="dash-card">
          <div class="dash-card-header">
            <div class="dash-card-title">
              <i data-lucide="bar-chart-3" class="icon-md" style="margin-right:6px;vertical-align:middle"></i>
              Session Stats
            </div>
          </div>
          <div class="dash-stats-grid">
            <div class="dash-stat">
              <div class="dash-stat-value">${presentations.length}</div>
              <div class="dash-stat-label">Presentations</div>
            </div>
            <div class="dash-stat">
              <div class="dash-stat-value">${state.slides?.length || 0}</div>
              <div class="dash-stat-label">Active Slides</div>
            </div>
            <div class="dash-stat">
              <div class="dash-stat-value">${_getTotalVoters(state)}</div>
              <div class="dash-stat-label">Participants</div>
            </div>
            <div class="dash-stat" style="font-family:var(--font-mono)">
              <div class="dash-stat-value" style="font-size:18px">${sessionCode}</div>
              <div class="dash-stat-label">Session Code</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── Presentations list rows ────────────────────────────────────────────
  function _renderPresList(presentations, activePresentationId) {
    if (!presentations.length) {
      return `
        <div class="dash-empty-state">
          <i data-lucide="inbox" class="icon-2xl dash-empty-icon"></i>
          <div class="dash-empty-title">No presentations yet</div>
          <div class="dash-empty-sub">Create your first presentation to get started</div>
          <button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="Dashboard._newPresentation()">
            <i data-lucide="plus" class="icon-sm"></i> Create Presentation
          </button>
        </div>`;
    }

    return presentations.map(pres => {
      const isActive   = pres.id === activePresentationId;
      const slideCount = pres.slides?.length || 0;
      const voteCount  = Object.values(pres.votes || {}).reduce((s, v) => s + Object.keys(v).length, 0);
      const date       = pres.updatedAt ? new Date(pres.updatedAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
      const code       = pres.sessionCode || '------';

      return `
        <div class="dash-pres-row ${isActive ? 'active' : ''}">
          <div class="dash-pres-thumb">
            <i data-lucide="presentation" class="icon-lg" style="color:#fff"></i>
          </div>
          <div class="dash-pres-info" data-action="select" data-id="${pres.id}" style="cursor:pointer;flex:1;min-width:0">
            <div class="dash-pres-name">
              ${pres.name}
              ${isActive ? '<span class="dash-active-badge">Active</span>' : ''}
            </div>
            <div class="dash-pres-meta">
              <span><i data-lucide="layers" class="icon-xs"></i> ${slideCount} slide${slideCount !== 1 ? 's' : ''}</span>
              <span><i data-lucide="check-square" class="icon-xs"></i> ${voteCount} vote${voteCount !== 1 ? 's' : ''}</span>
              <span class="dash-code-badge"><i data-lucide="wifi" class="icon-xs"></i> ${code}</span>
              <span><i data-lucide="clock" class="icon-xs"></i> ${date}</span>
            </div>
          </div>
          <div class="dash-pres-actions">
            <button class="dash-pres-btn" data-action="edit" data-id="${pres.id}" title="Edit">
              <i data-lucide="pencil" class="icon-sm"></i>
            </button>
            <button class="dash-pres-btn" data-action="present" data-id="${pres.id}" title="Present">
              <i data-lucide="play" class="icon-sm"></i>
            </button>
            <button class="dash-pres-btn" data-action="rename" data-id="${pres.id}" data-name="${pres.name.replace(/"/g, '&quot;')}" title="Rename">
              <i data-lucide="type" class="icon-sm"></i>
            </button>
            <button class="dash-pres-btn dash-pres-btn-danger" data-action="delete" data-id="${pres.id}" data-name="${pres.name.replace(/"/g, '&quot;')}" title="Delete">
              <i data-lucide="trash-2" class="icon-sm"></i>
            </button>
          </div>
        </div>`;
    }).join('');
  }

  // ── Tab switching ──────────────────────────────────────────────────────
  function _setTab(tab) {
    document.querySelectorAll('.dash-nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`dash-nav-${tab}`)?.classList.add('active');

    const main = document.getElementById('dash-main-area');
    if (!main) return;
    const state = State.get();

    if      (tab === 'home')          main.innerHTML = _renderHomeTab(state);
    else if (tab === 'presentations') main.innerHTML = _renderPresentationsTab(state);
    else if (tab === 'settings')      main.innerHTML = _renderSettingsTab(state);

    _icons();
    _attachPresentationsListeners(main);
  }

  function _attachPresentationsListeners(container) {
    container?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id     = btn.dataset.id;
      const name   = btn.dataset.name || '';
      if (action === 'select')  Dashboard._selectPresentation(id);
      if (action === 'edit')    Dashboard._selectAndEdit(id);
      if (action === 'present') Dashboard._selectAndPresent(id);
      if (action === 'rename')  Dashboard._renamePres(id, name);
      if (action === 'delete')  Dashboard._showDeleteModal(id, name);
    });
  }

  // ── Tab: All Presentations ─────────────────────────────────────────────
  function _renderPresentationsTab(state) {
    const presentations = state.presentations || [];
    return `
      <header class="dash-topbar">
        <div class="dash-topbar-left">
          <div class="dash-welcome"><strong>My Presentations</strong></div>
        </div>
        <div class="dash-topbar-right">
          <button class="btn btn-primary btn-sm" onclick="Dashboard._newPresentation()">
            <i data-lucide="plus" class="icon-sm"></i> New Presentation
          </button>
        </div>
      </header>
      <div style="padding:24px 32px">
        <div class="dash-pres-grid">${_renderPresCards(presentations, state.activePresentationId)}</div>
      </div>
    `;
  }

  function _renderPresCards(presentations, activePresentationId) {
    if (!presentations.length) {
      return `
        <div class="dash-empty-state" style="grid-column:1/-1">
          <i data-lucide="inbox" class="icon-2xl dash-empty-icon"></i>
          <div class="dash-empty-title">No presentations yet</div>
          <div class="dash-empty-sub">Create your first presentation to start polling</div>
          <button class="btn btn-primary" style="margin-top:16px" onclick="Dashboard._newPresentation()">
            <i data-lucide="plus" class="icon-sm"></i> Create First Presentation
          </button>
        </div>`;
    }

    return presentations.map(pres => {
      const isActive   = pres.id === activePresentationId;
      const slideCount = pres.slides?.length || 0;
      const voteCount  = Object.values(pres.votes || {}).reduce((s, v) => s + Object.keys(v).length, 0);
      const date       = pres.createdAt ? new Date(pres.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
      const code       = pres.sessionCode || '------';
      const safeId     = pres.id;
      const safeName   = pres.name.replace(/"/g, '&quot;');

      return `
        <div class="dash-pres-card ${isActive ? 'active' : ''}">
          <div class="dash-pres-card-top">
            <div class="dash-pres-card-icon">
              <i data-lucide="presentation" class="icon-xl" style="color:#fff"></i>
            </div>
            ${isActive ? '<span class="dash-active-badge">Active</span>' : ''}
          </div>
          <div class="dash-pres-card-name" title="${safeName}">${pres.name}</div>
          <div class="dash-pres-card-meta">
            <span><i data-lucide="layers" class="icon-xs"></i> ${slideCount} slides</span>
            <span><i data-lucide="check-square" class="icon-xs"></i> ${voteCount} votes</span>
          </div>
          <div class="dash-code-badge" style="margin:0">
            <i data-lucide="wifi" class="icon-xs"></i> ${code}
          </div>
          <div class="dash-pres-card-date">
            <i data-lucide="calendar" class="icon-xs"></i> Created ${date}
          </div>
          <div class="dash-pres-card-actions">
            <button class="btn btn-primary btn-sm" data-action="edit" data-id="${safeId}">
              <i data-lucide="pencil" class="icon-sm"></i> Edit
            </button>
            <button class="btn btn-secondary btn-sm" data-action="present" data-id="${safeId}">
              <i data-lucide="play" class="icon-sm"></i> Present
            </button>
          </div>
          <div class="dash-pres-card-more">
            <button class="dash-pres-btn" data-action="rename" data-id="${safeId}" data-name="${safeName}" title="Rename">
              <i data-lucide="type" class="icon-sm"></i> Rename
            </button>
            <button class="dash-pres-btn dash-pres-btn-danger" data-action="delete" data-id="${safeId}" data-name="${safeName}" title="Delete">
              <i data-lucide="trash-2" class="icon-sm"></i> Delete
            </button>
          </div>
        </div>`;
    }).join('');
  }

  // ── Tab: Settings ─────────────────────────────────────────────────────
  function _renderSettingsTab(state) {
    return `
      <header class="dash-topbar">
        <div class="dash-topbar-left">
          <div class="dash-welcome"><strong>Settings</strong></div>
        </div>
      </header>
      <div style="padding:24px 32px;max-width:560px">
        <div class="dash-card" style="padding:24px">
          <div class="dash-card-title" style="margin-bottom:16px">Account</div>
          <div class="form-group">
            <label class="label">Username</label>
            <input class="input" value="${state.user?.username || ''}" readonly style="opacity:0.6;cursor:not-allowed" />
          </div>
          <div class="form-group">
            <label class="label">Role</label>
            <input class="input" value="Presenter" readonly style="opacity:0.6;cursor:not-allowed" />
          </div>
          <div class="form-group">
            <label class="label">Active Session Code</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input class="input" value="${state.sessionCode || ''}" readonly style="font-family:var(--font-mono);letter-spacing:0.12em" />
              <button class="btn btn-ghost btn-sm" onclick="Dashboard._copyCode()">
                <i data-lucide="copy" class="icon-sm"></i>
              </button>
            </div>
          </div>
          <button class="btn btn-danger btn-sm" style="margin-top:8px" onclick="App.logout()">
            <i data-lucide="log-out" class="icon-sm"></i> Sign Out
          </button>
        </div>
      </div>
    `;
  }

  // ── Presentation Actions ───────────────────────────────────────────────
  let _pendingRenameId  = null;
  let _pendingDeleteId  = null;
  let _pendingDeleteName = null;

  function _newPresentation() {
    document.getElementById('new-pres-name').value = '';
    document.getElementById('new-pres-modal').classList.remove('hidden');
    _icons();
    setTimeout(() => document.getElementById('new-pres-name')?.focus(), 50);
  }

  function _confirmCreate() {
    const name = document.getElementById('new-pres-name').value.trim();
    if (!name) { Toast.show('Please enter a name', 'warning'); return; }
    _closeModal();
    State.createPresentation(name);
    App.navigate('editor');
    Toast.show(`"${name}" created!`, 'success');
  }

  function _closeModal() {
    ['new-pres-modal', 'rename-pres-modal', 'delete-pres-modal'].forEach(id => {
      document.getElementById(id)?.classList.add('hidden');
    });
  }

  function _renamePres(id, currentName) {
    _pendingRenameId = id;
    const input = document.getElementById('rename-pres-input');
    input.value = currentName;
    document.getElementById('rename-pres-modal').classList.remove('hidden');
    _icons();
    setTimeout(() => { input.focus(); input.select(); }, 50);
  }

  function _confirmRename() {
    const name = document.getElementById('rename-pres-input').value.trim();
    if (!name || !_pendingRenameId) return;
    _closeModal();
    State.renamePresentation(_pendingRenameId, name);
    _pendingRenameId = null;
    Toast.show('Presentation renamed', 'success');
    render();
  }

  function _showDeleteModal(id, name) {
    _pendingDeleteId   = id;
    _pendingDeleteName = name;
    const label = document.getElementById('delete-pres-name-label');
    if (label) label.textContent = `"${name}"`;
    document.getElementById('delete-pres-modal').classList.remove('hidden');
    _icons();
  }

  function _confirmDelete() {
    if (!_pendingDeleteId) return;
    const name = _pendingDeleteName;
    _closeModal();
    State.deletePresentation(_pendingDeleteId);
    _pendingDeleteId   = null;
    _pendingDeleteName = null;
    Toast.show(`"${name}" deleted`, 'info');
    render();
  }

  function _selectPresentation(id) {
    State.setActivePresentation(id);
    Toast.show('Presentation selected', 'info');
    render();
  }

  function _selectAndEdit(id) {
    State.setActivePresentation(id);
    App.navigate('editor');
  }

  function _selectAndPresent(id) {
    State.setActivePresentation(id);
    App.navigate('presentation');
  }

  function _openEditor() { App.navigate('editor'); }
  function _present()    { App.navigate('presentation'); }

  function _copyCode() {
    const code = State.get().sessionCode;
    navigator.clipboard.writeText(code)
      .then(() => Toast.show(`Code "${code}" copied!`, 'info'))
      .catch(() => Toast.show(`Session: ${code}`, 'info'));
  }

  function _getTotalVoters(state) {
    const all = new Set();
    Object.values(state.votes || {}).forEach(sv => Object.keys(sv).forEach(h => all.add(h)));
    return all.size;
  }

  function _truncate(str, len) {
    return str.length > len ? str.slice(0, len) + '…' : str;
  }

  return {
    render,
    _setTab, _newPresentation, _confirmCreate, _closeModal,
    _renamePres, _confirmRename,
    _showDeleteModal, _confirmDelete,
    _selectPresentation, _selectAndEdit, _selectAndPresent,
    _openEditor, _present, _copyCode,
  };
})();
