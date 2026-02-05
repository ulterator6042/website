const downloadButton = document.getElementById('downloadButton');
const sound = document.getElementById('sound');
const modelContainer = document.getElementById('modelContainer');
const heroSection = document.querySelector('.hero-section');
const scrollHint = document.getElementById('scrollHint');
const heroMistLayers = document.querySelectorAll('.hero-mist');

// Mobile fallback elements (added in index.html)
const mobileFallback = document.getElementById('mobileFallback');
const load3DButton = document.getElementById('load3DButton');
const resetColorsBtn = document.getElementById('resetColors');
const applyModelPresetBtn = document.getElementById('applyModelPreset');

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
renderer.toneMappingExposure = 1.6;

camera.position.z = 2.5;

// Lighting (richer environment with multiple light sources)
const ambientLight = new THREE.AmbientLight(0xa3a3a3, 1.05);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x737373, 0.15);
hemiLight.position.set(0, 50, 0);
hemiLight.visible = false;
scene.add(hemiLight);

const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.75);
directionalLight1.position.set(-10, 5, 3);
directionalLight1.castShadow = true;
scene.add(directionalLight1);

const directionalLight2 = new THREE.DirectionalLight(0xb28585, 0.3);
directionalLight2.position.set(-5, -3, 5);
scene.add(directionalLight2);

// Soft colored rim/fill point lights
const point1 = new THREE.PointLight(0xffbfa8, 0.9, 10);
point1.position.set(2.5, 1.5, 2);
scene.add(point1);

const point2 = new THREE.PointLight(0x8fb6ff, 0.1, 10);
point2.position.set(-2.5, 1, 3);
scene.add(point2);

const point3 = new THREE.PointLight(0xffffff, 0.3, 15);
point3.position.set(0, -3, 5);
scene.add(point3);

// Rim light for metallic edge definition
const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
rimLight.position.set(6, 4, -6);
scene.add(rimLight);

const defaultMaterialSettings = {
  metalness: 0.95,
  roughness: 0.4,
  color: 0xa1a1a1,
  emissiveColor: 0x000000,
  emissiveIntensity: 0.9,
};

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
  const mat = new THREE.MeshStandardMaterial({
    metalness: defaultMaterialSettings.metalness,
    roughness: defaultMaterialSettings.roughness,
    color: defaultMaterialSettings.color,
    emissive: defaultMaterialSettings.emissiveColor,
    emissiveIntensity: defaultMaterialSettings.emissiveIntensity,
  });
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
    
    const targetSize = isMobileDevice ? 1.2 : 2.8;
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
          metalness: defaultMaterialSettings.metalness,
          roughness: defaultMaterialSettings.roughness,
          color: defaultMaterialSettings.color,
          emissive: defaultMaterialSettings.emissiveColor,
          emissiveIntensity: defaultMaterialSettings.emissiveIntensity,
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
    applyEnvironmentSettings();
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
  inertia: 0.99,
  returnSpeed: 0.2,
  autoOrbit: false,
  autoOrbitSpeed: 0.5,
};

