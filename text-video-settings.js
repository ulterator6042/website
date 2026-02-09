// text-video-settings.js
// GUI for controlling text animation video size and position, with export

document.addEventListener('DOMContentLoaded', function () {
  const video = document.getElementById('textAnimationVideo');
  const container = document.getElementById('textVideoContainer');
  const panel = document.getElementById('textVideoSettingsPanel');

  let width = 480;
  let height = 120;
  let posX = 0.5;
  let posY = 0.2;

  // Restore settings from localStorage
  const saved = localStorage.getItem('textVideoSettings');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      if (typeof s.width === 'number') width = s.width;
      if (typeof s.height === 'number') height = s.height;
      if (typeof s.posX === 'number') posX = s.posX;
      if (typeof s.posY === 'number') posY = s.posY;
    } catch (e) {}
  }

  function applySettings() {
    video.style.width = width + 'px';
    video.style.height = height + 'px';
    container.style.left = (posX * 100) + 'vw';
    container.style.top = (posY * 100) + 'vh';
    container.style.transform = 'translate(-50%,-50%)';
  }

  function saveSettings() {
    localStorage.setItem('textVideoSettings', JSON.stringify({ width, height, posX, posY }));
  }

  // Set initial values
  document.getElementById('textVideoWidth').value = width;
  document.getElementById('textVideoHeight').value = height;
  document.getElementById('textVideoPosX').value = Math.round(posX * 100);
  document.getElementById('textVideoPosY').value = Math.round(posY * 100);
  applySettings();

  document.getElementById('textVideoWidth').addEventListener('input', function(e) {
    width = parseInt(e.target.value);
    applySettings();
    saveSettings();
  });
  document.getElementById('textVideoHeight').addEventListener('input', function(e) {
    height = parseInt(e.target.value);
    applySettings();
    saveSettings();
  });
  document.getElementById('textVideoPosX').addEventListener('input', function(e) {
    posX = parseInt(e.target.value) / 100;
    applySettings();
    saveSettings();
  });
  document.getElementById('textVideoPosY').addEventListener('input', function(e) {
    posY = parseInt(e.target.value) / 100;
    applySettings();
    saveSettings();
  });
  document.getElementById('textVideoSettingsClose').addEventListener('click', function() {
    panel.style.display = 'none';
  });
  document.getElementById('textVideoSettingsExport').addEventListener('click', function() {
    const settings = { width, height, posX, posY };
    const blob = new Blob([JSON.stringify(settings, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'text-video-settings.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  });
});
