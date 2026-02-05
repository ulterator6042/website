const downloadButton = document.getElementById('downloadButton');
const sound = document.getElementById('sound');
const modelContainer = document.getElementById('modelContainer');

// Mobile fallback elements (added in index.html)
const mobileFallback = document.getElementById('mobileFallback');
const load3DButton = document.getElementById('load3DButton');

// Three.js Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, modelContainer.clientWidth / modelContainer.clientHeight, 0.1, 1000);

// Detect mobile device
const isMobileDevice = /Android|WebOS|iPhone|iPad|iPod|Opera Mini/i.test(navigator.userAgent);
const isLowPowerDevice = navigator.deviceMemory && navigator.deviceMemory <= 4;

const renderer = new THREE.WebGLRenderer({
  antialias: !isLowPowerDevice,
  alpha: true,
  powerPreference: isMobileDevice ? 'low-power' : 'high-performance'
});

// Lower pixel ratio for mobile/low-power devices to save GPU
const effectivePixelRatio = (isMobileDevice || isLowPowerDevice) ? Math.min(window.devicePixelRatio || 1, 1) : (window.devicePixelRatio || 1);
renderer.setSize(modelContainer.clientWidth, modelContainer.clientHeight);
renderer.setPixelRatio(effectivePixelRatio);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = !isMobileDevice && !isLowPowerDevice;
modelContainer.appendChild(renderer.domElement);

// Better renderer settings for PBR and color
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

camera.position.z = isMobileDevice ? 2.8 : 2;

// Lighting (richer environment with multiple light sources)
const ambientLight = new THREE.AmbientLight(0xe60f07, 0.3);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x666666, 0.4);
hemiLight.position.set(0, 50, 0);
scene.add(hemiLight);

const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.15);
directionalLight1.position.set(-10, 6, 5);
directionalLight1.castShadow = true;
scene.add(directionalLight1);

const directionalLight2 = new THREE.DirectionalLight(0x8a45f6, 1.1);
directionalLight2.position.set(-5, -3, 5);
scene.add(directionalLight2);

// Soft colored rim/fill point lights
const point1 = new THREE.PointLight(0xffbfa8, 0.6, 10);
point1.position.set(2.5, 1.5, 2);
scene.add(point1);

const point2 = new THREE.PointLight(0x8fb6ff, 1.15, 10);
point2.position.set(-2.5, 1, 3);
scene.add(point2);

const point3 = new THREE.PointLight(0xffffff, 0.3, 15);
point3.position.set(0, -3, 5);
scene.add(point3);

// Load 3D Model
const loader = new THREE.GLTFLoader();
let model = null;

console.log('Initializing loader and renderer...');

// Configure DRACO loader for compressed meshes
if (THREE.DRACOLoader) {
  const dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('libs/draco/');
  loader.setDRACOLoader(dracoLoader);
  console.log('DRACOLoader configured with decoder path libs/draco/');
} else {
  console.warn('THREE.DRACOLoader not available — compressed meshes may fail to load');
}

// Add error handler for DRACO issues
loader.manager.onError = function(url) {
  console.error('Failed to load resource:', url);
};

// Fallback: if model doesn't load within this timeout, add a cube so we can see rendering
let fallbackTimer = null;
function createFallbackCube() {
  console.warn('Using fallback cube — model did not load.');
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ metalness: 1.0, roughness: 0.15, color: 0xdddddd });
  const cube = new THREE.Mesh(geo, mat);
  cube.castShadow = true;
  cube.receiveShadow = true;
  scene.add(cube);
  model = cube;
}

// Give the GLTF loader a bit more time for external .bin/.wasm fetches
fallbackTimer = setTimeout(() => {
  if (!model) createFallbackCube();
}, 8000);

// Decide whether to auto-load the 3D model. On phones/low-power devices we wait for explicit user action.
const shouldAutoLoadModel = !isLowPowerDevice;