// Optimize interaction for mobile
if (isMobileDevice) {
  // Keep mobile defaults aligned with the current preset values
  interactionConfig.rotationSpeedX = 0.4;
  interactionConfig.rotationSpeedY = 0.2;
  interactionConfig.inertia = 0.99;
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

// Hero environment configuration
const environmentConfig = {
  rimIntensity: 0.6,
  rimColor: 0xffffff,
  rimX: 6,
  rimY: 4,
  rimZ: -6,
  mistEnabled: true,
  mistOpacity: 0.45,
  mistBlur: 70,
  mistScale: 1.2,
  mistParallax: 10,
  mistColor1: 0xffffff,
  mistColor2: 0xb4b4b4,
  mistColor3: 0x787878,
  vignetteOpacity: 0.35,
  grainOpacity: 0.08,
  backdropOpacity: 1,
  parallaxStrength: 10,
  radial1Size: 900,
  radial1X: 15,
  radial1Y: 20,
  radial2Size: 700,
  radial2X: 85,
  radial2Y: 15,
};

function applyEnvironmentSettings() {
  rimLight.intensity = environmentConfig.rimIntensity;
  rimLight.color.setHex(environmentConfig.rimColor);
  rimLight.position.set(environmentConfig.rimX, environmentConfig.rimY, environmentConfig.rimZ);

  if (heroSection) {
    heroSection.style.setProperty('--hero-vignette-opacity', environmentConfig.vignetteOpacity);
    heroSection.style.setProperty('--hero-grain-opacity', environmentConfig.grainOpacity);
    heroSection.style.setProperty('--hero-backdrop-opacity', environmentConfig.backdropOpacity);
    heroSection.style.setProperty('--mist-opacity', environmentConfig.mistEnabled ? environmentConfig.mistOpacity : 0);
    heroSection.style.setProperty('--mist-blur', `${environmentConfig.mistBlur}px`);
    heroSection.style.setProperty('--mist-scale', environmentConfig.mistScale);
    heroSection.style.setProperty('--mist-color-1', hexToRgba(`#${environmentConfig.mistColor1.toString(16).padStart(6, '0')}`, 0.35));
    heroSection.style.setProperty('--mist-color-2', hexToRgba(`#${environmentConfig.mistColor2.toString(16).padStart(6, '0')}`, 0.25));
    heroSection.style.setProperty('--mist-color-3', hexToRgba(`#${environmentConfig.mistColor3.toString(16).padStart(6, '0')}`, 0.2));
    heroSection.style.setProperty('--radial-1-size', `${environmentConfig.radial1Size}px`);
    heroSection.style.setProperty('--radial-1-x', `${environmentConfig.radial1X}%`);
    heroSection.style.setProperty('--radial-1-y', `${environmentConfig.radial1Y}%`);
    heroSection.style.setProperty('--radial-2-size', `${environmentConfig.radial2Size}px`);
    heroSection.style.setProperty('--radial-2-x', `${environmentConfig.radial2X}%`);
    heroSection.style.setProperty('--radial-2-y', `${environmentConfig.radial2Y}%`);
  }
}

// Preset settings
const presetSettings = {
  model: { posX: 0, posY: 0, posZ: -2 },
  camera: { z: 2.5 },
  material: { metalness: 0.95, roughness: 0.4, color: 10592673, emissiveColor: 0, emissiveIntensity: 0.9 },
  ambient: { intensity: 1.05, color: 10724259, visible: true },
  hemisphere: { intensity: 0.15, skyColor: 16777215, groundColor: 7566195, visible: false },
  directional1: { intensity: 1.75, color: 16777215, x: -10, y: 5, z: 3, visible: true },
  directional2: { intensity: 0.3, color: 11699589, x: -5, y: -3, z: 5, visible: true },
  point1: { intensity: 0.9, color: 16760744, x: 2.5, y: 1.5, z: 2, visible: true },
  point2: { intensity: 0.1, color: 9418495, x: -2.5, y: 1, z: 3, visible: true },
  point3: { intensity: 0.3, color: 16777215, x: 0, y: -3, z: 5, visible: true },
  rendering: { bgColor: 1841692, exposure: 1.6 },
  interaction: { rotationSpeedX: 0.4, rotationSpeedY: 0.2, inertia: 0.99, returnSpeed: 0.2, autoOrbit: false, autoOrbitSpeed: 0.5 },
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
  dir2Control.x = preset.directional2.x;
  dir2Control.y = preset.directional2.y;
  dir2Control.z = preset.directional2.z;
  dir2Control.visible = preset.directional2.visible;
  directionalLight2.intensity = preset.directional2.intensity;
  directionalLight2.color.setHex(preset.directional2.color);
  directionalLight2.position.set(preset.directional2.x, preset.directional2.y, preset.directional2.z);
  directionalLight2.visible = preset.directional2.visible;

  point1Control.intensity = preset.point1.intensity;
  point1Control.color = preset.point1.color;
  point1Control.x = preset.point1.x;
  point1Control.y = preset.point1.y;
  point1Control.z = preset.point1.z;
  point1Control.visible = preset.point1.visible;
  point1.intensity = preset.point1.intensity;
  point1.color.setHex(preset.point1.color);
  point1.position.set(preset.point1.x, preset.point1.y, preset.point1.z);
  point1.visible = preset.point1.visible;

  point2Control.intensity = preset.point2.intensity;
  point2Control.color = preset.point2.color;
  point2Control.x = preset.point2.x;
  point2Control.y = preset.point2.y;
  point2Control.z = preset.point2.z;
  point2Control.visible = preset.point2.visible;
  point2.intensity = preset.point2.intensity;
  point2.color.setHex(preset.point2.color);
  point2.position.set(preset.point2.x, preset.point2.y, preset.point2.z);
  point2.visible = preset.point2.visible;

  point3Control.intensity = preset.point3.intensity;
  point3Control.color = preset.point3.color;
  point3Control.x = preset.point3.x;
  point3Control.y = preset.point3.y;
  point3Control.z = preset.point3.z;
  point3Control.visible = preset.point3.visible;
  point3.intensity = preset.point3.intensity;
  point3.color.setHex(preset.point3.color);
  point3.position.set(preset.point3.x, preset.point3.y, preset.point3.z);
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

function getPointerInModelContainer(clientX, clientY) {
  const rect = modelContainer.getBoundingClientRect();
  const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  if (!inside) {
    return { inside: false, x: 0, y: 0 };
  }

  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
  return { inside: true, x, y };
}

let mouseInHitbox = false;
document.addEventListener('mousemove', (event) => {
  const pointer = getPointerInModelContainer(event.clientX, event.clientY);
  if (!pointer.inside) {
    mouseInHitbox = false;
    return;
  }

  mouseInHitbox = isMouseInHitbox(pointer.x, pointer.y);
  if (mouseInHitbox) {
    targetMouseX = pointer.x;
    targetMouseY = pointer.y;
  }
});

// Touch event handling for mobile
let touchStartX = 0;
let touchStartY = 0;
let isTouching = false;
let touchIntent = null;
let touchStartClientX = 0;
let touchStartClientY = 0;

// Prevent default mobile browser gestures that interfere with interaction
if (isMobileDevice) {
  document.addEventListener('touchmove', (e) => {
    if (touchIntent === 'rotate' && mouseInHitbox && (e.target === modelContainer || e.target === renderer.domElement)) {
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
    const touch = event.touches[0];
    touchStartClientX = touch.clientX;
    touchStartClientY = touch.clientY;
    touchIntent = null;
    const pointer = getPointerInModelContainer(touch.clientX, touch.clientY);
    if (!pointer.inside) {
      mouseInHitbox = false;
      return;
    }

    mouseInHitbox = isMouseInHitbox(pointer.x, pointer.y);
    if (mouseInHitbox) {
      isTouching = true;
      touchStartX = pointer.x;
      touchStartY = pointer.y;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
      if (!isMobileDevice) {
        targetMouseX = pointer.x;
        targetMouseY = pointer.y;
      }
    }
  }
}, { passive: false });

document.addEventListener('touchmove', (event) => {
  if (event.touches.length === 1 && isTouching) {
    const touch = event.touches[0];
    const pointer = getPointerInModelContainer(touch.clientX, touch.clientY);
    if (!pointer.inside) {
      isTouching = false;
      mouseInHitbox = false;
      touchIntent = null;
      return;
    }

    mouseInHitbox = isMouseInHitbox(pointer.x, pointer.y);
    if (mouseInHitbox) {
      if (!touchIntent) {
        const intentDx = touch.clientX - touchStartClientX;
        const intentDy = touch.clientY - touchStartClientY;
        if (Math.abs(intentDy) > Math.abs(intentDx) * 1.2 && Math.abs(intentDy) > 6) {
          touchIntent = 'scroll';
          isTouching = false;
          return;
        }
        if (Math.abs(intentDx) > Math.abs(intentDy) * 1.2 && Math.abs(intentDx) > 6) {
          touchIntent = 'rotate';
        }
      }

      if (touchIntent === 'rotate') {
        event.preventDefault();
        if (isMobileDevice) {
          const dx = (touch.clientX - lastTouchX) / window.innerWidth;
          const dy = (touch.clientY - lastTouchY) / window.innerHeight;
          lastTouchX = touch.clientX;
          lastTouchY = touch.clientY;

          rotationVelocityY += dx * Math.PI * interactionConfig.rotationSpeedX * 1.5;
          rotationVelocityX += dy * Math.PI * interactionConfig.rotationSpeedY * 1.5;
        }
      }
    }
  }
}, { passive: false });

document.addEventListener('touchend', (event) => {
  isTouching = false;
  touchIntent = null;
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
  hitboxCanvas.style.position = 'absolute';
  hitboxCanvas.style.top = '0';
  hitboxCanvas.style.left = '0';
  hitboxCanvas.style.zIndex = '10';
  hitboxCanvas.style.pointerEvents = 'none';
  hitboxCanvas.width = modelContainer.clientWidth;
  hitboxCanvas.height = modelContainer.clientHeight;
  modelContainer.appendChild(hitboxCanvas);
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
applyEnvironmentSettings();

if (scrollHint) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      scrollHint.classList.add('hidden');
    } else {
      scrollHint.classList.remove('hidden');
    }
  });
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Update mouse position with smoothing
  if (!isMobileDevice || !isTouching) {
    mouseX += (targetMouseX - mouseX) * 0.1;
    mouseY += (targetMouseY - mouseY) * 0.1;
  }

  if (heroSection && model) {
    const parallaxX = model.rotation.y * environmentConfig.parallaxStrength * 12;
    const parallaxY = model.rotation.x * environmentConfig.parallaxStrength * 12;
    heroSection.style.setProperty('--hero-parallax-x', `${parallaxX}px`);
    heroSection.style.setProperty('--hero-parallax-y', `${parallaxY}px`);
  }

  if (heroMistLayers.length > 0 && model) {
    const mistX = model.rotation.y * environmentConfig.mistParallax * 12;
    const mistY = model.rotation.x * environmentConfig.mistParallax * 12;
    const factors = [0.35, 0.55, 0.8];
    heroMistLayers.forEach((layer, index) => {
      const factor = factors[index] || 0.5;
      layer.style.transform = `translate(${mistX * factor}px, ${mistY * factor}px) scale(${environmentConfig.mistScale})`;
    });
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
// DESIGN PANEL
// ============================================
const designBtn = document.getElementById('designBtn');
const designPanel = document.getElementById('designPanel');
const designClose = document.getElementById('designClose');
const designControls = document.getElementById('designControls');

const defaultDesignSettings = {
  // Colors
  primaryColor: '#f0f0f0',
  secondaryColor: '#121212',
  accentColor: '#949494',
  backgroundColor: '#1c1c1c',
  sectionBackground: '#242424',
  textColor: '#d6d6d6',
  textSecondaryColor: '#9e9e9e',
  borderColor: '#242424',

  // Hero environment colors
  heroBg1: '#1c1c1c',
  heroBg2: '#242424',
  heroAccent: '#3a3a3a',
  heroGlow: '#4a4a4a',
  
  // Button styles
  buttonTextColor: '#e1e0e0',
  buttonOpacity: '0.6',
  
  // Section styles
  projectCardBg: 'rgba(255, 255, 255, 0.06)',
  projectCardHoverBg: '#383838',
  
  // Typography
  headingSize: '2.5',
  bodyFontSize: '1',
  navbarOpacity: '0.95',
};

const designSettings = { ...defaultDesignSettings };

const controlConfig = {
  primaryColor: { type: 'color', label: 'Primary Color' },
  secondaryColor: { type: 'color', label: 'Secondary Color' },
  accentColor: { type: 'color', label: 'Accent Color' },
  backgroundColor: { type: 'color', label: 'Background Color' },
  sectionBackground: { type: 'color', label: 'Section Background' },
  textColor: { type: 'color', label: 'Text Color' },
  textSecondaryColor: { type: 'color', label: 'Secondary Text Color' },
  borderColor: { type: 'color', label: 'Border Color' },
  heroBg1: { type: 'color', label: 'Hero Background 1' },
  heroBg2: { type: 'color', label: 'Hero Background 2' },
  heroAccent: { type: 'color', label: 'Hero Accent' },
  heroGlow: { type: 'color', label: 'Hero Glow' },
  buttonTextColor: { type: 'color', label: 'Button Text Color' },
  buttonOpacity: { type: 'range', label: 'Button Glass Opacity', min: 0.3, max: 1, step: 0.1 },
  projectCardBg: { type: 'color', label: 'Card Background' },
  projectCardHoverBg: { type: 'color', label: 'Card Hover Background' },
  headingSize: { type: 'range', label: 'Heading Size (rem)', min: 1.5, max: 4, step: 0.2 },
  bodyFontSize: { type: 'range', label: 'Body Font Size', min: 0.8, max: 1.3, step: 0.1 },
  navbarOpacity: { type: 'range', label: 'Navbar Opacity', min: 0.5, max: 1, step: 0.05 },
};

function initDesignPanel() {
  // Load saved design settings
  const saved = localStorage.getItem('designSettings');
  if (saved) {
    Object.assign(designSettings, JSON.parse(saved));
  }

  // Create controls
  Object.keys(controlConfig).forEach(key => {
    const config = controlConfig[key];
    const group = document.createElement('div');
    group.className = 'design-control-group';
    
    const label = document.createElement('label');
    label.textContent = config.label;
    
    let input;
    if (config.type === 'color') {
      input = document.createElement('input');
      input.type = 'color';
      input.dataset.key = key;
      input.value = designSettings[key].replace(/[^#0-9a-f]/gi, '') || '#ffffff';
      
      input.addEventListener('input', (e) => {
        designSettings[key] = e.target.value;
        applyDesignSettings();
        localStorage.setItem('designSettings', JSON.stringify(designSettings));
      });
      
      group.appendChild(label);
      group.appendChild(input);
      designControls.appendChild(group);
    } else if (config.type === 'range') {
      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.gap = '10px';
      
      input = document.createElement('input');
      input.type = 'range';
      input.dataset.key = key;
      input.min = config.min;
      input.max = config.max;
      input.step = config.step;
      input.value = designSettings[key];
      
      const valueDisplay = document.createElement('span');
      valueDisplay.className = 'control-value';
      valueDisplay.dataset.key = key;
      valueDisplay.textContent = parseFloat(designSettings[key]).toFixed(2);
      
      input.addEventListener('input', (e) => {
        designSettings[key] = e.target.value;
        valueDisplay.textContent = parseFloat(e.target.value).toFixed(2);
        applyDesignSettings();
        localStorage.setItem('designSettings', JSON.stringify(designSettings));
      });
      
      container.appendChild(input);
      container.appendChild(valueDisplay);
      group.appendChild(label);
      group.appendChild(container);
      designControls.appendChild(group);
    }
  });

  applyDesignSettings();
}

function hexToRgba(hex, alpha) {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return `rgba(0, 0, 0, ${alpha})`;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function syncDesignControls() {
  const inputs = designControls.querySelectorAll('input[data-key]');
  inputs.forEach(input => {
    const key = input.dataset.key;
    if (!key || !(key in designSettings)) return;
    input.value = designSettings[key];

    if (input.type === 'range') {
      const valueDisplay = input.parentElement.querySelector('.control-value');
      if (valueDisplay) {
        valueDisplay.textContent = parseFloat(designSettings[key]).toFixed(2);
      }
    }
  });
}

function applyDesignSettings() {
  // Set CSS variables
  document.documentElement.style.setProperty('--primary-color', designSettings.primaryColor);
  document.documentElement.style.setProperty('--secondary-color', designSettings.secondaryColor);
  document.documentElement.style.setProperty('--accent-color', designSettings.accentColor);
  document.documentElement.style.setProperty('--text-color', designSettings.textColor);
  document.documentElement.style.setProperty('--text-secondary-color', designSettings.textSecondaryColor);
  document.documentElement.style.setProperty('--border-color', designSettings.borderColor);
  document.documentElement.style.setProperty('--section-bg', designSettings.sectionBackground);
  document.documentElement.style.setProperty('--card-bg', designSettings.projectCardBg);
  document.documentElement.style.setProperty('--card-hover-bg', designSettings.projectCardHoverBg);
  document.documentElement.style.setProperty('--heading-size', designSettings.headingSize + 'rem');
  document.documentElement.style.setProperty('--body-font-size', designSettings.bodyFontSize);
  document.documentElement.style.setProperty('--hero-bg-1', designSettings.heroBg1);
  document.documentElement.style.setProperty('--hero-bg-2', designSettings.heroBg2);
  document.documentElement.style.setProperty('--hero-accent', hexToRgba(designSettings.heroAccent, 0.25));
  document.documentElement.style.setProperty('--hero-glow', hexToRgba(designSettings.heroGlow, 0.18));

  // Update body background
  document.body.style.background = designSettings.backgroundColor;

  // Update navbar
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    navbar.style.background = `rgba(18, 18, 18, ${designSettings.navbarOpacity})`;
    navbar.style.borderBottomColor = designSettings.borderColor;
  }

  // Update sections
  const projectsSection = document.querySelector('.projects-section');
  const contactsSection = document.querySelector('.contacts-section');
  if (projectsSection) {
    projectsSection.style.background = `linear-gradient(135deg, ${designSettings.backgroundColor} 0%, ${designSettings.sectionBackground} 100%)`;
  }
  if (contactsSection) {
    contactsSection.style.background = `linear-gradient(135deg, ${designSettings.sectionBackground} 0%, ${designSettings.backgroundColor} 100%)`;
  }

  // Update section headings
  const headings = document.querySelectorAll('.section-content h2');
  headings.forEach(h => {
    h.style.color = designSettings.textColor;
    h.style.fontSize = designSettings.headingSize + 'rem';
  });

  // Update body text
  const bodyText = document.querySelector('body');
  if (bodyText) {
    bodyText.style.fontSize = designSettings.bodyFontSize + 'rem';
    bodyText.style.color = designSettings.textColor;
  }

  // Update project/contact cards
  const projectCards = document.querySelectorAll('.project-card, .contact-item');
  projectCards.forEach(card => {
    card.style.background = designSettings.projectCardBg;
    card.style.borderColor = designSettings.borderColor;
    card.addEventListener('mouseover', () => {
      card.style.background = designSettings.projectCardHoverBg;
    });
    card.addEventListener('mouseout', () => {
      card.style.background = designSettings.projectCardBg;
    });
  });

  // Update buttons
  const buttons = document.querySelectorAll('.download-btn');
  buttons.forEach(btn => {
    btn.style.color = designSettings.buttonTextColor;
    btn.style.background = `rgba(18, 18, 18, ${designSettings.buttonOpacity})`;
    btn.style.borderColor = designSettings.borderColor;
  });

  // Update links
  const links = document.querySelectorAll('.project-link, .contact-item a, .nav-link');
  links.forEach(link => {
    link.style.color = designSettings.primaryColor;
  });

  // Update card headings
  const cardHeadings = document.querySelectorAll('.project-card h3, .contact-item h3');
  cardHeadings.forEach(h => {
    h.style.color = designSettings.textColor;
  });

  // Update card text
  const cardText = document.querySelectorAll('.project-card p');
  cardText.forEach(p => {
    p.style.color = designSettings.textSecondaryColor;
  });
}

if (designBtn) {
  designBtn.addEventListener('click', () => {
    designPanel.classList.toggle('active');
  });
}

if (designClose) {
  designClose.addEventListener('click', () => {
    designPanel.classList.remove('active');
  });
}

initDesignPanel();

// ============================================
// DESIGN PANEL TABS
// ============================================
const designTabs = document.querySelectorAll('.design-tab');
const tabContents = document.querySelectorAll('.design-tab-content');

designTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.getAttribute('data-tab');
    
    // Remove active from all tabs and contents
    designTabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Add active to clicked tab and corresponding content
    tab.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
  });
});

// ============================================
// COLOR EXPORT
// ============================================
const exportBtn = document.getElementById('exportColors');
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    const colorExport = {
      primaryColor: designSettings.primaryColor,
      secondaryColor: designSettings.secondaryColor,
      accentColor: designSettings.accentColor,
      backgroundColor: designSettings.backgroundColor,
      sectionBackground: designSettings.sectionBackground,
      textColor: designSettings.textColor,
      textSecondaryColor: designSettings.textSecondaryColor,
      borderColor: designSettings.borderColor,
      heroBg1: designSettings.heroBg1,
      heroBg2: designSettings.heroBg2,
      heroAccent: designSettings.heroAccent,
      heroGlow: designSettings.heroGlow,
      buttonTextColor: designSettings.buttonTextColor,
      projectCardBg: designSettings.projectCardBg,
      projectCardHoverBg: designSettings.projectCardHoverBg,
      exported: new Date().toISOString(),
    };
    
    const jsonStr = JSON.stringify(colorExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `colors-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

if (resetColorsBtn) {
  resetColorsBtn.addEventListener('click', () => {
    Object.assign(designSettings, defaultDesignSettings);
    localStorage.setItem('designSettings', JSON.stringify(designSettings));
    syncDesignControls();
    applyDesignSettings();
  });
}

if (applyModelPresetBtn) {
  applyModelPresetBtn.addEventListener('click', () => {
    applyPreset(presetSettings);
  });
}

// ============================================
// NOTES BOARD
// ============================================
const noteInput = document.getElementById('noteInput');
const addNoteBtn = document.getElementById('addNoteBtn');
const notesList = document.getElementById('notesList');

let notes = [];

function loadNotes() {
  const saved = localStorage.getItem('notes');
  if (saved) {
    notes = JSON.parse(saved);
    renderNotes();
  }
}

function saveNotes() {
  localStorage.setItem('notes', JSON.stringify(notes));
}

function addNote() {
  const text = noteInput.value.trim();
  if (text === '') return;
  
  const note = {
    id: Date.now(),
    text: text,
    timestamp: new Date().toLocaleString(),
  };
  
  notes.unshift(note);
  saveNotes();
  renderNotes();
  noteInput.value = '';
}

function renderNotes() {
  notesList.innerHTML = '';
  notes.forEach(note => {
    const noteEl = document.createElement('div');
    noteEl.className = 'note-item';
    noteEl.innerHTML = `
      <div>${note.text}</div>
      <span class="note-time">${note.timestamp}</span>
    `;
    notesList.appendChild(noteEl);
  });
}

if (addNoteBtn) {
  addNoteBtn.addEventListener('click', addNote);
}

if (noteInput) {
  noteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      addNote();
    }
  });
}

loadNotes();

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
        const navbar = document.querySelector('.navbar');
        const navOffset = navbar ? navbar.offsetHeight : 0;
        const targetTop = target.getBoundingClientRect().top + window.scrollY - navOffset;
        window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      }
    }
  });
});

// ============================================
// GUI CONTROLS FOR FINE-TUNING
// ============================================
const guiContainer = document.getElementById('guiContainer');

// Create GUI inside the design panel container
const gui = new window.lil.GUI({ 
  title: 'Model Settings',
  container: guiContainer
});

// Remove the old setupMobileGuiToggle since GUI is now in design panel
// GUI will be controlled through design panel tabs

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
  roughness: 0.4,
  color: 0xa1a1a1,
  emissiveColor: 0x000000,
  emissiveIntensity: 0.9,
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

const ambientControl = { intensity: 1.05, color: 0xa3a3a3, visible: true };
lightFolder.add(ambientControl, 'intensity', 0, 2, 0.05).onChange((val) => {
  ambientLight.intensity = val;
}).name('Ambient Intensity');
lightFolder.addColor(ambientControl, 'color').onChange((val) => {
  ambientLight.color.setHex(val);
}).name('Ambient Color');
lightFolder.add(ambientControl, 'visible').onChange((val) => {
  ambientLight.visible = val;
}).name('Ambient Visible');

const hemiControl = { intensity: 0.15, skyColor: 0xffffff, groundColor: 0x737373, visible: false };
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

const dir1Control = { intensity: 1.75, color: 0xffffff, x: -10, y: 5, z: 3, visible: true };
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

const dir2Control = { intensity: 0.3, color: 0xb28585, x: -5, y: -3, z: 5, visible: true };
lightFolder.add(dir2Control, 'intensity', 0, 2, 0.05).onChange((val) => {
  directionalLight2.intensity = val;
}).name('Dir Light 2 Intensity');
lightFolder.addColor(dir2Control, 'color').onChange((val) => {
  directionalLight2.color.setHex(val);
}).name('Dir Light 2 Color');
lightFolder.add(dir2Control, 'visible').onChange((val) => {
  directionalLight2.visible = val;
}).name('Dir Light 2 Visible');

const point1Control = { intensity: 0.9, color: 0xffbfa8, x: 2.5, y: 1.5, z: 2, visible: true };
lightFolder.add(point1Control, 'intensity', 0, 2, 0.05).onChange((val) => {
  point1.intensity = val;
}).name('Point Light 1 Intensity');
lightFolder.add(point1Control, 'visible').onChange((val) => {
  point1.visible = val;
}).name('Point Light 1 Visible');

const point2Control = { intensity: 0.1, color: 0x8fb6ff, x: -2.5, y: 1, z: 3, visible: true };
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
const renderControl = { bgColor: 0x1c1a1c, exposure: 1.6 };
renderFolder.addColor(renderControl, 'bgColor').onChange((val) => {
  document.body.style.background = `#${val.toString(16).padStart(6, '0')}`;
}).name('Background Color');
renderFolder.add(renderControl, 'exposure', 0, 2, 0.1).onChange((val) => {
  renderer.toneMappingExposure = val;
}).name('Tone Mapping Exposure');

