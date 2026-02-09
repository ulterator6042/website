// global-gui-toggle.js
// Toggle all settings panels on/off

document.addEventListener('DOMContentLoaded', function () {
  const toggleBtn = document.getElementById('globalGuiToggle');
  const panels = [
    document.getElementById('particleSettingsPanel'),
    document.getElementById('textVideoSettingsPanel'),
    document.getElementById('designPanel'),
    document.getElementById('boxSettingsPanel'),
    document.getElementById('fontSwitcherPanel'),
    document.getElementById('palettePresetPanel'),
    document.getElementById('orbitColorsPanel'),
    document.getElementById('modelTunerPanel')
  ].filter(Boolean);

  let visible = true;
  toggleBtn.addEventListener('click', function () {
    visible = !visible;
    panels.forEach(panel => {
      panel.style.display = visible ? '' : 'none';
    });
  });
});