// Prefer a lighter model first for mobile devices
const modelUrls = isMobileDevice ? ['3d/3d_nodraco.glb', '3d/3d.glb', '3d/3d.gltf', '3d/abstract.glb', '3d/abstract/scene.gltf'] : ['3d/abstract.glb', '3d/abstract/scene.gltf', '3d/3d_nodraco.glb', '3d/3d.glb', '3d/3d.gltf'];
let attempt = 0;
let startedLoading = false;
function tryLoadNext() {
  if (attempt >= modelUrls.length) {
    console.error('All model load attempts failed');
    if (!model) createFallbackCube();
    return;
  }

  const url = modelUrls[attempt++];
  console.log('Attempting to load model:', url);

  loader.load(url, (gltf) => {
    model = gltf.scene;
    
    // Log scene structure for debugging
    console.log('Raw scene:', model);
    console.log('Scene children:', model.children.length);
    model.children.forEach((child, idx) => {
      console.log(`Child ${idx}:`, child.type, child.name, child);
    });
    
    // Center and scale the model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    console.log('Bounding box size:', size);
    console.log('Bounding box center:', center);
    
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim === 0) {
      console.warn('⚠️ Model has zero bounding box! Checking scene graph...');
      model.traverse((node) => {
        console.log('Node:', node.type, node.name, 'isMesh:', node.isMesh);
      });
    }
    
    const targetSize = isMobileDevice ? 1.4 : 2.8;
    const scale = maxDim === 0 ? 1 : targetSize / maxDim;
    console.log('Calculated scale:', scale, 'maxDim:', maxDim);
    
    model.scale.multiplyScalar(scale);
    if (maxDim > 0) {
      model.position.sub(center.multiplyScalar(scale));
    }
    
    // Count meshes
    let meshCount = 0;
    model.traverse((child) => {
      if (child.isMesh) {
        meshCount++;
        child.material = new THREE.MeshStandardMaterial({
          metalness: 0.95,
          roughness: 0.15,
          color: 0xcccccc,
        });
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    console.log('Mesh count:', meshCount);

    if (meshCount === 0) {
      console.warn('Model has no meshes. Trying next URL...');
      model = null;
      tryLoadNext();
      return;
    }
    
    scene.add(model);
    clearTimeout(fallbackTimer);
    console.log('Model added to scene. Final position:', model.position);
    console.log('Model loaded successfully!', url, gltf);
    // Show the canvas now that the model is available
    modelContainer.classList.add('model-loaded');
  }, (xhr) => {
    if (xhr && xhr.loaded && xhr.total) {
      console.log(`Model load progress (${url}): ${Math.round((xhr.loaded / xhr.total) * 100)}%`);
    }
  }, (error) => {
    console.warn('Failed to load', url, error);
    // try next URL
    tryLoadNext();
  });
}

// Kick off loading depending on device - on mobile, wait for user to press 'View 3D'
function startModelLoading() {
  if (startedLoading) return;
  startedLoading = true;
  tryLoadNext();
}

if (shouldAutoLoadModel) {
  if (mobileFallback) mobileFallback.style.display = 'none';
  startModelLoading();
}

function resizeRendererToContainer() {
  const width = modelContainer.clientWidth;
  const height = modelContainer.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

if (load3DButton) {
  load3DButton.addEventListener('click', (e) => {
    e.preventDefault();
    if (mobileFallback) mobileFallback.style.display = 'none';
    modelContainer.classList.add('model-loaded');
    startModelLoading();
    resizeRendererToContainer();
  });
}

// On mobile, allow tapping the model area to start loading if auto-load is disabled
if (isMobileDevice && !shouldAutoLoadModel) {
  modelContainer.addEventListener('touchstart', () => {
    if (mobileFallback) mobileFallback.style.display = 'none';
    modelContainer.classList.add('model-loaded');
    startModelLoading();
    resizeRendererToContainer();
  }, { passive: true });
}

// Mouse tracking with inertia
let mouseX = 0;
let mouseY = 0;
let targetMouseX = 0;
let targetMouseY = 0;
let rotationVelocityX = 0;
let rotationVelocityY = 0;
let lastTouchX = 0;
let lastTouchY = 0;

const interactionConfig = {
  rotationSpeedX: 0.4,
  rotationSpeedY: 0.2,
  inertia: 0.8,
  returnSpeed: 0.05,
  autoOrbit: false,
  autoOrbitSpeed: 0.5,
};

// Optimize interaction for mobile
if (isMobileDevice) {
  interactionConfig.rotationSpeedX = 0.6;  // Increase sensitivity for touch
  interactionConfig.rotationSpeedY = 0.3;
  interactionConfig.inertia = 0.85;  // Slightly higher inertia for smooth momentum
}

// Hitbox configuration
const hitboxConfig = {
  enabled: true,
  shape: 'circle', // 'circle' or 'rectangle'
  radius: isMobileDevice ? 0.8 : 0.6, // Larger hitbox for touch
  width: 0.8, // for rectangle, normalized 0-1
  height: 0.8, // for rectangle
  visible: false, // Hidden by default on mobile
};

// Button style configuration (layout only - visual style is in CSS)
const buttonConfig = {
  padding: isMobileDevice ? 12 : 15,
  fontSize: isMobileDevice ? 16 : 18,  // Larger touch targets on mobile
  borderRadius: 50,
  fontWeight: 600,
};

// Preset settings
const presetSettings = {
  model: { posX: 0, posY: 0, posZ: 0 },
  camera: { z: 2 },
  material: { metalness: 0.95, roughness: 0.35, color: 6647176, emissiveColor: 0, emissiveIntensity: 0.6 },
  ambient: { intensity: 0.3, color: 15077127, visible: true },
  hemisphere: { intensity: 0.4, skyColor: 16777215, groundColor: 6710886, visible: true },
  directional1: { intensity: 1.15, color: 16777215, x: -10, y: 6, z: 5, visible: true },
  directional2: { intensity: 1.1, color: 14935011, x: -5, y: -3, z: 5, visible: true },
  point1: { intensity: 0.6, color: 16760744, x: 2.5, y: 1.5, z: 2, visible: true },
  point2: { intensity: 1.15, color: 9418495, x: -2.5, y: 1, z: 3, visible: true },
  point3: { intensity: 0.3, color: 16777215, x: 0, y: -3, z: 5, visible: true },
  rendering: { bgColor: 1841692, exposure: 1.5 },
  interaction: { rotationSpeedX: 0.4, rotationSpeedY: 0.2, inertia: 0.8, returnSpeed: 0.05, autoOrbit: false, autoOrbitSpeed: 0.5 },
};

function applyPreset(preset) {
  // Apply model position
  modelControl.posX = preset.model.posX;
  modelControl.posY = preset.model.posY;
  modelControl.posZ = preset.model.posZ;
  if (model) model.position.set(preset.model.posX, preset.model.posY, preset.model.posZ);

  // Apply camera
  camera.position.z = preset.camera.z;
  camera.updateProjectionMatrix();

  // Apply material
  materialControl.metalness = preset.material.metalness;
  materialControl.roughness = preset.material.roughness;
  materialControl.color = preset.material.color;
  materialControl.emissiveColor = preset.material.emissiveColor;
  materialControl.emissiveIntensity = preset.material.emissiveIntensity;
  if (model) {
    model.traverse((child) => {
      if (child.isMesh) {
        child.material.metalness = preset.material.metalness;
        child.material.roughness = preset.material.roughness;
        child.material.color.setHex(preset.material.color);
        child.material.emissive.setHex(preset.material.emissiveColor);
        child.material.emissiveIntensity = preset.material.emissiveIntensity;
      }
    });
  }

  // Apply lighting
  ambientControl.intensity = preset.ambient.intensity;
  ambientControl.color = preset.ambient.color;
  ambientControl.visible = preset.ambient.visible;
  ambientLight.intensity = preset.ambient.intensity;
  ambientLight.color.setHex(preset.ambient.color);
  ambientLight.visible = preset.ambient.visible;

  hemiControl.intensity = preset.hemisphere.intensity;
  hemiControl.skyColor = preset.hemisphere.skyColor;
  hemiControl.groundColor = preset.hemisphere.groundColor;
  hemiControl.visible = preset.hemisphere.visible;
  hemiLight.intensity = preset.hemisphere.intensity;
  hemiLight.color.setHex(preset.hemisphere.skyColor);
  hemiLight.groundColor.setHex(preset.hemisphere.groundColor);
  hemiLight.visible = preset.hemisphere.visible;

  dir1Control.intensity = preset.directional1.intensity;
  dir1Control.color = preset.directional1.color;
  dir1Control.x = preset.directional1.x;
  dir1Control.y = preset.directional1.y;
  dir1Control.z = preset.directional1.z;
  dir1Control.visible = preset.directional1.visible;
  directionalLight1.intensity = preset.directional1.intensity;
  directionalLight1.color.setHex(preset.directional1.color);
  directionalLight1.position.set(preset.directional1.x, preset.directional1.y, preset.directional1.z);
  directionalLight1.visible = preset.directional1.visible;

  dir2Control.intensity = preset.directional2.intensity;
  dir2Control.color = preset.directional2.color;
  dir2Control.visible = preset.directional2.visible;
  directionalLight2.intensity = preset.directional2.intensity;
  directionalLight2.color.setHex(preset.directional2.color);
  directionalLight2.visible = preset.directional2.visible;

  point1Control.intensity = preset.point1.intensity;
  point1Control.visible = preset.point1.visible;
  point1.intensity = preset.point1.intensity;
  point1.visible = preset.point1.visible;

  point2Control.intensity = preset.point2.intensity;
  point2Control.visible = preset.point2.visible;
  point2.intensity = preset.point2.intensity;
  point2.visible = preset.point2.visible;

  point3Control.intensity = preset.point3.intensity;
  point3Control.visible = preset.point3.visible;
  point3.intensity = preset.point3.intensity;
  point3.visible = preset.point3.visible;

  // Apply rendering
  renderControl.bgColor = preset.rendering.bgColor;
  renderControl.exposure = preset.rendering.exposure;
  document.body.style.background = `#${preset.rendering.bgColor.toString(16).padStart(6, '0')}`;
  renderer.toneMappingExposure = preset.rendering.exposure;

  // Apply interaction
  interactionConfig.rotationSpeedX = preset.interaction.rotationSpeedX;
  interactionConfig.rotationSpeedY = preset.interaction.rotationSpeedY;
  interactionConfig.inertia = preset.interaction.inertia;
  interactionConfig.returnSpeed = preset.interaction.returnSpeed;
  interactionConfig.autoOrbit = preset.interaction.autoOrbit;
  interactionConfig.autoOrbitSpeed = preset.interaction.autoOrbitSpeed;

  // Update GUI
  if (window.gui) gui.updateDisplay();
}

// Check if mouse is within hitbox
function isMouseInHitbox(mouseX, mouseY) {
  if (!hitboxConfig.enabled) return true;
  
  if (hitboxConfig.shape === 'circle') {
    const distance = Math.sqrt(mouseX * mouseX + mouseY * mouseY);
    return distance <= hitboxConfig.radius;
  } else if (hitboxConfig.shape === 'rectangle') {
    return Math.abs(mouseX) <= hitboxConfig.width / 2 && Math.abs(mouseY) <= hitboxConfig.height / 2;
  }
  return true;
}

let mouseInHitbox = false;
document.addEventListener('mousemove', (event) => {
  const x = (event.clientX / window.innerWidth) * 2 - 1;
  const y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  mouseInHitbox = isMouseInHitbox(x, y);
  
  if (mouseInHitbox) {
    targetMouseX = x;
    targetMouseY = y;
  }
});

// Touch event handling for mobile
let touchStartX = 0;
let touchStartY = 0;
let isTouching = false;

// Prevent default mobile browser gestures that interfere with interaction
if (isMobileDevice) {
  document.addEventListener('touchmove', (e) => {
    if (e.target === modelContainer || e.target === renderer.domElement) {
      e.preventDefault();
    }
  }, { passive: false });

  // Prevent double-tap zoom
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
}

document.addEventListener('touchstart', (event) => {
  if (event.touches.length === 1) {
    isTouching = true;
    const touch = event.touches[0];
    const x = (touch.clientX / window.innerWidth) * 2 - 1;
    const y = -(touch.clientY / window.innerHeight) * 2 + 1;
    
    mouseInHitbox = isMouseInHitbox(x, y);
    if (mouseInHitbox) {
      touchStartX = x;
      touchStartY = y;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
      if (!isMobileDevice) {
        targetMouseX = x;
        targetMouseY = y;
      }
    }
  }
}, { passive: false });

document.addEventListener('touchmove', (event) => {
  if (event.touches.length === 1 && isTouching) {
    event.preventDefault();
    const touch = event.touches[0];
    const x = (touch.clientX / window.innerWidth) * 2 - 1;
    const y = -(touch.clientY / window.innerHeight) * 2 + 1;
    
    mouseInHitbox = isMouseInHitbox(x, y);
    if (mouseInHitbox) {
      if (isMobileDevice) {
        const dx = (touch.clientX - lastTouchX) / window.innerWidth;
        const dy = (touch.clientY - lastTouchY) / window.innerHeight;
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;

        rotationVelocityY += dx * Math.PI * interactionConfig.rotationSpeedX * 1.5;
        rotationVelocityX += dy * Math.PI * interactionConfig.rotationSpeedY * 1.5;
      } else {
        targetMouseX = x;
        targetMouseY = y;
      }
    }
  }
}, { passive: false });

document.addEventListener('touchend', (event) => {
  isTouching = false;
  if (event.touches.length === 0) {
    // Optional: reset on touch end if desired
    // targetMouseX = 0;
    // targetMouseY = 0;
  }
}, { passive: false });

// Hitbox visualization on canvas overlay
function drawHitboxVisualization() {
  if (!hitboxCanvas) return;
  
  const ctx = hitboxCanvas.getContext('2d');
  ctx.clearRect(0, 0, hitboxCanvas.width, hitboxCanvas.height);
  ctx.strokeStyle = 'rgba(102, 126, 234, 0.5)';
  ctx.lineWidth = 2;
  
  const centerX = hitboxCanvas.width / 2;
  const centerY = hitboxCanvas.height / 2;
  
  if (hitboxConfig.shape === 'circle') {
    const radius = hitboxConfig.radius * Math.min(hitboxCanvas.width, hitboxCanvas.height) / 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else if (hitboxConfig.shape === 'rectangle') {
    const width = hitboxConfig.width * hitboxCanvas.width;
    const height = hitboxConfig.height * hitboxCanvas.height;
    ctx.strokeRect(centerX - width / 2, centerY - height / 2, width, height);
  }
}

// Create hitbox canvas overlay
let hitboxCanvas = null;
function createHitboxCanvas() {
  if (hitboxCanvas) hitboxCanvas.remove();
  hitboxCanvas = document.createElement('canvas');
  hitboxCanvas.id = 'hitboxCanvas';
  hitboxCanvas.style.position = 'fixed';
  hitboxCanvas.style.top = '0';
  hitboxCanvas.style.left = '0';
  hitboxCanvas.style.zIndex = '999';
  hitboxCanvas.style.pointerEvents = 'none';
  hitboxCanvas.width = window.innerWidth;
  hitboxCanvas.height = window.innerHeight;
  document.body.appendChild(hitboxCanvas);
}

createHitboxCanvas();

// Debounce function for resize/orientation changes
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Handle window resize and orientation changes
const handleResize = debounce(() => {
  resizeRendererToContainer();
  // Update hitbox canvas
  createHitboxCanvas();
}, 100);

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

// Apply button styles
function applyButtonStyles() {
  downloadButton.style.padding = `${buttonConfig.padding}px ${buttonConfig.padding * 3.3}px`;
  downloadButton.style.fontSize = `${buttonConfig.fontSize / 16}rem`;
  downloadButton.style.borderRadius = `${buttonConfig.borderRadius}px`;
  downloadButton.style.fontWeight = buttonConfig.fontWeight;
}

applyButtonStyles();

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Update mouse position with smoothing
  if (!isMobileDevice || !isTouching) {
    mouseX += (targetMouseX - mouseX) * 0.1;
    mouseY += (targetMouseY - mouseY) * 0.1;
  }
  
  if (model) {
    // Auto-orbit
    if (interactionConfig.autoOrbit) {
      model.rotation.y += interactionConfig.autoOrbitSpeed * 0.01;
    } else {
      // Manual rotation with inertia (only if in hitbox)
      if (mouseInHitbox && (!isMobileDevice || !isTouching)) {
        rotationVelocityX += (mouseY * Math.PI * 0.5 * interactionConfig.rotationSpeedY - model.rotation.x) * 0.01;
        rotationVelocityY += (mouseX * Math.PI * interactionConfig.rotationSpeedX - model.rotation.y) * 0.01;
      }
      
      rotationVelocityX *= interactionConfig.inertia;
      rotationVelocityY *= interactionConfig.inertia;
      
      model.rotation.x += rotationVelocityX;
      model.rotation.y += rotationVelocityY;
      
      // Return to center when mouse leaves
      rotationVelocityX *= (1 - interactionConfig.returnSpeed);
      rotationVelocityY *= (1 - interactionConfig.returnSpeed);
    }
  }
  
  // Draw hitbox visualization
  if (hitboxConfig.visible) {
    drawHitboxVisualization();
  }
  
  renderer.render(scene, camera);
}

animate();

// Download button - play sound
downloadButton.addEventListener('click', () => {
  sound.play();
});

// ============================================
// NAVIGATION & SMOOTH SCROLLING
// ============================================
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');
const navLinks = document.querySelectorAll('.nav-link');

if (navToggle) {
  navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
  });
}

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    // Close mobile menu
    navMenu.classList.remove('active');
    
    // Get target section
    const targetId = link.getAttribute('href');
    if (targetId && targetId !== '#') {
      e.preventDefault();
      const target = document.querySelector(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });
});