renderFolder.add(environmentConfig, 'mistEnabled').onChange(applyEnvironmentSettings).name('Mist Enabled');
renderFolder.add(environmentConfig, 'mistOpacity', 0, 1, 0.05).onChange(applyEnvironmentSettings).name('Mist Opacity');
renderFolder.add(environmentConfig, 'mistBlur', 10, 160, 5).onChange(applyEnvironmentSettings).name('Mist Blur');
renderFolder.add(environmentConfig, 'mistScale', 0.6, 2, 0.05).onChange(applyEnvironmentSettings).name('Mist Scale');
renderFolder.add(environmentConfig, 'mistParallax', 0, 20, 1).name('Mist Parallax');
renderFolder.addColor(environmentConfig, 'mistColor1').onChange(applyEnvironmentSettings).name('Mist Color 1');
renderFolder.addColor(environmentConfig, 'mistColor2').onChange(applyEnvironmentSettings).name('Mist Color 2');
renderFolder.addColor(environmentConfig, 'mistColor3').onChange(applyEnvironmentSettings).name('Mist Color 3');
renderFolder.add(environmentConfig, 'radial1Size', 400, 1400, 20).onChange(applyEnvironmentSettings).name('Radial 1 Size');
renderFolder.add(environmentConfig, 'radial1X', 0, 100, 1).onChange(applyEnvironmentSettings).name('Radial 1 X');
renderFolder.add(environmentConfig, 'radial1Y', 0, 100, 1).onChange(applyEnvironmentSettings).name('Radial 1 Y');
renderFolder.add(environmentConfig, 'radial2Size', 400, 1400, 20).onChange(applyEnvironmentSettings).name('Radial 2 Size');
renderFolder.add(environmentConfig, 'radial2X', 0, 100, 1).onChange(applyEnvironmentSettings).name('Radial 2 X');
renderFolder.add(environmentConfig, 'radial2Y', 0, 100, 1).onChange(applyEnvironmentSettings).name('Radial 2 Y');

