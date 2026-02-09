// morphing-text.js
// Organic text morphing effect using canvas and metaballs/ink simulation

const morphingTexts = [
  "I'm Matteo",
  "Product Designer"
];

const canvas = document.getElementById('morphingTextCanvas');
const ctx = canvas.getContext('2d');

let currentIdx = 0;
let nextIdx = 1;
let morphProgress = 0;
let morphing = false;
let lastSwitch = Date.now();
const morphDuration = 1800; // ms
const holdDuration = 1800; // ms

function drawMetaballText(text, alpha = 1, offset = 0) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '900 92px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.filter = `blur(${offset}px)`;
  ctx.fillStyle = '#18161e';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

function drawMorph() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!morphing) {
    drawMetaballText(morphingTexts[currentIdx]);
    return;
  }
  // Organic morph: fade, blur, and overlay
  const t = morphProgress;
  drawMetaballText(morphingTexts[currentIdx], 1 - t, t * 8);
  drawMetaballText(morphingTexts[nextIdx], t, (1 - t) * 8);
}

function animateMorph() {
  const now = Date.now();
  if (!morphing && now - lastSwitch > holdDuration) {
    morphing = true;
    morphProgress = 0;
  }
  if (morphing) {
    morphProgress += 1 / (morphDuration / 16);
    if (morphProgress >= 1) {
      morphing = false;
      currentIdx = nextIdx;
      nextIdx = (nextIdx + 1) % morphingTexts.length;
      lastSwitch = now;
      morphProgress = 0;
    }
  }
  drawMorph();
  requestAnimationFrame(animateMorph);
}

window.addEventListener('DOMContentLoaded', () => {
  if (canvas) animateMorph();
});