// ============================================
// GUI CONTROLS FOR FINE-TUNING
// ============================================
const gui = new window.lil.GUI({ title: 'Model Settings' });

function setupMobileGuiToggle() {
  if (!isMobileDevice) return;

  document.body.classList.add('gui-collapsed');
  gui.close();

  const toggle = document.createElement('button');
  toggle.className = 'gui-toggle';
  toggle.type = 'button';
  toggle.textContent = 'GUI';
  toggle.addEventListener('click', () => {
    const isCollapsed = document.body.classList.toggle('gui-collapsed');
    if (isCollapsed) {
      gui.close();
    } else {
      gui.open();
    }
  });

  document.body.appendChild(toggle);
}

setupMobileGuiToggle();

// Model controls
const modelFolder = gui.addFolder('Model');
const modelControl = {
  posX: 0,
  posY: 0,
  posZ: 0,
};
modelFolder.add(modelControl, 'posX', -3, 3, 0.1).onChange((val) => {
  if (model) model.position.x = val;
}).name('Position X');
modelFolder.add(modelControl, 'posY', -3, 3, 0.1).onChange((val) => {
  if (model) model.position.y = val;
}).name('Position Y');
modelFolder.add(modelControl, 'posZ', -2, 2, 0.1).onChange((val) => {
  if (model) model.position.z = val;
}).name('Position Z');
modelFolder.add({ resetTransform: () => {
  modelControl.posX = 0;
  modelControl.posY = 0;
  modelControl.posZ = 0;
  if (model) {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
  }
  mouseX = 0;
  mouseY = 0;
  targetMouseX = 0;
  targetMouseY = 0;
  rotationVelocityX = 0;
  rotationVelocityY = 0;
  modelFolder.updateDisplay();
}}, 'resetTransform').name('🔄 Reset Transform');

