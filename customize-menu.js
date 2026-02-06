document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('boxSettingsPanel');
  const toggle = document.getElementById('boxSettingsToggle');
  const closeBtn = document.getElementById('settingsClose');
  const tabs = document.querySelectorAll('.customize-tab');
  const panes = document.querySelectorAll('.customize-pane');
  const appearanceGuiContainer = document.getElementById('appearanceGuiContainer');

  if (toggle && panel) {
    toggle.addEventListener('click', () => {
      panel.classList.toggle('active');
    });
  }

  if (closeBtn && panel) {
    closeBtn.addEventListener('click', () => {
      panel.classList.remove('active');
    });
  }

  if (tabs.length && panes.length) {
    const setPane = (paneName) => {
      tabs.forEach(tab => {
        const isActive = tab.dataset.pane === paneName;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      panes.forEach(pane => {
        pane.classList.toggle('active', pane.dataset.pane === paneName);
      });
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        setPane(tab.dataset.pane);
      });
    });
  }

  if (!appearanceGuiContainer || !window.lil) {
    return;
  }

  const getVar = (name, fallback) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  };

  const storedSettings = (() => {
    try {
      return JSON.parse(localStorage.getItem('globalAppearance') || '{}');
    } catch (err) {
      return {};
    }
  })();

  const appearanceSettings = {
    primaryColor: storedSettings.primaryColor || getVar('--primary-color', '#c7d0dc'),
    secondaryColor: storedSettings.secondaryColor || getVar('--secondary-color', '#8a93a4'),
    accentColor: storedSettings.accentColor || getVar('--accent-color', '#d7dee7'),
    accentAlt: storedSettings.accentAlt || getVar('--accent-2', '#e1e6ef'),
    textColor: storedSettings.textColor || getVar('--text-color', '#f1f4f8'),
    textMuted: storedSettings.textMuted || getVar('--text-muted', 'rgba(241, 244, 248, 0.7)'),
    pageBg: storedSettings.pageBg || getVar('--page-bg', '#0f1216'),
    panelBg: storedSettings.panelBg || getVar('--panel-bg', 'rgba(18, 22, 26, 0.86)'),
    panelBorder: storedSettings.panelBorder || getVar('--panel-border', 'rgba(199, 208, 220, 0.25)')
  };

  const applyAppearance = () => {
    const root = document.documentElement.style;
    root.setProperty('--primary-color', appearanceSettings.primaryColor);
    root.setProperty('--secondary-color', appearanceSettings.secondaryColor);
    root.setProperty('--accent-color', appearanceSettings.accentColor);
    root.setProperty('--accent', appearanceSettings.accentColor);
    root.setProperty('--accent-2', appearanceSettings.accentAlt);
    root.setProperty('--text-color', appearanceSettings.textColor);
    root.setProperty('--text', appearanceSettings.textColor);
    root.setProperty('--text-muted', appearanceSettings.textMuted);
    root.setProperty('--page-bg', appearanceSettings.pageBg);
    root.setProperty('--panel-bg', appearanceSettings.panelBg);
    root.setProperty('--panel-border', appearanceSettings.panelBorder);

    localStorage.setItem('globalAppearance', JSON.stringify(appearanceSettings));
  };

  const appearanceGui = new window.lil.GUI({ container: appearanceGuiContainer });
  appearanceGui.domElement.style.width = '100%';

  const paletteFolder = appearanceGui.addFolder('Palette');
  paletteFolder.addColor(appearanceSettings, 'primaryColor').name('Primary').onChange(applyAppearance);
  paletteFolder.addColor(appearanceSettings, 'secondaryColor').name('Secondary').onChange(applyAppearance);
  paletteFolder.addColor(appearanceSettings, 'accentColor').name('Accent').onChange(applyAppearance);
  paletteFolder.addColor(appearanceSettings, 'accentAlt').name('Accent 2').onChange(applyAppearance);
  paletteFolder.addColor(appearanceSettings, 'textColor').name('Text').onChange(applyAppearance);
  paletteFolder.addColor(appearanceSettings, 'textMuted').name('Text Muted').onChange(applyAppearance);
  paletteFolder.open();

  const layoutFolder = appearanceGui.addFolder('Surfaces');
  layoutFolder.addColor(appearanceSettings, 'pageBg').name('Page BG').onChange(applyAppearance);
  layoutFolder.addColor(appearanceSettings, 'panelBg').name('Panel BG').onChange(applyAppearance);
  layoutFolder.addColor(appearanceSettings, 'panelBorder').name('Panel Border').onChange(applyAppearance);

  applyAppearance();
});
