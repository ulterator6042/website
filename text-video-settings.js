// text-video-settings.js
// GUI for controlling text animation video size and position, with export

document.addEventListener('DOMContentLoaded', function () {
  // Settings logic only, menu removed
  let width = 800;
  let height = 120;
  let posX = 0.13;
  let posY = 0.05;

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

  // Apply settings to video and container if present
  const video = document.getElementById('textAnimationVideo');
  const container = document.getElementById('textVideoContainer');
  if (video && container) {
    video.style.width = width + 'px';
    video.style.height = height + 'px';
    container.style.left = (posX * 100) + 'vw';
    container.style.top = (posY * 100) + 'vh';
    container.style.transform = 'translate(-50%,-50%)';
  }
});