// Camera controls
const cameraFolder = gui.addFolder('Camera');
cameraFolder.add(camera.position, 'z', 0.5, 10, 0.5).onChange(() => {
  camera.updateProjectionMatrix();
}).name('Zoom (Z)');

// Material controls
const materialFolder = gui.addFolder('Material');
const materialControl = {
  metalness: 0.95,
  roughness: 0.35,
  color: 0x656d88,
  emissiveColor: 0x000000,
  emissiveIntensity: 0,
};
materialFolder.add(materialControl, 'metalness', 0, 1, 0.05).onChange((val) => {
  if (model) {
    model.traverse((child) => {
      if (child.isMesh) child.material.metalness = val;
    });
  }
}).name('Metalness');
materialFolder.add(materialControl, 'roughness', 0, 1, 0.05).onChange((val) => {
  if (model) {
    model.traverse((child) => {
      if (child.isMesh) child.material.roughness = val;
    });
  }
}).name('Roughness');
materialFolder.addColor(materialControl, 'color').onChange((val) => {
  if (model) {
    model.traverse((child) => {
      if (child.isMesh) child.material.color.setHex(val);
    });
  }
}).name('Color');
materialFolder.addColor(materialControl, 'emissiveColor').onChange((val) => {
  if (model) {
    model.traverse((child) => {
      if (child.isMesh) child.material.emissive.setHex(val);
    });
  }
}).name('Emissive Color');
materialFolder.add(materialControl, 'emissiveIntensity', 0, 2, 0.1).onChange((val) => {
  if (model) {
    model.traverse((child) => {
      if (child.isMesh) child.material.emissiveIntensity = val;
    });
  }
}).name('Emissive Intensity');

