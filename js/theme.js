/**
 * LivePoll Secure — Theme Management Module
 * Handles the "Create Theme" modal, live preview, and theme persistence.
 */

const ThemeManager = (() => {
  let modalEl = null;
  let currentTheme = null; // Temporary theme object being edited
  let onSaveCallback = null;

  const DEFAULT_THEMES = [
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
      id: 'theme_light',
      name: 'Corporate Light',
      logo: null,
      bgImage: null,
      bgColor: '#f8fafc',
      textColor: '#0f172a',
      fontFamily: 'Inter',
      visColours: ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1']
    }
  ];

  function init() {
    // Add themes to state if not present
    const state = State.get();
    if (!state.themes || state.themes.length === 0) {
      State.set({ 
        themes: DEFAULT_THEMES,
        activeThemeId: 'theme_default'
      });
    }
  }

  function openModal(themeId = null, callback = null) {
    onSaveCallback = callback;
    const state = State.get();
    
    if (themeId) {
      const existing = state.themes.find(t => t.id === themeId);
      currentTheme = JSON.parse(JSON.stringify(existing)); // Deep copy
    } else {
      currentTheme = {
        id: `theme_${Date.now()}`,
        name: 'My new theme',
        logo: null,
        bgImage: null,
        bgColor: '#f0f4f8',
        textColor: '#1a2547',
        fontFamily: 'Inter',
        visColours: ['#ff3366', '#33ffcc', '#ff9966', '#333366', '#cc3366']
      };
    }

    _renderModal();
  }

  function _renderModal() {
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'theme-modal-overlay';
      modalEl.className = 'modal-overlay';
      document.body.appendChild(modalEl);
    }

    modalEl.innerHTML = `
      <div class="theme-modal">
        <header class="modal-header">
          <h2 class="modal-title">Create Theme</h2>
          <button class="modal-close" onclick="ThemeManager.closeModal()">✕</button>
        </header>
        
        <div class="theme-modal-content">
          <!-- LEFT: PREVIEW -->
          <div class="theme-preview-pane">
            <div class="theme-preview-canvas" id="theme-preview-canvas">
              <div class="theme-preview-bg" id="theme-preview-bg"></div>
              <img class="theme-preview-logo" id="theme-preview-logo" alt="Logo" />
              <div class="theme-preview-content">
                <div class="theme-preview-question" id="theme-preview-question">Question goes here</div>
                <div class="theme-preview-chart" id="theme-preview-chart">
                  <!-- Bar chart simulation -->
                  <div class="bar-sim" style="height: 60%; background: var(--vis-0)"></div>
                  <div class="bar-sim" style="height: 40%; background: var(--vis-1)"></div>
                  <div class="bar-sim" style="height: 50%; background: var(--vis-2)"></div>
                  <div class="bar-sim" style="height: 45%; background: var(--vis-3)"></div>
                  <div class="bar-sim" style="height: 25%; background: var(--vis-4)"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT: CONTROLS -->
          <div class="theme-controls-pane">
            <div class="form-group">
              <label class="label">Theme name</label>
              <input type="text" class="input" value="${currentTheme.name}" 
                oninput="ThemeManager._update('name', this.value)" placeholder="My new theme" />
            </div>

            <div class="control-row">
              <label class="label">Logo</label>
              <div class="upload-btn-wrap">
                <button class="btn btn-ghost btn-sm" onclick="document.getElementById('theme-logo-input').click()">＋ Add</button>
                <input type="file" id="theme-logo-input" hidden accept="image/*" onchange="ThemeManager._handleImage(event, 'logo')" />
              </div>
            </div>

            <div class="control-row">
              <label class="label">Background image</label>
              <div class="upload-btn-wrap">
                <button class="btn btn-ghost btn-sm" onclick="document.getElementById('theme-bg-input').click()">＋ Add</button>
                <input type="file" id="theme-bg-input" hidden accept="image/*" onchange="ThemeManager._handleImage(event, 'bgImage')" />
              </div>
            </div>

            <div class="control-row">
              <label class="label">Background colour</label>
              <div class="color-circle-wrap">
                <input type="color" value="${currentTheme.bgColor}" oninput="ThemeManager._update('bgColor', this.value)" />
              </div>
            </div>

            <div class="control-row">
              <label class="label">Text</label>
              <div class="text-controls">
                <select class="select select-sm" onchange="ThemeManager._update('fontFamily', this.value)">
                  <option value="Inter" ${currentTheme.fontFamily === 'Inter' ? 'selected' : ''}>Inter</option>
                  <option value="Roboto" ${currentTheme.fontFamily === 'Roboto' ? 'selected' : ''}>Roboto</option>
                  <option value="Plus Jakarta Sans" ${currentTheme.fontFamily === 'Plus Jakarta Sans' ? 'selected' : ''}>Plus Jakarta...</option>
                </select>
                <div class="color-circle-wrap">
                   <input type="color" value="${currentTheme.textColor}" oninput="ThemeManager._update('textColor', this.value)" />
                </div>
              </div>
            </div>

            <div class="form-group" style="margin-top: var(--sp-4)">
              <label class="label">Visualisation colours <span class="info-icon">ⓘ</span></label>
              <div class="palette-picker">
                <div class="palette-preview" id="palette-preview">
                  ${currentTheme.visColours.map((c, i) => `
                    <div class="palette-swatch" style="background:${c}" onclick="ThemeManager._editColor(${i})"></div>
                  `).join('')}
                </div>
                <select class="select select-sm" onchange="ThemeManager._applyPreset(this.value)">
                   <option value="default">AhaSlides (Default)</option>
                   <option value="vibrant">Vibrant</option>
                   <option value="pastel">Pastel</option>
                   <option value="mono">Monochrome</option>
                </select>
              </div>
            </div>

            <div class="modal-footer">
              <button class="btn btn-primary btn-block" onclick="ThemeManager._save()">Save</button>
            </div>
          </div>
        </div>
      </div>
    `;

    _updatePreview();
    modalEl.classList.add('active');
  }

  function _updatePreview() {
    const canvas = document.getElementById('theme-preview-canvas');
    const bg = document.getElementById('theme-preview-bg');
    const logo = document.getElementById('theme-preview-logo');
    const question = document.getElementById('theme-preview-question');

    if (canvas) {
      canvas.style.fontFamily = currentTheme.fontFamily;
      canvas.style.color = currentTheme.textColor;
      
      // CSS variables for vis colors
      currentTheme.visColours.forEach((c, i) => {
        canvas.style.setProperty(`--vis-${i}`, c);
      });
    }

    if (bg) {
      if (currentTheme.bgImage) {
        bg.style.backgroundImage = `url(${currentTheme.bgImage})`;
        bg.style.backgroundColor = 'transparent';
      } else {
        bg.style.backgroundImage = 'none';
        bg.style.backgroundColor = currentTheme.bgColor;
      }
    }

    if (logo) {
      if (currentTheme.logo) {
        logo.src = currentTheme.logo;
        logo.classList.remove('hidden');
      } else {
        logo.classList.add('hidden');
      }
    }

    if (question) {
      question.style.color = currentTheme.textColor;
    }
  }

  function _handleImage(event, key) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      currentTheme[key] = e.target.result;
      _renderModal();
    };
    reader.readAsDataURL(file);
  }

  function _update(key, val) {
    currentTheme[key] = val;
    _updatePreview();
  }

  function _applyPreset(preset) {
    const presets = {
      default: ['#ff3366', '#33ffcc', '#ff9966', '#333366', '#cc3366'],
      vibrant: ['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'],
      pastel:  ['#fda4af', '#c4b5fd', '#a5f3fc', '#6ee7b7', '#fcd34d'],
      mono:    ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1'],
    };
    if (presets[preset]) {
      currentTheme.visColours = presets[preset];
      _renderModal();
    }
  }

  function _save() {
    const state = State.get();
    const themes = [...(state.themes || [])];
    const idx = themes.findIndex(t => t.id === currentTheme.id);
    
    if (idx >= 0) {
      themes[idx] = currentTheme;
    } else {
      themes.push(currentTheme);
    }

    State.set({ themes, activeThemeId: currentTheme.id });
    
    // Apply theme to current presentation settings
    const presSettings = { 
      ...state.presSettings,
      themeBgColor: currentTheme.bgColor,
      themeBgImage: currentTheme.bgImage,
      themeLogo: currentTheme.logo,
      themeVisColours: currentTheme.visColours,
      themeTextColor: currentTheme.textColor,
      themeFontFamily: currentTheme.fontFamily
    };
    State.set({ presSettings });

    closeModal();
    if (onSaveCallback) onSaveCallback(currentTheme);
    Toast.show('Theme saved and applied!', 'success');
  }

  function closeModal() {
    if (modalEl) modalEl.classList.remove('active');
  }

  function applyTheme(themeId) {
    const state = State.get();
    const theme = state.themes.find(t => t.id === themeId);
    if (!theme) return;

    State.set({ activeThemeId: themeId });
    const presSettings = { 
      ...state.presSettings,
      themeBgColor: theme.bgColor,
      themeBgImage: theme.bgImage,
      themeLogo: theme.logo,
      themeVisColours: theme.visColours,
      themeTextColor: theme.textColor,
      themeFontFamily: theme.fontFamily
    };
    State.set({ presSettings });
    Toast.show(`Theme "${theme.name}" applied`, 'info');
  }

  return {
    init, openModal, closeModal, _handleImage, _update, _applyPreset, _save, applyTheme
  };
})();