// Environment controls
const envFolder = gui.addFolder('Environment');
envFolder.add(environmentConfig, 'rimIntensity', 0, 2, 0.05).onChange(applyEnvironmentSettings).name('Rim Intensity');
envFolder.addColor(environmentConfig, 'rimColor').onChange(applyEnvironmentSettings).name('Rim Color');
envFolder.add(environmentConfig, 'rimX', -10, 10, 0.5).onChange(applyEnvironmentSettings).name('Rim X');
envFolder.add(environmentConfig, 'rimY', -10, 10, 0.5).onChange(applyEnvironmentSettings).name('Rim Y');
envFolder.add(environmentConfig, 'rimZ', -10, 10, 0.5).onChange(applyEnvironmentSettings).name('Rim Z');
envFolder.add(environmentConfig, 'vignetteOpacity', 0, 0.8, 0.05).onChange(applyEnvironmentSettings).name('Vignette');
envFolder.add(environmentConfig, 'grainOpacity', 0, 0.2, 0.01).onChange(applyEnvironmentSettings).name('Grain');
envFolder.add(environmentConfig, 'backdropOpacity', 0.2, 1, 0.05).onChange(applyEnvironmentSettings).name('Backdrop');
envFolder.add(environmentConfig, 'parallaxStrength', 0, 20, 1).name('Parallax');


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

// Apply current preset values on load
applyPreset(presetSettings);

// Collapse all folders for compact sidebar appearance (user can expand as needed)
cameraFolder.close();
materialFolder.close();
lightFolder.close();
renderFolder.close();
envFolder.close();
interactionFolder.close();
hitboxFolder.close();
buttonFolder.close();
settingsFolder.close();