// Lighting controls
const lightFolder = gui.addFolder('Lighting');

const ambientControl = { intensity: 0.3, color: 0xe60f07, visible: true };
lightFolder.add(ambientControl, 'intensity', 0, 2, 0.05).onChange((val) => {
  ambientLight.intensity = val;
}).name('Ambient Intensity');
lightFolder.addColor(ambientControl, 'color').onChange((val) => {
  ambientLight.color.setHex(val);
}).name('Ambient Color');
lightFolder.add(ambientControl, 'visible').onChange((val) => {
  ambientLight.visible = val;
}).name('Ambient Visible');

const hemiControl = { intensity: 0.4, skyColor: 0xffffff, groundColor: 0x666666, visible: true };
lightFolder.add(hemiControl, 'intensity', 0, 2, 0.05).onChange((val) => {
  hemiLight.intensity = val;
}).name('Hemisphere Intensity');
lightFolder.addColor(hemiControl, 'skyColor').onChange((val) => {
  hemiLight.color.setHex(val);
}).name('Hemisphere Sky');
lightFolder.addColor(hemiControl, 'groundColor').onChange((val) => {
  hemiLight.groundColor.setHex(val);
}).name('Hemisphere Ground');
lightFolder.add(hemiControl, 'visible').onChange((val) => {
  hemiLight.visible = val;
}).name('Hemisphere Visible');

