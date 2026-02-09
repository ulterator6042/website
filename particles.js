// particles.js
// Particle effect: randomly placed small dark blue dots with parallax cursor reaction

document.addEventListener('DOMContentLoaded', function () {
  // Default settings
  let PARTICLE_COUNT = 80;
  let DOT_COLOR = '#353249';
  let DOT_SIZE = 3;
  let PARALLAX = 20;
  let BG_COLOR = '#f1eff5';
  let POS_X = 0.5;
  let POS_Y = 0.5;
  let PARTICLE_SPEED = 0.1;
  let PARTICLE_ENTROPY = 1.2;
  let PARTICLE_LINEAR_RATIO = 0.28; // 0 to 1

  // Restore settings from localStorage
  const saved = localStorage.getItem('particleSettings');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      if (typeof s.PARTICLE_COUNT === 'number') PARTICLE_COUNT = s.PARTICLE_COUNT;
      if (typeof s.DOT_COLOR === 'string') DOT_COLOR = s.DOT_COLOR;
      if (typeof s.DOT_SIZE === 'number') DOT_SIZE = s.DOT_SIZE;
      if (typeof s.PARALLAX === 'number') PARALLAX = s.PARALLAX;
      if (typeof s.BG_COLOR === 'string') BG_COLOR = s.BG_COLOR;
      if (typeof s.POS_X === 'number') POS_X = s.POS_X;
      if (typeof s.POS_Y === 'number') POS_Y = s.POS_Y;
      if (typeof s.PARTICLE_SPEED === 'number') PARTICLE_SPEED = s.PARTICLE_SPEED;
      if (typeof s.PARTICLE_ENTROPY === 'number') PARTICLE_ENTROPY = s.PARTICLE_ENTROPY;
      if (typeof s.PARTICLE_LINEAR_RATIO === 'number') PARTICLE_LINEAR_RATIO = s.PARTICLE_LINEAR_RATIO;
    } catch (e) {}
  }
  // Save settings to localStorage
  function saveSettings() {
    localStorage.setItem('particleSettings', JSON.stringify({
      PARTICLE_COUNT,
      DOT_COLOR,
      DOT_SIZE,
      PARALLAX,
      BG_COLOR,
      POS_X,
      POS_Y,
      PARTICLE_SPEED,
      PARTICLE_ENTROPY,
      PARTICLE_LINEAR_RATIO
    }));
  }

  let particles = [];
  let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '0';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    regenerateParticles();
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function regenerateParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Each particle gets a random size and opacity, and a random trajectory
      const sizeVariance = 1 + Math.random(); // 1 to 2
      const opacityVariance = 0.6 + Math.random() * 0.4; // 0.6 to 1
      const isLinear = Math.random() < PARTICLE_LINEAR_RATIO;
      let p = {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        baseX: 0,
        baseY: 0,
        size: DOT_SIZE * sizeVariance,
        opacity: opacityVariance,
        isLinear
      };
      if (isLinear) {
        // Linear: pick a direction and speed
        const angle = Math.random() * Math.PI * 2;
        p.vx = Math.cos(angle) * (PARTICLE_SPEED * 60 * (0.5 + PARTICLE_ENTROPY * Math.random()));
        p.vy = Math.sin(angle) * (PARTICLE_SPEED * 60 * (0.5 + PARTICLE_ENTROPY * Math.random()));
      } else {
        // Circular: floating
        p.angle = Math.random() * Math.PI * 2;
        p.speed = (0.5 + Math.random() * 0.5) * PARTICLE_SPEED * (0.5 + PARTICLE_ENTROPY * Math.random());
        p.phase = Math.random() * Math.PI * 2;
      }
      particles.push(p);
    }
  }

  regenerateParticles();

  // Mouse movement
  window.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  // GUI removed, settings logic and usage remain

  let time = 0;
  function drawParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles[i];
      // Parallax effect
      const dx = (mouse.x - canvas.width * POS_X) / PARALLAX;
      const dy = (mouse.y - canvas.height * POS_Y) / PARALLAX;
      let px = p.x + dx;
      let py = p.y + dy;
      if (p.isLinear) {
        // Linear motion
        p.x += p.vx * 0.016; // 60fps
        p.y += p.vy * 0.016;
        px = p.x + dx;
        py = p.y + dy;
        // Respawn if out of bounds
        if (p.x < -50 || p.x > canvas.width + 50 || p.y < -50 || p.y > canvas.height + 50) {
          // Reinitialize
          const edge = Math.floor(Math.random() * 4);
          if (edge === 0) { p.x = -10; p.y = Math.random() * canvas.height; } // left
          else if (edge === 1) { p.x = canvas.width + 10; p.y = Math.random() * canvas.height; } // right
          else if (edge === 2) { p.x = Math.random() * canvas.width; p.y = -10; } // top
          else { p.x = Math.random() * canvas.width; p.y = canvas.height + 10; } // bottom
          const angle = Math.random() * Math.PI * 2;
          p.vx = Math.cos(angle) * (PARTICLE_SPEED * 60 * (0.5 + PARTICLE_ENTROPY * Math.random()));
          p.vy = Math.sin(angle) * (PARTICLE_SPEED * 60 * (0.5 + PARTICLE_ENTROPY * Math.random()));
        }
      } else {
        // Circular/floating
        const t = time + p.phase;
        px += Math.cos(t * p.speed + p.angle) * 20 * PARTICLE_ENTROPY;
        py += Math.sin(t * p.speed + p.angle) * 20 * PARTICLE_ENTROPY;
      }
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = DOT_COLOR;
      ctx.globalAlpha = p.opacity;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function animate() {
    time += 0.01;
    drawParticles();
    requestAnimationFrame(animate);
  }

  animate();
});