const dir1Control = { intensity: 1.15, color: 0xffffff, x: -10, y: 6, z: 5, visible: true };
lightFolder.add(dir1Control, 'intensity', 0, 2, 0.05).onChange((val) => {
  directionalLight1.intensity = val;
}).name('Dir Light 1 Intensity');
lightFolder.add(dir1Control, 'x', -10, 10, 1).onChange((val) => {
  directionalLight1.position.x = val;
}).name('Dir Light 1 X');
lightFolder.add(dir1Control, 'y', -10, 10, 1).onChange((val) => {
  directionalLight1.position.y = val;
}).name('Dir Light 1 Y');
lightFolder.add(dir1Control, 'z', -10, 10, 1).onChange((val) => {
  directionalLight1.position.z = val;
}).name('Dir Light 1 Z');
lightFolder.add(dir1Control, 'visible').onChange((val) => {
  directionalLight1.visible = val;
}).name('Dir Light 1 Visible');

const dir2Control = { intensity: 1.1, color: 0x8a45f6, x: -5, y: -3, z: 5, visible: true };
lightFolder.add(dir2Control, 'intensity', 0, 2, 0.05).onChange((val) => {
  directionalLight2.intensity = val;
}).name('Dir Light 2 Intensity');
lightFolder.addColor(dir2Control, 'color').onChange((val) => {
  directionalLight2.color.setHex(val);
}).name('Dir Light 2 Color');
lightFolder.add(dir2Control, 'visible').onChange((val) => {
  directionalLight2.visible = val;
}).name('Dir Light 2 Visible');

const point1Control = { intensity: 0.6, color: 0xffbfa8, x: 2.5, y: 1.5, z: 2, visible: true };
lightFolder.add(point1Control, 'intensity', 0, 2, 0.05).onChange((val) => {
  point1.intensity = val;
}).name('Point Light 1 Intensity');
lightFolder.add(point1Control, 'visible').onChange((val) => {
  point1.visible = val;
}).name('Point Light 1 Visible');

const point2Control = { intensity: 1.15, color: 0x8fb6ff, x: -2.5, y: 1, z: 3, visible: true };
lightFolder.add(point2Control, 'intensity', 0, 2, 0.05).onChange((val) => {
  point2.intensity = val;
}).name('Point Light 2 Intensity');
lightFolder.add(point2Control, 'visible').onChange((val) => {
  point2.visible = val;
}).name('Point Light 2 Visible');

const point3Control = { intensity: 0.3, color: 0xffffff, x: 0, y: -3, z: 5, visible: true };
lightFolder.add(point3Control, 'intensity', 0, 2, 0.05).onChange((val) => {
  point3.intensity = val;
}).name('Point Light 3 Intensity');
lightFolder.add(point3Control, 'visible').onChange((val) => {
  point3.visible = val;
}).name('Point Light 3 Visible');

// Background & Rendering
const renderFolder = gui.addFolder('Rendering');
const renderControl = { bgColor: 0x1c1a1c, exposure: 1.5 };
renderFolder.addColor(renderControl, 'bgColor').onChange((val) => {
  document.body.style.background = `#${val.toString(16).padStart(6, '0')}`;
}).name('Background Color');
renderFolder.add(renderControl, 'exposure', 0, 2, 0.1).onChange((val) => {
  renderer.toneMappingExposure = val;
}).name('Tone Mapping Exposure');

// Mouse & Interaction controls
const mouseFolder = gui.addFolder('Interaction');
mouseFolder.add(interactionConfig, 'rotationSpeedX', 0, 3, 0.1).name('Rotation Speed X');
mouseFolder.add(interactionConfig, 'rotationSpeedY', 0, 3, 0.1).name('Rotation Speed Y');
mouseFolder.add(interactionConfig, 'inertia', 0.8, 0.99, 0.01).name('Inertia');
mouseFolder.add(interactionConfig, 'returnSpeed', 0, 0.2, 0.01).name('Return to Center Speed');
mouseFolder.add(interactionConfig, 'autoOrbit').name('Auto-Orbit');
mouseFolder.add(interactionConfig, 'autoOrbitSpeed', 0, 0.5, 0.05).name('Auto-Orbit Speed');

// Hitbox controls
const hitboxFolder = gui.addFolder('Hitbox');
hitboxFolder.add(hitboxConfig, 'enabled').name('Enable Hitbox');
hitboxFolder.add(hitboxConfig, 'shape', ['circle', 'rectangle']).name('Shape');
hitboxFolder.add(hitboxConfig, 'radius', 0.1, 1, 0.05).name('Radius (Circle)');
hitboxFolder.add(hitboxConfig, 'width', 0.1, 1.5, 0.05).name('Width (Rectangle)');
hitboxFolder.add(hitboxConfig, 'height', 0.1, 1.5, 0.05).name('Height (Rectangle)');
hitboxFolder.add(hitboxConfig, 'visible').name('Visualize Hitbox');

// Button style controls (layout only)
const buttonFolder = gui.addFolder('Button Style');
buttonFolder.add(buttonConfig, 'padding', 5, 30, 1).onChange((val) => {
  applyButtonStyles();
}).name('Padding');
buttonFolder.add(buttonConfig, 'fontSize', 12, 32, 1).onChange((val) => {
  applyButtonStyles();
}).name('Font Size');
buttonFolder.add(buttonConfig, 'borderRadius', 0, 100, 5).onChange((val) => {
  applyButtonStyles();
}).name('Border Radius');
buttonFolder.add(buttonConfig, 'fontWeight', { Normal: 400, Bold: 600, ExtraBold: 700 }).onChange((val) => {
  applyButtonStyles();
}).name('Font Weight');

// Settings export/save
const settingsFolder = gui.addFolder('Settings');
settingsFolder.add({ loadPreset: () => {
  applyPreset(presetSettings);
}}, 'loadPreset').name('⚡ Load Preset');
settingsFolder.add({ exportSettings: () => {
  const settingsObj = {
    model: modelControl,
    camera: { z: camera.position.z },
    material: materialControl,
    ambient: ambientControl,
    hemisphere: hemiControl,
    directional1: dir1Control,
    directional2: dir2Control,
    point1: point1Control,
    point2: point2Control,
    point3: point3Control,
    rendering: renderControl,
    interaction: interactionConfig,
  };
  console.log('=== CURRENT SETTINGS ===');
  console.log(JSON.stringify(settingsObj, null, 2));
  console.log('Save this to lock in your settings!');
}}, 'exportSettings').name('📋 Export to Console');


