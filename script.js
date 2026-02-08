const downloadButton = document.getElementById('downloadButton');
const sound = document.getElementById('sound');
const modelContainer = document.getElementById('modelContainer');
const heroSection = document.querySelector('.hero-section');
const scrollHint = document.getElementById('scrollHint');
const heroMistLayers = document.querySelectorAll('.hero-mist');
let modelControl = null;
let modelBaseScale = 1;
let materialControl = null;

const APP_VERSION = '2026-02-08-2';
const storedAppVersion = localStorage.getItem('appVersion');
if (storedAppVersion !== APP_VERSION) {
  localStorage.removeItem('orbitalSettings');
  localStorage.removeItem('uiSettings');
  localStorage.removeItem('palettePresets');
  localStorage.removeItem('orbitPalettePresets');
  localStorage.setItem('appVersion', APP_VERSION);
}

const runHardReset = async () => {
  localStorage.clear();
  sessionStorage.clear();
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
  const url = new URL(window.location.href);
  url.searchParams.delete('hardReset');
  window.location.replace(url.toString());
};

window.runHardReset = runHardReset;

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('hardReset') === '1') {
  runHardReset();
}

// Mobile fallback elements (added in index.html)
const mobileFallback = document.getElementById('mobileFallback');
// Icon hover swap logic
document.querySelectorAll('.corner-box-icon').forEach(icon => {
  const src = icon.getAttribute('src');
  // Use icons/ for both normal and hover icons, matching actual filenames
  const hoverSrc = src.replace('.png', '_hover.png');
  icon.addEventListener('mouseenter', () => {
    icon.setAttribute('src', hoverSrc);
  });
  icon.addEventListener('mouseleave', () => {
    icon.setAttribute('src', src);
  });
});
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
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.1;

camera.position.z = 2.75;

// Lighting (richer environment with multiple light sources)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x737373, 0.15);
hemiLight.position.set(0, 50, 0);
hemiLight.visible = false;
scene.add(hemiLight);

const directionalLight1 = new THREE.DirectionalLight(0xffffff, 2.4);
directionalLight1.position.set(-10, 5, 3);
directionalLight1.castShadow = true;
directionalLight1.shadow.mapSize.set(2048, 2048);
directionalLight1.shadow.bias = -0.0005;
directionalLight1.shadow.normalBias = 0.02;
directionalLight1.shadow.camera.near = 0.5;
directionalLight1.shadow.camera.far = 50;
directionalLight1.shadow.camera.left = -10;
directionalLight1.shadow.camera.right = 10;
directionalLight1.shadow.camera.top = 10;
directionalLight1.shadow.camera.bottom = -10;
scene.add(directionalLight1);

const directionalLight2 = new THREE.DirectionalLight(0xffcfb3, 0.6);
directionalLight2.position.set(-5, -3, 5);
scene.add(directionalLight2);

// Soft colored rim/fill point lights
const point1 = new THREE.PointLight(0xffbfa8, 0.25, 12);
point1.position.set(2.5, 1.5, 2);
scene.add(point1);

const point2 = new THREE.PointLight(0x7fd3ff, 0.2, 12);
point2.position.set(-2.5, 1, 3);
scene.add(point2);

const point3 = new THREE.PointLight(0xffffff, 0.2, 15);
point3.position.set(0, -3, 5);
scene.add(point3);

// Rim light for metallic edge definition
const rimLight = new THREE.DirectionalLight(0xffffff, 0.85);
rimLight.position.set(6, 4, -6);
scene.add(rimLight);

const defaultToonMaterialSettings = {
  color: 0xff4d00,
  shadowColor: 0xff1e00,
  highlightColor: 0xff7d00,
  emissiveColor: 0x1a0f0f,
  emissiveIntensity: 0.35,
  shadeSteps: 4,
  shadowStrength: 0.35,
  highlightStrength: 0.74,
  strictColors: true,
  outlineThickness: 0.05,
  outlineColor: 0x494cbc,
  outlineOpacity: 1,
  outlineTextureIntensity: 0,
  outlineTextureScale: 1.6,
  pencilIntensity: 0.35,
  pencilScale: 1.4,
  edgeEnabled: false,
  edgeColor: 0x0b0b0b,
  edgeOpacity: 0.65,
  edgeThreshold: 24,
  edgeDashSize: 2,
  edgeGapSize: 1.5,
  edgeJitter: 0.002,
  edgeScale: 1.002,
};

const getChangedSettings = (base, current) => {
  const changes = {};
  Object.keys(current).forEach((key) => {
    const baseValue = base[key];
    const currentValue = current[key];
    if (JSON.stringify(baseValue) !== JSON.stringify(currentValue)) {
      changes[key] = currentValue;
    }
  });
  return changes;
};

let toonResources = null;
let strictLightingSnapshot = null;
const defaultBodyBackground = {
  image: window.getComputedStyle(document.body).backgroundImage,
  color: window.getComputedStyle(document.body).backgroundColor,
};

function buildToonGradientMap(steps, shadowColor, baseColor, highlightColor, shadowStrength, highlightStrength) {
  const safeSteps = Math.max(2, Math.round(steps || defaultToonMaterialSettings.shadeSteps));
  const shadow = Math.max(0, Math.min(1, shadowStrength ?? defaultToonMaterialSettings.shadowStrength));
  const highlight = Math.max(shadow + 0.1, Math.min(1, highlightStrength ?? defaultToonMaterialSettings.highlightStrength));
  const canvas = document.createElement('canvas');
  canvas.width = safeSteps;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  const base = new THREE.Color(baseColor);
  const shadowTint = new THREE.Color(shadowColor);
  const highlightTint = new THREE.Color(highlightColor);
  for (let i = 0; i < safeSteps; i += 1) {
    const t = i / (safeSteps - 1);
    let color = base;
    if (t <= shadow) {
      color = shadowTint;
    } else if (t >= highlight) {
      color = highlightTint;
    }
    const value = color.toArray().map((channel) => Math.round(channel * 255));
    ctx.fillStyle = `rgb(${value[0]}, ${value[1]}, ${value[2]})`;
    ctx.fillRect(i, 0, 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  if (typeof THREE.SRGBColorSpace !== 'undefined') {
    texture.colorSpace = THREE.SRGBColorSpace;
  } else if (typeof THREE.sRGBEncoding !== 'undefined') {
    texture.encoding = THREE.sRGBEncoding;
  }
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function buildPencilTexture(intensity) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgb(255, 255, 255)';
  ctx.fillRect(0, 0, size, size);

  if (!intensity || intensity <= 0) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  const lineAlpha = Math.max(0.05, Math.min(0.6, intensity * 0.5));
  ctx.strokeStyle = `rgba(0, 0, 0, ${lineAlpha})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 900; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const length = 10 + Math.random() * 40;
    const angle = Math.random() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  const imageData = ctx.getImageData(0, 0, size, size);
  const noiseScale = intensity * 30;
  for (let i = 0; i < imageData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * noiseScale;
    imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
    imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
    imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function getToonResources(settings) {
  const resolved = settings || defaultToonMaterialSettings;
  const steps = Math.max(2, Math.round(resolved.shadeSteps || defaultToonMaterialSettings.shadeSteps));
  const baseColor = resolved.color ?? defaultToonMaterialSettings.color;
  const shadowColor = resolved.shadowColor ?? defaultToonMaterialSettings.shadowColor;
  const highlightColor = resolved.highlightColor ?? defaultToonMaterialSettings.highlightColor;
  const shadowStrength = typeof resolved.shadowStrength === 'number'
    ? resolved.shadowStrength
    : defaultToonMaterialSettings.shadowStrength;
  const highlightStrength = typeof resolved.highlightStrength === 'number'
    ? resolved.highlightStrength
    : defaultToonMaterialSettings.highlightStrength;
  const pencilIntensity = typeof resolved.pencilIntensity === 'number'
    ? resolved.pencilIntensity
    : defaultToonMaterialSettings.pencilIntensity;
  const pencilScale = typeof resolved.pencilScale === 'number'
    ? resolved.pencilScale
    : defaultToonMaterialSettings.pencilScale;
  const outlineTextureIntensity = typeof resolved.outlineTextureIntensity === 'number'
    ? resolved.outlineTextureIntensity
    : defaultToonMaterialSettings.outlineTextureIntensity;
  const outlineTextureScale = typeof resolved.outlineTextureScale === 'number'
    ? resolved.outlineTextureScale
    : defaultToonMaterialSettings.outlineTextureScale;

  const gradientKey = `${steps}-${shadowStrength.toFixed(2)}-${highlightStrength.toFixed(2)}-${baseColor}-${shadowColor}-${highlightColor}`;

  if (!toonResources || toonResources.gradientKey !== gradientKey) {
    if (toonResources && toonResources.gradientMap) toonResources.gradientMap.dispose();
    toonResources = toonResources || {};
    toonResources.gradientMap = buildToonGradientMap(
      steps,
      shadowColor,
      baseColor,
      highlightColor,
      shadowStrength,
      highlightStrength
    );
    toonResources.gradientKey = gradientKey;
  }

  if (!toonResources || toonResources.pencilIntensity !== pencilIntensity) {
    if (toonResources && toonResources.pencilTexture) toonResources.pencilTexture.dispose();
    toonResources = toonResources || {};
    toonResources.pencilTexture = buildPencilTexture(pencilIntensity);
    toonResources.pencilIntensity = pencilIntensity;
  }

  if (!toonResources || toonResources.outlineTextureIntensity !== outlineTextureIntensity) {
    if (toonResources && toonResources.outlineTexture) toonResources.outlineTexture.dispose();
    toonResources = toonResources || {};
    toonResources.outlineTexture = buildPencilTexture(outlineTextureIntensity);
    toonResources.outlineTextureIntensity = outlineTextureIntensity;
  }

  if (toonResources.pencilTexture) {
    toonResources.pencilTexture.repeat.set(pencilScale, pencilScale);
  }

  if (toonResources.outlineTexture) {
    toonResources.outlineTexture.repeat.set(outlineTextureScale, outlineTextureScale);
  }

  return toonResources;
}

function applyOutlineMesh(mesh, settings) {
  if (!mesh || !mesh.geometry || mesh.isSkinnedMesh || (mesh.userData && mesh.userData.isOutline)) return;

  const resolved = settings || defaultToonMaterialSettings;
  if (!resolved.outlineThickness || resolved.outlineThickness <= 0) return;
  const resources = getToonResources(resolved);
  const existing = mesh.userData.outlineMesh;
  if (existing) {
    mesh.remove(existing);
    if (existing.material) existing.material.dispose();
    mesh.userData.outlineMesh = null;
  }

  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: resolved.outlineColor,
    side: THREE.BackSide,
    transparent: resolved.outlineOpacity < 1,
    opacity: resolved.outlineOpacity,
    map: resources.outlineTexture,
    depthWrite: false,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMaterial);
  outlineMesh.scale.setScalar(1 + resolved.outlineThickness);
  outlineMesh.renderOrder = -1;
  outlineMesh.frustumCulled = false;
  outlineMesh.userData.isOutline = true;
  mesh.add(outlineMesh);
  mesh.userData.outlineMesh = outlineMesh;
}

function applyEdgeLines(mesh, settings) {
  if (!mesh || !mesh.geometry || (mesh.userData && mesh.userData.isOutline)) return;
  const resolved = settings || defaultToonMaterialSettings;
  const existing = mesh.userData.edgeLines;
  if (existing) {
    mesh.remove(existing);
    if (existing.material) existing.material.dispose();
    if (existing.geometry) existing.geometry.dispose();
    mesh.userData.edgeLines = null;
  }

  if (!resolved.edgeEnabled) return;

  const edgeGeometry = new THREE.EdgesGeometry(mesh.geometry, resolved.edgeThreshold);
  if (resolved.edgeJitter > 0) {
    const pos = edgeGeometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      pos.setXYZ(
        i,
        pos.getX(i) + (Math.random() - 0.5) * resolved.edgeJitter,
        pos.getY(i) + (Math.random() - 0.5) * resolved.edgeJitter,
        pos.getZ(i) + (Math.random() - 0.5) * resolved.edgeJitter
      );
    }
    pos.needsUpdate = true;
  }

  const edgeMaterial = new THREE.LineDashedMaterial({
    color: resolved.edgeColor,
    opacity: resolved.edgeOpacity,
    transparent: true,
    dashSize: resolved.edgeDashSize,
    gapSize: resolved.edgeGapSize,
    depthTest: true,
  });
  const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  edgeLines.computeLineDistances();
  edgeLines.scale.setScalar(resolved.edgeScale);
  edgeLines.renderOrder = -1;
  edgeLines.userData.isOutline = true;
  mesh.add(edgeLines);
  mesh.userData.edgeLines = edgeLines;
}

function createToonMaterial(settings) {
  const resolved = { ...defaultToonMaterialSettings, ...settings };
  const resources = getToonResources(resolved);
  const strictColors = !!resolved.strictColors;
  const material = new THREE.MeshToonMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(resolved.emissiveColor),
    emissiveIntensity: strictColors ? 0 : resolved.emissiveIntensity,
    gradientMap: resources.gradientMap,
    map: strictColors ? null : resources.pencilTexture,
  });
  material.toneMapped = !strictColors;
  return material;
}

function applyStrictColorLighting() {
  if (!materialControl) return;

  if (materialControl.strictColors) {
    if (!strictLightingSnapshot) {
      strictLightingSnapshot = {
        ambient: { ...ambientControl },
        hemisphere: { ...hemiControl },
        directional1: { ...dir1Control },
        directional2: { ...dir2Control },
        point1: { ...point1Control },
        point2: { ...point2Control },
        point3: { ...point3Control },
        rim: {
          intensity: rimLight.intensity,
          color: rimLight.color.getHex(),
          position: rimLight.position.clone(),
          visible: rimLight.visible,
        },
        environment: {
          vignetteOpacity: environmentConfig.vignetteOpacity,
          grainOpacity: environmentConfig.grainOpacity,
          mistEnabled: environmentConfig.mistEnabled,
        }
      };
    }

    ambientControl.intensity = 0;
    ambientControl.visible = false;
    ambientLight.intensity = 0;
    ambientLight.visible = false;

    hemiControl.intensity = 0;
    hemiControl.visible = false;
    hemiLight.intensity = 0;
    hemiLight.visible = false;

    dir1Control.intensity = Math.PI;
    dir1Control.color = 0xffffff;
    dir1Control.visible = true;
    directionalLight1.intensity = Math.PI;
    directionalLight1.color.setHex(0xffffff);
    directionalLight1.visible = true;

    dir2Control.intensity = 0;
    dir2Control.visible = false;
    directionalLight2.intensity = 0;
    directionalLight2.visible = false;

    point1Control.intensity = 0;
    point1Control.visible = false;
    point1.intensity = 0;
    point1.visible = false;

    point2Control.intensity = 0;
    point2Control.visible = false;
    point2.intensity = 0;
    point2.visible = false;

    point3Control.intensity = 0;
    point3Control.visible = false;
    point3.intensity = 0;
    point3.visible = false;

    rimLight.intensity = 0;
    rimLight.visible = false;

    environmentConfig.vignetteOpacity = 0;
    environmentConfig.grainOpacity = 0;
    environmentConfig.mistEnabled = false;
    applyEnvironmentSettings();

  } else if (strictLightingSnapshot) {
    Object.assign(ambientControl, strictLightingSnapshot.ambient);
    ambientLight.intensity = strictLightingSnapshot.ambient.intensity;
    ambientLight.color.setHex(strictLightingSnapshot.ambient.color);
    ambientLight.visible = strictLightingSnapshot.ambient.visible;

    Object.assign(hemiControl, strictLightingSnapshot.hemisphere);
    hemiLight.intensity = strictLightingSnapshot.hemisphere.intensity;
    hemiLight.color.setHex(strictLightingSnapshot.hemisphere.skyColor);
    hemiLight.groundColor.setHex(strictLightingSnapshot.hemisphere.groundColor);
    hemiLight.visible = strictLightingSnapshot.hemisphere.visible;

    Object.assign(dir1Control, strictLightingSnapshot.directional1);
    directionalLight1.intensity = strictLightingSnapshot.directional1.intensity;
    directionalLight1.color.setHex(strictLightingSnapshot.directional1.color);
    directionalLight1.position.set(strictLightingSnapshot.directional1.x, strictLightingSnapshot.directional1.y, strictLightingSnapshot.directional1.z);
    directionalLight1.visible = strictLightingSnapshot.directional1.visible;

    Object.assign(dir2Control, strictLightingSnapshot.directional2);
    directionalLight2.intensity = strictLightingSnapshot.directional2.intensity;
    directionalLight2.color.setHex(strictLightingSnapshot.directional2.color);
    directionalLight2.position.set(strictLightingSnapshot.directional2.x, strictLightingSnapshot.directional2.y, strictLightingSnapshot.directional2.z);
    directionalLight2.visible = strictLightingSnapshot.directional2.visible;

    Object.assign(point1Control, strictLightingSnapshot.point1);
    point1.intensity = strictLightingSnapshot.point1.intensity;
    point1.color.setHex(strictLightingSnapshot.point1.color);
    point1.position.set(strictLightingSnapshot.point1.x, strictLightingSnapshot.point1.y, strictLightingSnapshot.point1.z);
    point1.visible = strictLightingSnapshot.point1.visible;

    Object.assign(point2Control, strictLightingSnapshot.point2);
    point2.intensity = strictLightingSnapshot.point2.intensity;
    point2.color.setHex(strictLightingSnapshot.point2.color);
    point2.position.set(strictLightingSnapshot.point2.x, strictLightingSnapshot.point2.y, strictLightingSnapshot.point2.z);
    point2.visible = strictLightingSnapshot.point2.visible;

    Object.assign(point3Control, strictLightingSnapshot.point3);
    point3.intensity = strictLightingSnapshot.point3.intensity;
    point3.color.setHex(strictLightingSnapshot.point3.color);
    point3.position.set(strictLightingSnapshot.point3.x, strictLightingSnapshot.point3.y, strictLightingSnapshot.point3.z);
    point3.visible = strictLightingSnapshot.point3.visible;

    rimLight.intensity = strictLightingSnapshot.rim.intensity;
    rimLight.color.setHex(strictLightingSnapshot.rim.color);
    rimLight.position.copy(strictLightingSnapshot.rim.position);
    rimLight.visible = strictLightingSnapshot.rim.visible;

    if (strictLightingSnapshot.environment) {
      environmentConfig.vignetteOpacity = strictLightingSnapshot.environment.vignetteOpacity;
      environmentConfig.grainOpacity = strictLightingSnapshot.environment.grainOpacity;
      environmentConfig.mistEnabled = strictLightingSnapshot.environment.mistEnabled;
      applyEnvironmentSettings();
    }

    strictLightingSnapshot = null;
  }

  if (window.gui) window.gui.updateDisplay();
}

function applyBackgroundSetting() {
  if (!renderControl) return;
  if (renderControl.useSolidBg) {
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = `#${renderControl.bgColor.toString(16).padStart(6, '0')}`;
  } else {
    document.body.style.backgroundImage = defaultBodyBackground.image;
    document.body.style.backgroundColor = defaultBodyBackground.color;
  }
}

function applyToonMaterialToMesh(mesh, settings) {
  if (!mesh || !mesh.isMesh || (mesh.userData && mesh.userData.isOutline)) return;
  const resolved = settings || defaultToonMaterialSettings;
  const strictColors = !!resolved.strictColors;
  const material = createToonMaterial(settings);
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((mat) => {
      if (mat && mat.dispose) mat.dispose();
    });
  } else if (mesh.material && mesh.material.dispose) {
    mesh.material.dispose();
  }
  mesh.material = material;
  mesh.castShadow = !strictColors;
  mesh.receiveShadow = !strictColors;
  applyOutlineMesh(mesh, settings);
  applyEdgeLines(mesh, settings);
}

function applyToonMaterialToModel() {
  if (!model) return;
  const resolved = materialControl || defaultToonMaterialSettings;
  model.traverse((child) => {
    if (child.isMesh && !(child.userData && child.userData.isOutline)) {
      applyToonMaterialToMesh(child, resolved);
    }
  });
}

// Load 3D Model
THREE.Cache.enabled = true;
const loader = new THREE.GLTFLoader();
let model = null;
let menuOrbitRotationY = 0;
let menuOrbitRotationTargetY = 0;
const menuOrbitStepY = (Math.PI / 180) * 45;

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
  const cube = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  applyToonMaterialToMesh(cube, materialControl || defaultToonMaterialSettings);
  cube.castShadow = true;
  cube.receiveShadow = true;
  scene.add(cube);
  model = cube;
  modelBaseScale = model.scale.x || 1;
  if (modelControl) {
    model.scale.setScalar(modelBaseScale * modelControl.scale);
    model.position.set(modelControl.posX, modelControl.posY, modelControl.posZ);
  }
}

// Give the GLTF loader a bit more time for external .bin/.wasm fetches
fallbackTimer = setTimeout(() => {
  if (!model) createFallbackCube();
}, 8000);

// Always auto-load the 3D model instantly
const shouldAutoLoadModel = true;

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
    
    const targetSize = isMobileDevice ? 2.4 : 2.8;
    const scale = maxDim === 0 ? 1 : targetSize / maxDim;
    console.log('Calculated scale:', scale, 'maxDim:', maxDim);
    
    model.scale.multiplyScalar(scale);
    if (maxDim > 0) {
      model.position.sub(center.multiplyScalar(scale));
    }
    modelBaseScale = model.scale.x || 1;
    if (modelControl) {
      model.scale.setScalar(modelBaseScale * modelControl.scale);
      model.position.set(modelControl.posX, modelControl.posY, modelControl.posZ);
    }
    
    // Count meshes
    let meshCount = 0;
    model.traverse((child) => {
      if (child.isMesh) {
        meshCount++;
        applyToonMaterialToMesh(child, materialControl || defaultToonMaterialSettings);
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

// Kick off loading instantly
function startModelLoading() {
  if (startedLoading) return;
  startedLoading = true;
  tryLoadNext();
}

// Always hide mobile fallback and start loading immediately
if (mobileFallback) mobileFallback.style.display = 'none';
startModelLoading();

function resizeRendererToContainer() {
  const width = modelContainer.clientWidth;
  const height = modelContainer.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// Remove manual load button handlers - always auto-load
// Model loads instantly on page load

// Mouse tracking - normalized coordinates for cursor-following
let mouseX = 0;
let mouseY = 0;
let targetMouseX = 0;
let targetMouseY = 0;
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
  enabled: false, // Full-page cursor detection
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
  model: { posX: 0, posY: 0.7, posZ: -2, scale: 1.5 },
  camera: { z: 2.5 },
  material: {
    color: 0x632E12,
    shadowColor: 0x090811,
    highlightColor: 0xBA6017,
    emissiveColor: 0x1a0f0f,
    emissiveIntensity: 0.35,
    shadeSteps: 4,
    shadowStrength: 0.35,
    highlightStrength: 0.68,
    strictColors: true,
    outlineThickness: 0.05,
    outlineColor: 0x7E7272,
    outlineOpacity: 1,
    outlineTextureIntensity: 0,
    outlineTextureScale: 1.6,
    pencilIntensity: 0.35,
    pencilScale: 1.4,
    edgeEnabled: false,
    edgeColor: 0x0b0b0b,
    edgeOpacity: 0.65,
    edgeThreshold: 24,
    edgeDashSize: 2,
    edgeGapSize: 1.5,
    edgeJitter: 0.002,
    edgeScale: 1.002,
  },
  ambient: { intensity: 0.35, color: 0xffffff, visible: true },
  hemisphere: { intensity: 0.15, skyColor: 16777215, groundColor: 7566195, visible: false },
  directional1: { intensity: 2.4, color: 0xffffff, x: -10, y: 5, z: 3, visible: true },
  directional2: { intensity: 0.6, color: 0xffcfb3, x: -5, y: -3, z: 5, visible: true },
  point1: { intensity: 0.25, color: 0xffbfa8, x: 2.5, y: 1.5, z: 2, visible: true },
  point2: { intensity: 0.2, color: 0x7fd3ff, x: -2.5, y: 1, z: 3, visible: true },
  point3: { intensity: 0.2, color: 0xffffff, x: 0, y: -3, z: 5, visible: true },
  rendering: { bgColor: 0xF0EBEA, exposure: 1.1, useSolidBg: true },
  interaction: { rotationSpeedX: 0.4, rotationSpeedY: 0.2, inertia: 0.99, returnSpeed: 0.2, autoOrbit: false, autoOrbitSpeed: 0.5 },
};

const modelTunerDefaults = { posX: 0, posY: 0.7, posZ: -2, scale: 1.5 };

function applyPreset(preset) {
  // Apply model position
  if (modelControl) {
    modelControl.scale = typeof preset.model.scale === 'number' ? preset.model.scale : 1;
    modelControl.posX = preset.model.posX;
    modelControl.posY = preset.model.posY;
    modelControl.posZ = preset.model.posZ;
  }
  if (model) {
    const scaleValue = typeof preset.model.scale === 'number' ? preset.model.scale : 1;
    model.scale.setScalar(modelBaseScale * scaleValue);
    model.position.set(preset.model.posX, preset.model.posY, preset.model.posZ);
  }

  // Apply camera
  camera.position.z = preset.camera.z;
  camera.updateProjectionMatrix();

  // Apply material
  if (materialControl) {
    materialControl.color = preset.material.color;
    materialControl.shadowColor = preset.material.shadowColor;
    materialControl.highlightColor = preset.material.highlightColor;
    materialControl.emissiveColor = preset.material.emissiveColor;
    materialControl.emissiveIntensity = preset.material.emissiveIntensity;
    materialControl.shadeSteps = preset.material.shadeSteps;
    materialControl.shadowStrength = preset.material.shadowStrength;
    materialControl.highlightStrength = preset.material.highlightStrength;
    materialControl.strictColors = preset.material.strictColors;
    materialControl.outlineThickness = preset.material.outlineThickness;
    materialControl.outlineColor = preset.material.outlineColor;
    materialControl.outlineOpacity = preset.material.outlineOpacity;
    materialControl.outlineTextureIntensity = preset.material.outlineTextureIntensity;
    materialControl.outlineTextureScale = preset.material.outlineTextureScale;
    materialControl.pencilIntensity = preset.material.pencilIntensity;
    materialControl.pencilScale = preset.material.pencilScale;
    materialControl.edgeEnabled = preset.material.edgeEnabled;
    materialControl.edgeColor = preset.material.edgeColor;
    materialControl.edgeOpacity = preset.material.edgeOpacity;
    materialControl.edgeThreshold = preset.material.edgeThreshold;
    materialControl.edgeDashSize = preset.material.edgeDashSize;
    materialControl.edgeGapSize = preset.material.edgeGapSize;
    materialControl.edgeJitter = preset.material.edgeJitter;
    materialControl.edgeScale = preset.material.edgeScale;
  }
  applyToonMaterialToModel();

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

  applyStrictColorLighting();

  // Apply rendering
  renderControl.bgColor = preset.rendering.bgColor;
  renderControl.exposure = preset.rendering.exposure;
  renderControl.useSolidBg = !!preset.rendering.useSolidBg;
  applyBackgroundSetting();
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
          lastTouchX = touch.clientX;
          lastTouchY = touch.clientY;
          
          // Update mouse position for cursor-following
          mouseX = (touch.clientX / window.innerWidth) * 2 - 1;
          mouseY = -(touch.clientY / window.innerHeight) * 2 + 1;
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
    // Smooth menu-driven Y rotation to sync with orbital navigation
    menuOrbitRotationY += (menuOrbitRotationTargetY - menuOrbitRotationY) * 0.0324;

    // Auto-orbit
    if (interactionConfig.autoOrbit) {
      model.rotation.y += interactionConfig.autoOrbitSpeed * 0.01;
    }

    const baseTargetX = interactionConfig.autoOrbit ? 0 : -mouseY * Math.PI * 0.15;
    const baseTargetY = interactionConfig.autoOrbit ? 0 : mouseX * Math.PI * 0.25;
    const targetRotationX = baseTargetX;
    const targetRotationY = baseTargetY + menuOrbitRotationY;
    model.rotation.x += (targetRotationX - model.rotation.x) * 0.06;
    model.rotation.y += (targetRotationY - model.rotation.y) * 0.06;
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
const palettePresetToggle = document.getElementById('palettePresetToggle');
const palettePresetPanel = document.getElementById('palettePresetPanel');
const palettePresetClose = document.getElementById('palettePresetClose');
const uiPaletteSyncToggle = document.getElementById('uiPaletteSyncToggle');
const orbitPaletteSyncToggle = document.getElementById('orbitPaletteSyncToggle');
const palettePresetSelect = document.getElementById('palettePresetSelect');
const savePalettePresetBtn = document.getElementById('savePalettePreset');
const deletePalettePresetBtn = document.getElementById('deletePalettePreset');

// Orbit Colors Panel Elements
const orbitColorsToggle = document.getElementById('orbitColorsToggle');
const orbitColorsPanel = document.getElementById('orbitColorsPanel');
const orbitColorsClose = document.getElementById('orbitColorsClose');
const orbitColorsExport = document.getElementById('orbitColorsExport');
const orbitColorsGuiContainer = document.getElementById('orbitColorsGuiContainer');
const orbitPaletteSelect = document.getElementById('orbitPaletteSelect');
const saveOrbitPaletteBtn = document.getElementById('saveOrbitPalette');
const deleteOrbitPaletteBtn = document.getElementById('deleteOrbitPalette');

const defaultDesignSettings = {
  // Colors
  primaryColor: '#c7d0dc',
  secondaryColor: '#8a93a4',
  accentColor: '#d7dee7',
  backgroundColor: '#0f1216',
  sectionBackground: '#1a2028',
  textColor: '#f1f4f8',
  textSecondaryColor: '#b8c0ce',
  borderColor: '#2a323d',

  // Hero environment colors
  heroBg1: '#0f1216',
  heroBg2: '#1a2028',
  heroAccent: '#2a313b',
  heroGlow: '#353f4b',
  
  // Button styles
  buttonTextColor: '#f1f4f8',
  buttonOpacity: '0.6',
  
  // Section styles
  projectCardBg: 'rgba(255, 255, 255, 0.05)',
  projectCardHoverBg: 'rgba(255, 255, 255, 0.09)',
  
  // Typography
  headingSize: '2.5',
  bodyFontSize: '1',
  navbarOpacity: '0.95',
};

const designSettings = { ...defaultDesignSettings };

const globalAppearance = (() => {
  try {
    return JSON.parse(localStorage.getItem('globalAppearance') || '{}');
  } catch (err) {
    return {};
  }
})();

if (Object.keys(globalAppearance).length) {
  designSettings.primaryColor = globalAppearance.primaryColor || designSettings.primaryColor;
  designSettings.secondaryColor = globalAppearance.secondaryColor || designSettings.secondaryColor;
  designSettings.accentColor = globalAppearance.accentColor || designSettings.accentColor;
  designSettings.textColor = globalAppearance.textColor || designSettings.textColor;
  designSettings.textSecondaryColor = globalAppearance.textMuted || designSettings.textSecondaryColor;
  designSettings.backgroundColor = globalAppearance.pageBg || designSettings.backgroundColor;
  designSettings.sectionBackground = globalAppearance.panelBg || designSettings.sectionBackground;
  designSettings.borderColor = globalAppearance.panelBorder || designSettings.borderColor;
}

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

const PALETTE_STORAGE_KEY = 'palettePresets';
const UI_PALETTE_SYNC_KEY = 'uiPaletteSyncEnabled';
const ORBIT_PALETTE_SYNC_KEY = 'orbitPaletteSyncEnabled';
let paletteStorage = null;
let pendingPaletteId = null;
let uiPaletteSyncEnabled = localStorage.getItem(UI_PALETTE_SYNC_KEY) === 'true';
let orbitPaletteSyncEnabled = localStorage.getItem(ORBIT_PALETTE_SYNC_KEY) === 'true';

const buildPaletteFromPreset = () => ({
  toon: {
    color: presetSettings.material.color,
    shadowColor: presetSettings.material.shadowColor,
    highlightColor: presetSettings.material.highlightColor,
    highlightStrength: presetSettings.material.highlightStrength,
    outlineColor: presetSettings.material.outlineColor,
  },
  rendering: {
    bgColor: presetSettings.rendering.bgColor,
    useSolidBg: !!presetSettings.rendering.useSolidBg,
  }
});

const buildPaletteFromCurrent = () => {
  if (!materialControl || !renderControl) {
    return buildPaletteFromPreset();
  }
  return {
    toon: {
      color: materialControl.color,
      shadowColor: materialControl.shadowColor,
      highlightColor: materialControl.highlightColor,
      highlightStrength: materialControl.highlightStrength,
      outlineColor: materialControl.outlineColor,
    },
    rendering: {
      bgColor: renderControl.bgColor,
      useSolidBg: !!renderControl.useSolidBg,
    }
  };
};

const loadPaletteStorage = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PALETTE_STORAGE_KEY) || '{}');
    return {
      version: parsed.version || 1,
      palettes: Array.isArray(parsed.palettes) ? parsed.palettes : [],
      selectedId: parsed.selectedId || null,
    };
  } catch (err) {
    return { version: 1, palettes: [], selectedId: null };
  }
};

const savePaletteStorage = (storage) => {
  localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(storage));
};

const ensureDefaultPalette = (storage) => {
  if (storage.palettes.length) return;
  storage.palettes.push({
    id: 'default',
    name: 'Preset Default',
    palette: buildPaletteFromPreset(),
  });
  storage.selectedId = 'default';
};

const renderPaletteOptions = (storage) => {
  if (!palettePresetSelect) return;
  palettePresetSelect.innerHTML = '';
  storage.palettes.forEach((entry) => {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.name;
    palettePresetSelect.appendChild(option);
  });
  if (storage.selectedId) {
    palettePresetSelect.value = storage.selectedId;
  }
};

const applyPaletteById = (paletteId, persistSelection = true) => {
  if (!paletteStorage) return;
  const entry = paletteStorage.palettes.find((item) => item.id === paletteId);
  if (!entry || !entry.palette) return;

  if (persistSelection) {
    paletteStorage.selectedId = paletteId;
    savePaletteStorage(paletteStorage);
  }

  if (!materialControl || !renderControl) {
    pendingPaletteId = paletteId;
    return;
  }

  const toon = entry.palette.toon || {};
  materialControl.color = toon.color ?? defaultToonMaterialSettings.color;
  materialControl.shadowColor = toon.shadowColor ?? defaultToonMaterialSettings.shadowColor;
  materialControl.highlightColor = toon.highlightColor ?? defaultToonMaterialSettings.highlightColor;
  materialControl.highlightStrength = typeof toon.highlightStrength === 'number'
    ? toon.highlightStrength
    : defaultToonMaterialSettings.highlightStrength;
  materialControl.outlineColor = toon.outlineColor ?? defaultToonMaterialSettings.outlineColor;

  const rendering = entry.palette.rendering || {};
  if (typeof rendering.bgColor === 'number') {
    renderControl.bgColor = rendering.bgColor;
  }
  if (typeof rendering.useSolidBg === 'boolean') {
    renderControl.useSolidBg = rendering.useSolidBg;
  }

  applyToonMaterialToModel();
  applyStrictColorLighting();
  applyBackgroundSetting();
  applyUiPaletteSync(entry.palette);
  applyOrbitPaletteSync(entry.palette);
  if (window.gui) window.gui.updateDisplay();
};

const getActivePalette = () => {
  if (paletteStorage && paletteStorage.selectedId) {
    const entry = paletteStorage.palettes.find((item) => item.id === paletteStorage.selectedId);
    if (entry && entry.palette) return entry.palette;
  }
  return buildPaletteFromCurrent();
};

const applyUiPaletteSync = (palette) => {
  if (!uiPaletteSyncEnabled) return;
  if (!palette || !palette.toon) return;
  const root = document.documentElement.style;
  const toHex = (value) => `#${Number(value).toString(16).padStart(6, '0')}`;
  root.setProperty('--ui-outline', toHex(palette.toon.color));
  root.setProperty('--ui-fill', toHex(palette.toon.highlightColor));
  root.setProperty('--ui-text', toHex(palette.toon.shadowColor));
  document.body.classList.add('palette-ui-sync');
};

const clearUiPaletteSync = () => {
  const root = document.documentElement.style;
  root.removeProperty('--ui-outline');
  root.removeProperty('--ui-fill');
  root.removeProperty('--ui-text');
  document.body.classList.remove('palette-ui-sync');
};

const applyOrbitPaletteSync = (palette) => {
  if (!orbitPaletteSyncEnabled) return;
  if (!palette || !palette.toon) return;
  const root = document.documentElement.style;
  const toHex = (value) => `#${Number(value).toString(16).padStart(6, '0')}`;
  root.setProperty('--orbit-outline', toHex(palette.toon.color));
  root.setProperty('--orbit-fill', toHex(palette.toon.highlightColor));
  root.setProperty('--orbit-text', toHex(palette.toon.shadowColor));
  document.body.classList.add('palette-orbit-sync');
};

const clearOrbitPaletteSync = () => {
  const root = document.documentElement.style;
  root.removeProperty('--orbit-outline');
  root.removeProperty('--orbit-fill');
  root.removeProperty('--orbit-text');
  document.body.classList.remove('palette-orbit-sync');
};

const initPalettePresets = () => {
  if (!palettePresetSelect) return;
  paletteStorage = loadPaletteStorage();
  ensureDefaultPalette(paletteStorage);
  renderPaletteOptions(paletteStorage);
  savePaletteStorage(paletteStorage);

  if (uiPaletteSyncToggle) {
    uiPaletteSyncToggle.checked = uiPaletteSyncEnabled;
  }
  if (orbitPaletteSyncToggle) {
    orbitPaletteSyncToggle.checked = orbitPaletteSyncEnabled;
  }

  palettePresetSelect.addEventListener('change', (event) => {
    applyPaletteById(event.target.value);
  });

  if (savePalettePresetBtn) {
    savePalettePresetBtn.addEventListener('click', () => {
      const name = window.prompt('Name this palette:', `Palette ${paletteStorage.palettes.length + 1}`);
      if (!name) return;
      const entry = {
        id: `palette-${Date.now()}`,
        name: name.trim() || `Palette ${paletteStorage.palettes.length + 1}`,
        palette: buildPaletteFromCurrent(),
      };
      paletteStorage.palettes.push(entry);
      paletteStorage.selectedId = entry.id;
      savePaletteStorage(paletteStorage);
      renderPaletteOptions(paletteStorage);
      applyPaletteById(entry.id, false);
    });
  }

  if (deletePalettePresetBtn) {
    deletePalettePresetBtn.addEventListener('click', () => {
      if (!paletteStorage.selectedId) return;
      const toDelete = paletteStorage.selectedId;
      paletteStorage.palettes = paletteStorage.palettes.filter((item) => item.id !== toDelete);
      if (!paletteStorage.palettes.length) {
        ensureDefaultPalette(paletteStorage);
      }
      paletteStorage.selectedId = paletteStorage.palettes[0]?.id || null;
      savePaletteStorage(paletteStorage);
      renderPaletteOptions(paletteStorage);
      if (paletteStorage.selectedId) {
        applyPaletteById(paletteStorage.selectedId, false);
      }
    });
  }
};

if (uiPaletteSyncToggle) {
  uiPaletteSyncToggle.addEventListener('change', (event) => {
    uiPaletteSyncEnabled = event.target.checked;
    localStorage.setItem(UI_PALETTE_SYNC_KEY, uiPaletteSyncEnabled ? 'true' : 'false');
    if (uiPaletteSyncEnabled) {
      applyUiPaletteSync(getActivePalette());
    } else {
      clearUiPaletteSync();
    }
  });
}

if (orbitPaletteSyncToggle) {
  orbitPaletteSyncToggle.addEventListener('change', (event) => {
    orbitPaletteSyncEnabled = event.target.checked;
    localStorage.setItem(ORBIT_PALETTE_SYNC_KEY, orbitPaletteSyncEnabled ? 'true' : 'false');
    if (orbitPaletteSyncEnabled) {
      applyOrbitPaletteSync(getActivePalette());
    } else {
      clearOrbitPaletteSync();
    }
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

if (palettePresetToggle && palettePresetPanel) {
  palettePresetToggle.addEventListener('click', () => {
    palettePresetPanel.classList.toggle('active');
    palettePresetPanel.setAttribute('aria-hidden', palettePresetPanel.classList.contains('active') ? 'false' : 'true');
  });
}

if (palettePresetClose && palettePresetPanel) {
  palettePresetClose.addEventListener('click', () => {
    palettePresetPanel.classList.remove('active');
    palettePresetPanel.setAttribute('aria-hidden', 'true');
  });
}

// ============================================
// ORBIT COLORS PANEL & PALETTE SYSTEM
// ============================================
const ORBIT_PALETTE_STORAGE_KEY = 'orbitPalettePresets';
let orbitPaletteStorage = null;

const defaultOrbitColorSettings = {
  flatColorMode: false,
  menuOutlineThickness: 1,
  menuOutlineColor: '#ffffff',
  arrowOutlineThickness: 1,
  arrowOutlineColor: '#ffffff',
  menuBaseColor: '#d6d6d6',
  menuTintColor: '#ffffff',
  menuAccentColor: '#ffffff',
  menuLabelColor: '#dddada',
  menuGlassOpacity: 0.46,
  menuTintOpacity: 0.5,
  menuBorderOpacity: 0.24,
  menuShadowOpacity: 0.52,
  menuGlowOpacity: 0.22,
  arrowBaseColor: '#d6d6d6',
  arrowTintColor: '#ffffff',
  arrowAccentColor: '#ffffff',
  arrowColor: '#e3e3e3',
  arrowGlassOpacity: 0.44,
  arrowTintOpacity: 0.5,
  arrowBorderOpacity: 0.2,
  arrowShadowOpacity: 0.4,
  arrowGlowOpacity: 0.2,
};

const buildOrbitPaletteFromCurrent = () => ({
  flatColorMode: uiSettings.flatColorMode,
  menuOutlineThickness: uiSettings.menuOutlineThickness,
  menuOutlineColor: uiSettings.menuOutlineColor,
  arrowOutlineThickness: uiSettings.arrowOutlineThickness,
  arrowOutlineColor: uiSettings.arrowOutlineColor,
  menuBaseColor: uiSettings.menuBaseColor,
  menuTintColor: uiSettings.menuTintColor,
  menuAccentColor: uiSettings.menuAccentColor,
  menuLabelColor: uiSettings.menuLabelColor,
  menuGlassOpacity: uiSettings.menuGlassOpacity,
  menuTintOpacity: uiSettings.menuTintOpacity,
  menuBorderOpacity: uiSettings.menuBorderOpacity,
  menuShadowOpacity: uiSettings.menuShadowOpacity,
  menuGlowOpacity: uiSettings.menuGlowOpacity,
  arrowBaseColor: uiSettings.arrowBaseColor,
  arrowTintColor: uiSettings.arrowTintColor,
  arrowAccentColor: uiSettings.arrowAccentColor,
  arrowColor: uiSettings.arrowColor,
  arrowGlassOpacity: uiSettings.arrowGlassOpacity,
  arrowTintOpacity: uiSettings.arrowTintOpacity,
  arrowBorderOpacity: uiSettings.arrowBorderOpacity,
  arrowShadowOpacity: uiSettings.arrowShadowOpacity,
  arrowGlowOpacity: uiSettings.arrowGlowOpacity,
});

const loadOrbitPaletteStorage = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORBIT_PALETTE_STORAGE_KEY) || '{}');
    return {
      version: parsed.version || 1,
      palettes: Array.isArray(parsed.palettes) ? parsed.palettes : [],
      selectedId: parsed.selectedId || null,
    };
  } catch (err) {
    return { version: 1, palettes: [], selectedId: null };
  }
};

const saveOrbitPaletteStorage = (storage) => {
  localStorage.setItem(ORBIT_PALETTE_STORAGE_KEY, JSON.stringify(storage));
};

const ensureDefaultOrbitPalette = (storage) => {
  if (storage.palettes.length) return;
  storage.palettes.push({
    id: 'default',
    name: 'Default Glass',
    palette: { ...defaultOrbitColorSettings },
  });
  storage.selectedId = 'default';
};

const renderOrbitPaletteOptions = (storage) => {
  if (!orbitPaletteSelect) return;
  orbitPaletteSelect.innerHTML = '';
  storage.palettes.forEach((entry) => {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.name;
    orbitPaletteSelect.appendChild(option);
  });
  if (storage.selectedId) {
    orbitPaletteSelect.value = storage.selectedId;
  }
};

const applyOrbitPaletteById = (paletteId, persistSelection = true) => {
  if (!orbitPaletteStorage) return;
  const entry = orbitPaletteStorage.palettes.find((item) => item.id === paletteId);
  if (!entry || !entry.palette) return;

  if (persistSelection) {
    orbitPaletteStorage.selectedId = paletteId;
    saveOrbitPaletteStorage(orbitPaletteStorage);
  }

  const palette = entry.palette;
  
  // Apply mode settings
  if (typeof palette.flatColorMode === 'boolean') uiSettings.flatColorMode = palette.flatColorMode;
  if (typeof palette.menuOutlineThickness === 'number') uiSettings.menuOutlineThickness = palette.menuOutlineThickness;
  if (palette.menuOutlineColor) uiSettings.menuOutlineColor = palette.menuOutlineColor;
  if (typeof palette.arrowOutlineThickness === 'number') uiSettings.arrowOutlineThickness = palette.arrowOutlineThickness;
  if (palette.arrowOutlineColor) uiSettings.arrowOutlineColor = palette.arrowOutlineColor;
  
  // Apply colors to uiSettings
  if (palette.menuBaseColor) uiSettings.menuBaseColor = palette.menuBaseColor;
  if (palette.menuTintColor) uiSettings.menuTintColor = palette.menuTintColor;
  if (palette.menuAccentColor) uiSettings.menuAccentColor = palette.menuAccentColor;
  if (palette.menuLabelColor) uiSettings.menuLabelColor = palette.menuLabelColor;
  if (typeof palette.menuGlassOpacity === 'number') uiSettings.menuGlassOpacity = palette.menuGlassOpacity;
  if (typeof palette.menuTintOpacity === 'number') uiSettings.menuTintOpacity = palette.menuTintOpacity;
  if (typeof palette.menuBorderOpacity === 'number') uiSettings.menuBorderOpacity = palette.menuBorderOpacity;
  if (typeof palette.menuShadowOpacity === 'number') uiSettings.menuShadowOpacity = palette.menuShadowOpacity;
  if (typeof palette.menuGlowOpacity === 'number') uiSettings.menuGlowOpacity = palette.menuGlowOpacity;
  
  if (palette.arrowBaseColor) uiSettings.arrowBaseColor = palette.arrowBaseColor;
  if (palette.arrowTintColor) uiSettings.arrowTintColor = palette.arrowTintColor;
  if (palette.arrowAccentColor) uiSettings.arrowAccentColor = palette.arrowAccentColor;
  if (palette.arrowColor) uiSettings.arrowColor = palette.arrowColor;
  if (typeof palette.arrowGlassOpacity === 'number') uiSettings.arrowGlassOpacity = palette.arrowGlassOpacity;
  if (typeof palette.arrowTintOpacity === 'number') uiSettings.arrowTintOpacity = palette.arrowTintOpacity;
  if (typeof palette.arrowBorderOpacity === 'number') uiSettings.arrowBorderOpacity = palette.arrowBorderOpacity;
  if (typeof palette.arrowShadowOpacity === 'number') uiSettings.arrowShadowOpacity = palette.arrowShadowOpacity;
  if (typeof palette.arrowGlowOpacity === 'number') uiSettings.arrowGlowOpacity = palette.arrowGlowOpacity;

  applyUiSettings();
  if (window.orbitColorsGui) window.orbitColorsGui.updateDisplay();
};

const initOrbitColorsGui = () => {
  if (!orbitColorsGuiContainer) return;
  
  const orbitColorsGui = new window.lil.GUI({ container: orbitColorsGuiContainer, title: 'Orbit Menu Colors' });
  orbitColorsGui.domElement.style.width = '100%';
  window.orbitColorsGui = orbitColorsGui;

  // Style Mode Folder
  const modeFolder = orbitColorsGui.addFolder('⚡ Style Mode');
  modeFolder.add(uiSettings, 'flatColorMode')
    .name('Flat Colors')
    .onChange(applyUiSettings);
  modeFolder.add(uiSettings, 'menuOutlineThickness', 0, 30, 1)
    .name('Menu Outline')
    .onChange(applyUiSettings);
  modeFolder.addColor(uiSettings, 'menuOutlineColor')
    .name('Menu Outline Color')
    .onChange(applyUiSettings);
  modeFolder.add(uiSettings, 'arrowOutlineThickness', 0, 30, 1)
    .name('Arrow Outline')
    .onChange(applyUiSettings);
  modeFolder.addColor(uiSettings, 'arrowOutlineColor')
    .name('Arrow Outline Color')
    .onChange(applyUiSettings);
  modeFolder.open();

  // Menu Colors Folder
  const menuColorsFolder = orbitColorsGui.addFolder('🔮 Menu Box Colors');
  menuColorsFolder.addColor(uiSettings, 'menuBaseColor')
    .name('Base Color')
    .onChange(applyUiSettings);
  menuColorsFolder.addColor(uiSettings, 'menuTintColor')
    .name('Tint Color')
    .onChange(applyUiSettings);
  menuColorsFolder.addColor(uiSettings, 'menuAccentColor')
    .name('Accent Glow')
    .onChange(applyUiSettings);
  menuColorsFolder.addColor(uiSettings, 'menuLabelColor')
    .name('Label Color')
    .onChange(applyUiSettings);
  menuColorsFolder.open();

  // Menu Opacity Folder
  const menuOpacityFolder = orbitColorsGui.addFolder('📊 Menu Opacity');
  menuOpacityFolder.add(uiSettings, 'menuGlassOpacity', 0.1, 1, 0.02)
    .name('Glass')
    .onChange(applyUiSettings);
  menuOpacityFolder.add(uiSettings, 'menuTintOpacity', 0, 0.6, 0.02)
    .name('Tint')
    .onChange(applyUiSettings);
  menuOpacityFolder.add(uiSettings, 'menuBorderOpacity', 0, 0.6, 0.02)
    .name('Border')
    .onChange(applyUiSettings);
  menuOpacityFolder.add(uiSettings, 'menuShadowOpacity', 0, 0.8, 0.02)
    .name('Shadow')
    .onChange(applyUiSettings);
  menuOpacityFolder.add(uiSettings, 'menuGlowOpacity', 0, 0.6, 0.02)
    .name('Glow')
    .onChange(applyUiSettings);
  menuOpacityFolder.close();

  // Arrow Colors Folder
  const arrowColorsFolder = orbitColorsGui.addFolder('⬅️ Arrow Colors');
  arrowColorsFolder.addColor(uiSettings, 'arrowBaseColor')
    .name('Base Color')
    .onChange(applyUiSettings);
  arrowColorsFolder.addColor(uiSettings, 'arrowTintColor')
    .name('Tint Color')
    .onChange(applyUiSettings);
  arrowColorsFolder.addColor(uiSettings, 'arrowAccentColor')
    .name('Accent Glow')
    .onChange(applyUiSettings);
  arrowColorsFolder.addColor(uiSettings, 'arrowColor')
    .name('Arrow Symbol')
    .onChange(applyUiSettings);
  arrowColorsFolder.open();

  // Arrow Opacity Folder
  const arrowOpacityFolder = orbitColorsGui.addFolder('📊 Arrow Opacity');
  arrowOpacityFolder.add(uiSettings, 'arrowGlassOpacity', 0.1, 1, 0.02)
    .name('Glass')
    .onChange(applyUiSettings);
  arrowOpacityFolder.add(uiSettings, 'arrowTintOpacity', 0, 0.6, 0.02)
    .name('Tint')
    .onChange(applyUiSettings);
  arrowOpacityFolder.add(uiSettings, 'arrowBorderOpacity', 0, 0.6, 0.02)
    .name('Border')
    .onChange(applyUiSettings);
  arrowOpacityFolder.add(uiSettings, 'arrowShadowOpacity', 0, 0.8, 0.02)
    .name('Shadow')
    .onChange(applyUiSettings);
  arrowOpacityFolder.add(uiSettings, 'arrowGlowOpacity', 0, 0.6, 0.02)
    .name('Glow')
    .onChange(applyUiSettings);
  arrowOpacityFolder.close();
};

const initOrbitPalettePresets = () => {
  if (!orbitPaletteSelect) return;
  orbitPaletteStorage = loadOrbitPaletteStorage();
  ensureDefaultOrbitPalette(orbitPaletteStorage);
  renderOrbitPaletteOptions(orbitPaletteStorage);
  saveOrbitPaletteStorage(orbitPaletteStorage);

  orbitPaletteSelect.addEventListener('change', (event) => {
    applyOrbitPaletteById(event.target.value);
  });

  if (saveOrbitPaletteBtn) {
    saveOrbitPaletteBtn.addEventListener('click', () => {
      const name = window.prompt('Name this orbit palette:', `Orbit Palette ${orbitPaletteStorage.palettes.length + 1}`);
      if (!name) return;
      const entry = {
        id: `orbit-palette-${Date.now()}`,
        name: name.trim() || `Orbit Palette ${orbitPaletteStorage.palettes.length + 1}`,
        palette: buildOrbitPaletteFromCurrent(),
      };
      orbitPaletteStorage.palettes.push(entry);
      orbitPaletteStorage.selectedId = entry.id;
      saveOrbitPaletteStorage(orbitPaletteStorage);
      renderOrbitPaletteOptions(orbitPaletteStorage);
    });
  }

  if (deleteOrbitPaletteBtn) {
    deleteOrbitPaletteBtn.addEventListener('click', () => {
      if (!orbitPaletteStorage.selectedId) return;
      const toDelete = orbitPaletteStorage.selectedId;
      orbitPaletteStorage.palettes = orbitPaletteStorage.palettes.filter((item) => item.id !== toDelete);
      if (!orbitPaletteStorage.palettes.length) {
        ensureDefaultOrbitPalette(orbitPaletteStorage);
      }
      orbitPaletteStorage.selectedId = orbitPaletteStorage.palettes[0]?.id || null;
      saveOrbitPaletteStorage(orbitPaletteStorage);
      renderOrbitPaletteOptions(orbitPaletteStorage);
      if (orbitPaletteStorage.selectedId) {
        applyOrbitPaletteById(orbitPaletteStorage.selectedId, false);
      }
    });
  }
};

// Orbit Colors Panel Toggle
if (orbitColorsToggle && orbitColorsPanel) {
  orbitColorsToggle.addEventListener('click', () => {
    orbitColorsPanel.classList.toggle('active');
    orbitColorsPanel.setAttribute('aria-hidden', orbitColorsPanel.classList.contains('active') ? 'false' : 'true');
  });
}

if (orbitColorsClose && orbitColorsPanel) {
  orbitColorsClose.addEventListener('click', () => {
    orbitColorsPanel.classList.remove('active');
    orbitColorsPanel.setAttribute('aria-hidden', 'true');
  });
}

// Export orbit colors
if (orbitColorsExport) {
  orbitColorsExport.addEventListener('click', () => {
    const exportData = {
      orbitColors: buildOrbitPaletteFromCurrent(),
      timestamp: new Date().toISOString(),
    };
    const json = JSON.stringify(exportData, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      window.alert('Orbit colors copied to clipboard!');
    }).catch(() => {
      console.log('Export data:', json);
      window.alert('Check console for export data');
    });
  });
}

// Note: initOrbitColorsGui() and initOrbitPalettePresets() are called later after uiSettings is defined

initDesignPanel();
initPalettePresets();

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
modelControl = {
  posX: 0,
  posY: 0,
  posZ: 0,
  scale: 1,
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
modelFolder.add(modelControl, 'scale', 0.4, 2.5, 0.05).onChange((val) => {
  if (model) model.scale.setScalar(modelBaseScale * val);
}).name('Scale');
modelFolder.add({ resetTransform: () => {
  modelControl.posX = 0;
  modelControl.posY = 0;
  modelControl.posZ = 0;
  modelControl.scale = 1;
  if (model) {
    model.position.set(0, 0, 0);
    model.scale.setScalar(modelBaseScale);
    model.rotation.set(0, 0, 0);
  }
  mouseX = 0;
  mouseY = 0;
  targetMouseX = 0;
  targetMouseY = 0;
  modelFolder.updateDisplay();
}}, 'resetTransform').name('🔄 Reset Transform');

// Camera controls
const cameraFolder = gui.addFolder('Camera');
cameraFolder.add(camera.position, 'z', 0.5, 10, 0.5).onChange(() => {
  camera.updateProjectionMatrix();
}).name('Zoom (Z)');

// Material controls
const materialFolder = gui.addFolder('Material');
materialControl = {
  color: defaultToonMaterialSettings.color,
  shadowColor: defaultToonMaterialSettings.shadowColor,
  highlightColor: defaultToonMaterialSettings.highlightColor,
  emissiveColor: defaultToonMaterialSettings.emissiveColor,
  emissiveIntensity: defaultToonMaterialSettings.emissiveIntensity,
  shadeSteps: defaultToonMaterialSettings.shadeSteps,
  shadowStrength: defaultToonMaterialSettings.shadowStrength,
  highlightStrength: defaultToonMaterialSettings.highlightStrength,
  strictColors: defaultToonMaterialSettings.strictColors,
  outlineThickness: defaultToonMaterialSettings.outlineThickness,
  outlineColor: defaultToonMaterialSettings.outlineColor,
  outlineOpacity: defaultToonMaterialSettings.outlineOpacity,
  outlineTextureIntensity: defaultToonMaterialSettings.outlineTextureIntensity,
  outlineTextureScale: defaultToonMaterialSettings.outlineTextureScale,
  pencilIntensity: defaultToonMaterialSettings.pencilIntensity,
  pencilScale: defaultToonMaterialSettings.pencilScale,
  edgeEnabled: defaultToonMaterialSettings.edgeEnabled,
  edgeColor: defaultToonMaterialSettings.edgeColor,
  edgeOpacity: defaultToonMaterialSettings.edgeOpacity,
  edgeThreshold: defaultToonMaterialSettings.edgeThreshold,
  edgeDashSize: defaultToonMaterialSettings.edgeDashSize,
  edgeGapSize: defaultToonMaterialSettings.edgeGapSize,
  edgeJitter: defaultToonMaterialSettings.edgeJitter,
  edgeScale: defaultToonMaterialSettings.edgeScale,
};
materialFolder.addColor(materialControl, 'color').onChange(applyToonMaterialToModel).name('Base Color');
materialFolder.addColor(materialControl, 'shadowColor').onChange(applyToonMaterialToModel).name('Shadow Color');
materialFolder.addColor(materialControl, 'highlightColor').onChange(applyToonMaterialToModel).name('Highlight Color');
materialFolder.addColor(materialControl, 'emissiveColor').onChange(applyToonMaterialToModel).name('Emissive Color');
materialFolder.add(materialControl, 'emissiveIntensity', 0, 1.5, 0.05).onChange(applyToonMaterialToModel).name('Emissive Power');
materialFolder.add(materialControl, 'shadeSteps', 2, 6, 1).onChange(applyToonMaterialToModel).name('Shade Steps');
materialFolder.add(materialControl, 'shadowStrength', 0, 0.6, 0.02).onChange(applyToonMaterialToModel).name('Shadow Cutoff');
materialFolder.add(materialControl, 'highlightStrength', 0.4, 1, 0.02).onChange(applyToonMaterialToModel).name('Highlight Cutoff');
materialFolder.add(materialControl, 'strictColors').onChange(() => {
  applyStrictColorLighting();
  applyToonMaterialToModel();
}).name('Strict Colors');
materialFolder.add(materialControl, 'outlineThickness', 0.01, 0.12, 0.005).onChange(applyToonMaterialToModel).name('Outline Thickness');
materialFolder.addColor(materialControl, 'outlineColor').onChange(applyToonMaterialToModel).name('Outline Color');
materialFolder.add(materialControl, 'outlineOpacity', 0.1, 1, 0.05).onChange(applyToonMaterialToModel).name('Outline Opacity');
materialFolder.add(materialControl, 'outlineTextureIntensity', 0, 0.8, 0.05).onChange(applyToonMaterialToModel).name('Outline Sketch');
materialFolder.add(materialControl, 'outlineTextureScale', 0.6, 3, 0.1).onChange(applyToonMaterialToModel).name('Outline Texture Scale');
materialFolder.add(materialControl, 'pencilIntensity', 0, 0.8, 0.05).onChange(applyToonMaterialToModel).name('Pencil Intensity');
materialFolder.add(materialControl, 'pencilScale', 0.6, 3, 0.1).onChange(applyToonMaterialToModel).name('Pencil Scale');
materialFolder.add(materialControl, 'edgeEnabled').onChange(applyToonMaterialToModel).name('Edge Lines');
materialFolder.addColor(materialControl, 'edgeColor').onChange(applyToonMaterialToModel).name('Edge Color');
materialFolder.add(materialControl, 'edgeOpacity', 0, 1, 0.05).onChange(applyToonMaterialToModel).name('Edge Opacity');
materialFolder.add(materialControl, 'edgeThreshold', 1, 60, 1).onChange(applyToonMaterialToModel).name('Edge Threshold');
materialFolder.add(materialControl, 'edgeDashSize', 0.5, 6, 0.1).onChange(applyToonMaterialToModel).name('Edge Dash');
materialFolder.add(materialControl, 'edgeGapSize', 0.5, 6, 0.1).onChange(applyToonMaterialToModel).name('Edge Gap');
materialFolder.add(materialControl, 'edgeJitter', 0, 0.01, 0.0005).onChange(applyToonMaterialToModel).name('Edge Jitter');
materialFolder.add(materialControl, 'edgeScale', 1, 1.01, 0.0005).onChange(applyToonMaterialToModel).name('Edge Scale');
materialFolder.add({ exportToon: () => {
  const exportPayload = getChangedSettings(defaultToonMaterialSettings, materialControl);
  console.log('=== TOON SETTINGS EXPORT ===');
  console.log(JSON.stringify(exportPayload, null, 2));
}}, 'exportToon').name('📋 Export Toon');

// Lighting controls
const lightFolder = gui.addFolder('Lighting');

const ambientControl = { intensity: 0.35, color: 0xffffff, visible: true };
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

const dir1Control = { intensity: 2.4, color: 0xffffff, x: -10, y: 5, z: 3, visible: true };
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

const dir2Control = { intensity: 0.6, color: 0xffcfb3, x: -5, y: -3, z: 5, visible: true };
lightFolder.add(dir2Control, 'intensity', 0, 2, 0.05).onChange((val) => {
  directionalLight2.intensity = val;
}).name('Dir Light 2 Intensity');
lightFolder.addColor(dir2Control, 'color').onChange((val) => {
  directionalLight2.color.setHex(val);
}).name('Dir Light 2 Color');
lightFolder.add(dir2Control, 'visible').onChange((val) => {
  directionalLight2.visible = val;
}).name('Dir Light 2 Visible');

const point1Control = { intensity: 0.25, color: 0xffbfa8, x: 2.5, y: 1.5, z: 2, visible: true };
lightFolder.add(point1Control, 'intensity', 0, 2, 0.05).onChange((val) => {
  point1.intensity = val;
}).name('Point Light 1 Intensity');
lightFolder.add(point1Control, 'visible').onChange((val) => {
  point1.visible = val;
}).name('Point Light 1 Visible');

const point2Control = { intensity: 0.2, color: 0x7fd3ff, x: -2.5, y: 1, z: 3, visible: true };
lightFolder.add(point2Control, 'intensity', 0, 2, 0.05).onChange((val) => {
  point2.intensity = val;
}).name('Point Light 2 Intensity');
lightFolder.add(point2Control, 'visible').onChange((val) => {
  point2.visible = val;
}).name('Point Light 2 Visible');

const point3Control = { intensity: 0.2, color: 0xffffff, x: 0, y: -3, z: 5, visible: true };
lightFolder.add(point3Control, 'intensity', 0, 2, 0.05).onChange((val) => {
  point3.intensity = val;
}).name('Point Light 3 Intensity');
lightFolder.add(point3Control, 'visible').onChange((val) => {
  point3.visible = val;
}).name('Point Light 3 Visible');

// Background & Rendering
const renderFolder = gui.addFolder('Rendering');
const renderControl = { bgColor: 0x1c1a1c, exposure: 1.1, useSolidBg: false };
renderFolder.add(renderControl, 'useSolidBg').onChange(() => {
  applyBackgroundSetting();
}).name('Solid Background');
renderFolder.addColor(renderControl, 'bgColor').onChange(() => {
  applyBackgroundSetting();
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
if (paletteStorage && paletteStorage.selectedId) {
  applyPaletteById(paletteStorage.selectedId, false);
}
if (pendingPaletteId) {
  applyPaletteById(pendingPaletteId, false);
  pendingPaletteId = null;
}
if (uiPaletteSyncEnabled) {
  applyUiPaletteSync(getActivePalette());
}
if (orbitPaletteSyncEnabled) {
  applyOrbitPaletteSync(getActivePalette());
}

// Collapse all folders for compact sidebar appearance (user can expand as needed)
cameraFolder.close();
materialFolder.close();
lightFolder.close();
renderFolder.close();
envFolder.close();
hitboxFolder.close();
buttonFolder.close();
settingsFolder.close();

// Click twinkle effect
document.addEventListener('click', (event) => {
  // Create twinkle element
  const twinkle = document.createElement('div');
  twinkle.className = 'cursor-twinkle';
  twinkle.style.display = 'block';
  document.body.appendChild(twinkle);

  // Position at click location
  twinkle.style.left = (event.clientX - 25) + 'px';
  twinkle.style.top = (event.clientY - 25) + 'px';

  // Remove twinkle after animation completes
  setTimeout(() => {
    twinkle.remove();
  }, 600);
});

/* ============================================
ORBITAL MENU CONTROLS
============================================ */

// Get elements
const boxSettingsPanel = document.getElementById('boxSettingsPanel');
const settingsClose = document.getElementById('settingsClose');
const boxSettingsToggle = document.getElementById('boxSettingsToggle');
const settingsExport = document.getElementById('settingsExport');
const boxesContainer = document.getElementById('boxesContainer');
const orbitControls = document.getElementById('orbitControls');
const orbitPrev = document.getElementById('orbitPrev');
const orbitNext = document.getElementById('orbitNext');
const orbitIndicators = document.getElementById('orbitIndicators');
const contactBox = document.getElementById('boxTopRight');
const contactDropdown = document.getElementById('contactDropdown');
const customizeTabs = document.querySelectorAll('.customize-tab');
const customizePanes = document.querySelectorAll('.customize-pane');
const fontSwitcherPanel = document.getElementById('fontSwitcherPanel');
const fontSwitcherToggle = document.getElementById('fontSwitcherToggle');
const fontSwitcherClose = document.getElementById('fontSwitcherClose');
const fontSwitcherSelect = document.getElementById('fontSwitcherSelect');
const fontSwitcherList = document.getElementById('fontSwitcherList');
const fontSwitcherPreview = document.getElementById('fontSwitcherPreview');
const modelTunerPanel = document.getElementById('modelTunerPanel');
const modelTunerToggle = document.getElementById('modelTunerToggle');
const modelTunerClose = document.getElementById('modelTunerClose');
const modelTunerGui = document.getElementById('modelTunerGui');
const modelTunerExport = document.getElementById('modelTunerExport');

const menuFonts = [
  {
    label: 'Zen Dots',
    value: "'Zen Dots', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  {
    label: 'Akira Expanded',
    value: "'Akira Expanded Demo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  {
    label: 'Mont Heavy',
    value: "'Mont Heavy Demo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  {
    label: 'Mont ExtraLight',
    value: "'Mont ExtraLight Demo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  }
];

const applyMenuFontSelection = (fontValue) => {
  uiSettings.menuLabelFont = fontValue;
  applyUiSettings();

  if (fontSwitcherPreview) {
    fontSwitcherPreview.style.fontFamily = fontValue;
  }

  if (fontSwitcherSelect) {
    fontSwitcherSelect.value = fontValue;
  }

  if (fontSwitcherList) {
    const items = fontSwitcherList.querySelectorAll('[data-font-value]');
    items.forEach(item => {
      item.classList.toggle('active', item.dataset.fontValue === fontValue);
    });
  }
};

// Global orbital settings
const defaultOrbitalSettings = {
  // Trajectory
  trajectoryHorizontal: 15,
  trajectoryVertical: 30,
  sideBoxScale: 0.6,
  // Effects
  sideBoxOpacity: 0.6,
  animationSpeed: 700,
  direction: 'forward',
  enableSideOpacity: true,
  enableExitAnimation: false,
  enablePageLoadAnimation: false,
  // Positioning
  positionCenterX: 50,
  positionCenterY: 75,
  sideOffset: 110,
  // Page Load Animation
  pageLoadDuration: 300,
  pageLoadStagger1: 0,
  pageLoadStagger2: 0,
  pageLoadStagger3: 0,
  pageLoadStagger4: 0,
  // Exit Animation
  exitOffsetX: 0,
  exitOffsetY: 90,
  exitScale: 85,
  leftOffset: -250,
  rightOffset: 0
};

let orbitalSettings = { ...defaultOrbitalSettings };

const orbitalSettingsVersion = 3;

// Load saved orbital settings
const savedOrbitalSettings = localStorage.getItem('orbitalSettings');
if (savedOrbitalSettings) {
  try {
    const parsed = JSON.parse(savedOrbitalSettings);
    if (parsed && parsed.version === orbitalSettingsVersion && parsed.settings) {
      Object.assign(orbitalSettings, parsed.settings);
    } else {
      localStorage.setItem('orbitalSettings', JSON.stringify({
        version: orbitalSettingsVersion,
        settings: orbitalSettings
      }));
    }
  } catch (err) {
    localStorage.setItem('orbitalSettings', JSON.stringify({
      version: orbitalSettingsVersion,
      settings: orbitalSettings
    }));
  }
}

if (typeof orbitalSettings.sideOffset !== 'number') {
  const legacyLeft = Number(orbitalSettings.leftOffset) || 0;
  const legacyRight = Number(orbitalSettings.rightOffset) || 0;
  orbitalSettings.sideOffset = Math.round((legacyLeft + legacyRight) / 2);
}

orbitalSettings.sideOffset = 110;

const applyOrbitalSettings = () => {
  // Update CSS variables
  const root = document.documentElement.style;
  
  // Trajectory
  root.setProperty('--orbital-trajectory-h', orbitalSettings.trajectoryHorizontal + '%');
  root.setProperty('--orbital-trajectory-v', orbitalSettings.trajectoryVertical + '%');
  root.setProperty('--orbital-side-scale', orbitalSettings.sideBoxScale);
  
  // Effects
  const resolvedSideOpacity = orbitalSettings.enableSideOpacity ? orbitalSettings.sideBoxOpacity : 1;
  root.setProperty('--orbital-side-opacity', resolvedSideOpacity);
  root.setProperty('--orbital-animation-speed', orbitalSettings.animationSpeed + 'ms');
  root.setProperty('--orbital-fade-speed', orbitalSettings.animationSpeed + 'ms');
  
  // Positioning
  root.setProperty('--orbital-center-x', orbitalSettings.positionCenterX + '%');
  root.setProperty('--orbital-center-y', orbitalSettings.positionCenterY + '%');
  root.setProperty('--orbital-side-offset', orbitalSettings.sideOffset + 'px');
  
  // Page Load Animation
  const resolvedPageLoadDuration = orbitalSettings.enablePageLoadAnimation ? orbitalSettings.pageLoadDuration : 0;
  const resolvedStagger = orbitalSettings.enablePageLoadAnimation ? {
    s1: orbitalSettings.pageLoadStagger1,
    s2: orbitalSettings.pageLoadStagger2,
    s3: orbitalSettings.pageLoadStagger3,
    s4: orbitalSettings.pageLoadStagger4
  } : { s1: 0, s2: 0, s3: 0, s4: 0 };
  root.setProperty('--page-load-duration', resolvedPageLoadDuration + 'ms');
  root.setProperty('--page-load-stagger-1', resolvedStagger.s1 + 'ms');
  root.setProperty('--page-load-stagger-2', resolvedStagger.s2 + 'ms');
  root.setProperty('--page-load-stagger-3', resolvedStagger.s3 + 'ms');
  root.setProperty('--page-load-stagger-4', resolvedStagger.s4 + 'ms');
  
  // Exit Animation
  root.setProperty('--exit-offset-x', orbitalSettings.exitOffsetX + 'px');
  root.setProperty('--exit-offset-y', orbitalSettings.exitOffsetY + 'px');
  root.setProperty('--exit-scale', orbitalSettings.exitScale / 100);

  if (boxesContainer) {
    const boxes = boxesContainer.querySelectorAll('.corner-box');
    boxes.forEach(box => {
      box.style.setProperty('--orbital-side-opacity', orbitalSettings.sideBoxOpacity, 'important');
    });
  }

  // Save settings
  localStorage.setItem('orbitalSettings', JSON.stringify({
    version: orbitalSettingsVersion,
    settings: orbitalSettings
  }));
};

// UI aesthetics settings
const defaultUiSettings = {
  flatColorMode: false,
  menuOutlineThickness: 1,
  menuOutlineColor: '#ffffff',
  arrowOutlineThickness: 1,
  arrowOutlineColor: '#ffffff',
  menuSize: 250,
  menuRadius: 999,
  menuBlur: 8,
  menuSaturate: 185,
  menuGlassOpacity: 0.46,
  menuTintOpacity: 0.5,
  menuBorderOpacity: 0.24,
  menuShadowOpacity: 0.52,
  menuGlowOpacity: 0.22,
  menuBlobOpacity: 0.9,
  menuBlobBlur: 29,
  menuBaseColor: '#d6d6d6',
  menuTintColor: '#ffffff',
  menuAccentColor: '#ffffff',
  menuLabelColor: '#dddada',
  menuLabelFont: "'Mont ExtraLight Demo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  menuLabelSize: 1.4,
  menuLabelWeight: 700,
  menuLabelSpacing: 2,
  menuLabelUppercase: false,
  showMenuBorder: true,
  showMenuGlow: false,
  showMenuBlob: true,
  showOrbitControls: true,
  arrowSize: 56,
  arrowWidth: 96,
  arrowHeight: 34,
  arrowRadius: 999,
  arrowBlur: 18,
  arrowSaturate: 90,
  arrowFontSize: 1.1,
  arrowBorderOpacity: 0.2,
  arrowGlassOpacity: 0.44,
  arrowTintOpacity: 0.5,
  arrowShadowOpacity: 0.4,
  arrowGlowOpacity: 0.2,
  arrowBaseColor: '#d6d6d6',
  arrowTintColor: '#ffffff',
  arrowAccentColor: '#ffffff',
  arrowColor: '#e3e3e3',
  showArrowBorder: true,
  showArrowGlow: false,
  arrowRound: true,
  arrowHeightAdjusted: true,
  orbitControlsBottom: 16,
  orbitControlsLeft: 50,
  orbitControlsGap: 54,
  showOrbitIndicators: true,
  indicatorSize: 8,
  indicatorGap: 10,
  indicatorOffset: 16,
  indicatorGlow: 0.5,
  indicatorActiveScale: 1.4
};

let uiSettings = { ...defaultUiSettings };

const uiSettingsVersion = 3;

const savedUiSettings = localStorage.getItem('uiSettings');
if (savedUiSettings) {
  try {
    const parsed = JSON.parse(savedUiSettings);
    if (parsed && parsed.version === uiSettingsVersion && parsed.settings) {
      Object.assign(uiSettings, parsed.settings);
    } else {
      localStorage.setItem('uiSettings', JSON.stringify({
        version: uiSettingsVersion,
        settings: uiSettings
      }));
    }
  } catch (err) {
    localStorage.setItem('uiSettings', JSON.stringify({
      version: uiSettingsVersion,
      settings: uiSettings
    }));
  }
}

if (typeof uiSettings.arrowWidth !== 'number') {
  uiSettings.arrowWidth = uiSettings.arrowSize || 64;
}

if (typeof uiSettings.arrowHeight !== 'number') {
  uiSettings.arrowHeight = uiSettings.arrowSize || 64;
}

if (!uiSettings.menuLabelFont) {
  uiSettings.menuLabelFont = "'Mont ExtraLight Demo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
}

if (!uiSettings.arrowHeightAdjusted) {
  const currentHeight = typeof uiSettings.arrowHeight === 'number' ? uiSettings.arrowHeight : (uiSettings.arrowSize || 56);
  uiSettings.arrowHeight = Math.round(currentHeight * 0.6);
  uiSettings.arrowHeightAdjusted = true;
}

// Migrate new flat mode and outline settings
if (typeof uiSettings.flatColorMode !== 'boolean') {
  uiSettings.flatColorMode = false;
}
if (typeof uiSettings.menuOutlineThickness !== 'number') {
  uiSettings.menuOutlineThickness = 1;
}
if (!uiSettings.menuOutlineColor) {
  uiSettings.menuOutlineColor = '#ffffff';
}
if (typeof uiSettings.arrowOutlineThickness !== 'number') {
  uiSettings.arrowOutlineThickness = 1;
}
if (!uiSettings.arrowOutlineColor) {
  uiSettings.arrowOutlineColor = '#ffffff';
}

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const colorToRgba = (color, alpha) => {
  const trimmed = String(color || '').trim();
  const alphaClamped = clamp01(alpha);

  if (trimmed.startsWith('rgba(') || trimmed.startsWith('rgb(')) {
    const match = trimmed.match(/rgba?\(([^)]+)\)/i);
    if (!match) return trimmed;
    const parts = match[1].split(',').map(value => value.trim());
    const [r, g, b] = parts;
    if (!r || !g || !b) return trimmed;
    return `rgba(${r}, ${g}, ${b}, ${alphaClamped})`;
  }

  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alphaClamped})`;
    }
  }

  return trimmed;
};

const buildGlassBackground = (tintColor, tintAlpha, baseColor, baseAlpha) => (
  `linear-gradient(135deg, ${colorToRgba(tintColor, clamp01(tintAlpha))} 0%, ${colorToRgba(tintColor, clamp01(tintAlpha * 0.35))} 55%, ${colorToRgba(tintColor, clamp01(tintAlpha * 0.15))} 100%), ${colorToRgba(baseColor, clamp01(baseAlpha))}`
);

const buildGlassShadow = (shadowOpacity, glowOpacity, accentColor) => (
  `inset 0 1px 0 ${colorToRgba('#ffffff', 0.2)}, inset 0 -10px 24px ${colorToRgba('#000000', 0.2)}, 0 14px 36px ${colorToRgba('#000000', clamp01(shadowOpacity))}, 0 0 22px ${colorToRgba(accentColor, clamp01(glowOpacity))}`
);

const buildGlassShadowHover = (shadowOpacity, glowOpacity, accentColor) => (
  `inset 0 1px 0 ${colorToRgba('#ffffff', 0.26)}, inset 0 -10px 26px ${colorToRgba('#000000', 0.2)}, 0 18px 40px ${colorToRgba('#000000', clamp01(shadowOpacity))}, 0 0 26px ${colorToRgba(accentColor, clamp01(glowOpacity))}`
);

const applyUiSettings = () => {
  const root = document.documentElement.style;
  const isFlat = uiSettings.flatColorMode;

  root.setProperty('--orbit-box-size', `${uiSettings.menuSize}px`);
  root.setProperty('--menu-radius', `${uiSettings.menuRadius}px`);
  root.setProperty('--menu-blur', isFlat ? '0px' : `${uiSettings.menuBlur}px`);
  root.setProperty('--menu-saturate', isFlat ? '100%' : `${uiSettings.menuSaturate}%`);
  root.setProperty('--menu-label-color', uiSettings.menuLabelColor);
  root.setProperty('--menu-label-font', uiSettings.menuLabelFont);
  root.setProperty('--menu-label-size', `${uiSettings.menuLabelSize}rem`);
  root.setProperty('--menu-label-weight', uiSettings.menuLabelWeight);
  root.setProperty('--menu-label-spacing', `${uiSettings.menuLabelSpacing}px`);
  root.setProperty('--menu-label-transform', uiSettings.menuLabelUppercase ? 'uppercase' : 'none');

  const menuBorderAlpha = uiSettings.showMenuBorder ? uiSettings.menuBorderOpacity : 0;
  const menuGlowAlpha = uiSettings.showMenuGlow ? uiSettings.menuGlowOpacity : 0;
  const menuOutline = uiSettings.menuOutlineThickness || 1;
  const menuOutlineColor = uiSettings.menuOutlineColor || '#ffffff';

  if (isFlat) {
    root.setProperty('--menu-bg', uiSettings.menuBaseColor);
    root.setProperty('--menu-bg-hover', uiSettings.menuBaseColor);
    root.setProperty('--menu-border', `${menuOutline}px solid ${menuOutlineColor}`);
    root.setProperty('--menu-shadow', 'none');
    root.setProperty('--menu-shadow-hover', 'none');
  } else {
    root.setProperty('--menu-bg', buildGlassBackground(uiSettings.menuTintColor, uiSettings.menuTintOpacity, uiSettings.menuBaseColor, uiSettings.menuGlassOpacity));
    root.setProperty('--menu-bg-hover', buildGlassBackground(uiSettings.menuTintColor, uiSettings.menuTintOpacity + 0.04, uiSettings.menuBaseColor, uiSettings.menuGlassOpacity + 0.05));
    root.setProperty('--menu-border', `${menuOutline}px solid ${colorToRgba(menuOutlineColor, menuBorderAlpha)}`);
    root.setProperty('--menu-shadow', buildGlassShadow(uiSettings.menuShadowOpacity, menuGlowAlpha, uiSettings.menuAccentColor));
    root.setProperty('--menu-shadow-hover', buildGlassShadowHover(uiSettings.menuShadowOpacity + 0.05, menuGlowAlpha + 0.04, uiSettings.menuAccentColor));
  }
  root.setProperty('--menu-blob-opacity', isFlat ? 0 : (uiSettings.showMenuBlob ? uiSettings.menuBlobOpacity : 0));
  root.setProperty('--menu-blob-blur', `${uiSettings.menuBlobBlur}px`);

  root.setProperty('--orbit-controls-bottom', `${uiSettings.orbitControlsBottom}px`);
  root.setProperty('--orbit-controls-left', `${uiSettings.orbitControlsLeft}%`);
  root.setProperty('--orbit-controls-gap', `${uiSettings.orbitControlsGap}px`);
  root.setProperty('--orbit-indicator-size', `${uiSettings.indicatorSize}px`);
  root.setProperty('--orbit-indicator-gap', `${uiSettings.indicatorGap}px`);
  root.setProperty('--orbit-indicator-offset', `${uiSettings.indicatorOffset}px`);
  root.setProperty('--orbit-indicator-glow', `${uiSettings.indicatorGlow}`);
  root.setProperty('--orbit-indicator-active-scale', `${uiSettings.indicatorActiveScale}`);
  const resolvedArrowWidth = uiSettings.arrowWidth || uiSettings.arrowSize;
  const resolvedArrowHeight = uiSettings.arrowHeight || uiSettings.arrowSize;
  root.setProperty('--orbit-arrow-width', `${resolvedArrowWidth}px`);
  root.setProperty('--orbit-arrow-height', `${resolvedArrowHeight}px`);
  const resolvedArrowRadius = uiSettings.arrowRound ? Math.min(resolvedArrowWidth, resolvedArrowHeight) / 2 : uiSettings.arrowRadius;
  root.setProperty('--orbit-arrow-radius', `${resolvedArrowRadius}px`);
  root.setProperty('--orbit-arrow-font', `${uiSettings.arrowFontSize}rem`);
  root.setProperty('--orbit-arrow-color', uiSettings.arrowColor);
  root.setProperty('--orbit-arrow-blur', isFlat ? '0px' : `${uiSettings.arrowBlur}px`);
  root.setProperty('--orbit-arrow-saturate', isFlat ? '100%' : `${uiSettings.arrowSaturate}%`);

  const arrowBorderAlpha = uiSettings.showArrowBorder ? uiSettings.arrowBorderOpacity : 0;
  const arrowGlowAlpha = uiSettings.showArrowGlow ? uiSettings.arrowGlowOpacity : 0;
  const arrowOutline = uiSettings.arrowOutlineThickness || 1;
  const arrowOutlineColor = uiSettings.arrowOutlineColor || '#ffffff';

  if (isFlat) {
    root.setProperty('--orbit-arrow-bg', uiSettings.arrowBaseColor);
    root.setProperty('--orbit-arrow-bg-hover', uiSettings.arrowBaseColor);
    root.setProperty('--orbit-arrow-border', `${arrowOutline}px solid ${arrowOutlineColor}`);
    root.setProperty('--orbit-arrow-border-hover', `${arrowOutline}px solid ${arrowOutlineColor}`);
    root.setProperty('--orbit-arrow-shadow', 'none');
    root.setProperty('--orbit-arrow-shadow-hover', 'none');
  } else {
    root.setProperty('--orbit-arrow-bg', buildGlassBackground(uiSettings.arrowTintColor, uiSettings.arrowTintOpacity, uiSettings.arrowBaseColor, uiSettings.arrowGlassOpacity));
    root.setProperty('--orbit-arrow-bg-hover', buildGlassBackground(uiSettings.arrowTintColor, uiSettings.arrowTintOpacity + 0.04, uiSettings.arrowBaseColor, uiSettings.arrowGlassOpacity + 0.05));
    root.setProperty('--orbit-arrow-border', `${arrowOutline}px solid ${colorToRgba(arrowOutlineColor, arrowBorderAlpha)}`);
    root.setProperty('--orbit-arrow-border-hover', `${arrowOutline}px solid ${colorToRgba(arrowOutlineColor, arrowBorderAlpha + 0.06)}`);
    root.setProperty('--orbit-arrow-shadow', buildGlassShadow(uiSettings.arrowShadowOpacity, arrowGlowAlpha, uiSettings.arrowAccentColor));
    root.setProperty('--orbit-arrow-shadow-hover', buildGlassShadowHover(uiSettings.arrowShadowOpacity + 0.05, arrowGlowAlpha + 0.04, uiSettings.arrowAccentColor));
  }

  document.body.classList.toggle('orbit-controls-hidden', !uiSettings.showOrbitControls);
  document.body.classList.toggle('orbit-flat-mode', isFlat);

  if (orbitIndicators) {
    orbitIndicators.classList.toggle('hidden', !uiSettings.showOrbitIndicators);
  }

  localStorage.setItem('uiSettings', JSON.stringify({
    version: uiSettingsVersion,
    settings: uiSettings
  }));
};

const updateOrbitScale = () => {
  const baseWidth = 1920;
  const baseHeight = 1080;
  const scale = Math.min(window.innerWidth / baseWidth, window.innerHeight / baseHeight, 1);
  const clamped = Math.max(0.6, Math.min(scale, 1));
  document.documentElement.style.setProperty('--orbit-scale', clamped.toFixed(3));
};

updateOrbitScale();
applyUiSettings();
window.addEventListener('resize', updateOrbitScale);

// Orbital GUI Configuration
const orbitalGuiContainer = document.getElementById('orbitalGuiContainer');
if (orbitalGuiContainer && boxesContainer) {
  const orbitalGui = new window.lil.GUI({ container: orbitalGuiContainer, title: 'Orbital Controls' });
  orbitalGui.domElement.style.width = '100%';

  // ===== TRAJECTORY SECTION =====
  const trajectoryFolder = orbitalGui.addFolder('🔄 Trajectory & Path');
  trajectoryFolder.add(orbitalSettings, 'trajectoryHorizontal', 10, 80, 5)
    .name('Horizontal Spread (%)')
    .onChange(applyOrbitalSettings);
  trajectoryFolder.add(orbitalSettings, 'trajectoryVertical', 5, 50, 5)
    .name('Vertical Spread (%)')
    .onChange(applyOrbitalSettings);
  trajectoryFolder.add(orbitalSettings, 'sideBoxScale', 0.3, 1, 0.05)
    .name('Side Box Scale')
    .onChange(applyOrbitalSettings);
  trajectoryFolder.open();

  // ===== EFFECTS SECTION =====
  const effectsFolder = orbitalGui.addFolder('✨ Effects & Motion');
  effectsFolder.add(orbitalSettings, 'sideBoxOpacity', 0, 1, 0.05)
    .name('Side Box Opacity')
    .onChange(applyOrbitalSettings);
  effectsFolder.add(orbitalSettings, 'animationSpeed', 200, 1000, 50)
    .name('Animation Speed (ms)')
    .onChange(applyOrbitalSettings);
  effectsFolder.add(orbitalSettings, 'enableSideOpacity')
    .name('Enable Side Fade')
    .onChange(applyOrbitalSettings);
  effectsFolder.add(orbitalSettings, 'direction', ['forward', 'backward'])
    .name('Direction')
    .onChange(() => {
      localStorage.setItem('orbitalSettings', JSON.stringify({
        version: orbitalSettingsVersion,
        settings: orbitalSettings
      }));
    });
  effectsFolder.open();

  // ===== POSITIONING SECTION =====
  const positioningFolder = orbitalGui.addFolder('📍 Positioning');
  positioningFolder.add(orbitalSettings, 'positionCenterX', 20, 80, 5)
    .name('Center X (%)')
    .onChange(applyOrbitalSettings);
  positioningFolder.add(orbitalSettings, 'positionCenterY', 20, 80, 5)
    .name('Center Y (%)')
    .onChange(applyOrbitalSettings);
  positioningFolder.add(orbitalSettings, 'sideOffset', -300, 300, 10)
    .name('Side Offset (px)')
    .onChange(applyOrbitalSettings);
  positioningFolder.open();

  // ===== PAGE LOAD ANIMATION SECTION =====
  const pageLoadFolder = orbitalGui.addFolder('🎬 Page Load Animation');
  pageLoadFolder.add(orbitalSettings, 'enablePageLoadAnimation')
    .name('Enable Page Load')
    .onChange(applyOrbitalSettings);
  pageLoadFolder.add(orbitalSettings, 'pageLoadDuration', 300, 2000, 50)
    .name('Duration (ms)')
    .onChange(applyOrbitalSettings);
  
  const staggerSubFolder = pageLoadFolder.addFolder('Stagger Delays');
  staggerSubFolder.add(orbitalSettings, 'pageLoadStagger1', 0, 1000, 50)
    .name('Box 1 Delay (ms)')
    .onChange(applyOrbitalSettings);
  staggerSubFolder.add(orbitalSettings, 'pageLoadStagger2', 0, 1000, 50)
    .name('Box 2 Delay (ms)')
    .onChange(applyOrbitalSettings);
  staggerSubFolder.add(orbitalSettings, 'pageLoadStagger3', 0, 1000, 50)
    .name('Box 3 Delay (ms)')
    .onChange(applyOrbitalSettings);
  staggerSubFolder.add(orbitalSettings, 'pageLoadStagger4', 0, 1000, 50)
    .name('Box 4 Delay (ms)')
    .onChange(applyOrbitalSettings);
  staggerSubFolder.close();

  const exitFolder = orbitalGui.addFolder('🚪 Exit Animation');
  exitFolder.add(orbitalSettings, 'enableExitAnimation')
    .name('Enable Exit')
    .onChange(applyOrbitalSettings);
  exitFolder.add(orbitalSettings, 'exitOffsetX', 0, 60, 2)
    .name('Offset X (px)')
    .onChange(applyOrbitalSettings);
  exitFolder.add(orbitalSettings, 'exitOffsetY', -40, 40, 2)
    .name('Offset Y (px)')
    .onChange(applyOrbitalSettings);
  exitFolder.add(orbitalSettings, 'exitScale', 60, 100, 1)
    .name('Scale (%)')
    .onChange(applyOrbitalSettings);
  exitFolder.open();
  pageLoadFolder.close();

  // ===== EXIT ANIMATION SECTION =====
  const exitAnimFolder = orbitalGui.addFolder('🚀 Exit Animation');
  exitAnimFolder.add(orbitalSettings, 'exitOffsetX', 0, 100, 5)
    .name('Horizontal Offset (px)')
    .onChange(applyOrbitalSettings);
  exitAnimFolder.add(orbitalSettings, 'exitOffsetY', 0, 100, 5)
    .name('Vertical Offset (px)')
    .onChange(applyOrbitalSettings);
  exitAnimFolder.add(orbitalSettings, 'exitScale', 50, 100, 5)
    .name('Exit Scale (%)')
    .onChange(applyOrbitalSettings);
  exitAnimFolder.close();

  const uiFolder = orbitalGui.addFolder('🎨 UI Aesthetics');

  const menuLayoutFolder = uiFolder.addFolder('Menu Layout');
  menuLayoutFolder.add(uiSettings, 'menuSize', 120, 320, 5)
    .name('Menu Size (px)')
    .onChange(applyUiSettings);
  menuLayoutFolder.add(uiSettings, 'menuRadius', 20, 999, 5)
    .name('Menu Radius (px)')
    .onChange(applyUiSettings);
  menuLayoutFolder.add(uiSettings, 'menuBlur', 0, 30, 1)
    .name('Menu Blur (px)')
    .onChange(applyUiSettings);
  menuLayoutFolder.add(uiSettings, 'menuSaturate', 80, 200, 5)
    .name('Menu Saturate (%)')
    .onChange(applyUiSettings);
  menuLayoutFolder.open();

  const menuTextFolder = uiFolder.addFolder('Menu Text');
  menuTextFolder.addColor(uiSettings, 'menuLabelColor')
    .name('Label Color')
    .onChange(applyUiSettings);
  menuTextFolder.add(uiSettings, 'menuLabelSize', 0.6, 1.6, 0.05)
    .name('Label Size (rem)')
    .onChange(applyUiSettings);
  menuTextFolder.add(uiSettings, 'menuLabelWeight', { Regular: 400, Medium: 500, Semibold: 600, Bold: 700 })
    .name('Label Weight')
    .onChange(applyUiSettings);
  menuTextFolder.add(uiSettings, 'menuLabelSpacing', 0, 4, 0.1)
    .name('Label Spacing (px)')
    .onChange(applyUiSettings);
  menuTextFolder.add(uiSettings, 'menuLabelUppercase')
    .name('Uppercase Labels')
    .onChange(applyUiSettings);

  const menuColorFolder = uiFolder.addFolder('Menu Colors');
  menuColorFolder.addColor(uiSettings, 'menuBaseColor')
    .name('Base Color')
    .onChange(applyUiSettings);
  menuColorFolder.addColor(uiSettings, 'menuTintColor')
    .name('Highlight Color')
    .onChange(applyUiSettings);
  menuColorFolder.addColor(uiSettings, 'menuAccentColor')
    .name('Accent Glow')
    .onChange(applyUiSettings);
  menuColorFolder.add(uiSettings, 'menuGlassOpacity', 0.2, 0.9, 0.02)
    .name('Glass Opacity')
    .onChange(applyUiSettings);
  menuColorFolder.add(uiSettings, 'menuTintOpacity', 0.05, 0.5, 0.01)
    .name('Highlight Opacity')
    .onChange(applyUiSettings);
  menuColorFolder.add(uiSettings, 'menuBorderOpacity', 0, 0.6, 0.02)
    .name('Border Opacity')
    .onChange(applyUiSettings);
  menuColorFolder.add(uiSettings, 'menuShadowOpacity', 0.1, 0.8, 0.02)
    .name('Shadow Opacity')
    .onChange(applyUiSettings);
  menuColorFolder.add(uiSettings, 'menuGlowOpacity', 0, 0.6, 0.02)
    .name('Glow Opacity')
    .onChange(applyUiSettings);

  const menuTogglesFolder = uiFolder.addFolder('Menu Toggles');
  menuTogglesFolder.add(uiSettings, 'showMenuBorder')
    .name('Show Border')
    .onChange(applyUiSettings);
  menuTogglesFolder.add(uiSettings, 'showMenuGlow')
    .name('Show Glow')
    .onChange(applyUiSettings);
  menuTogglesFolder.add(uiSettings, 'showMenuBlob')
    .name('Show Shadow Blob')
    .onChange(applyUiSettings);
  menuTogglesFolder.add(uiSettings, 'menuBlobOpacity', 0, 1, 0.05)
    .name('Blob Opacity')
    .onChange(applyUiSettings);
  menuTogglesFolder.add(uiSettings, 'menuBlobBlur', 0, 40, 1)
    .name('Blob Blur (px)')
    .onChange(applyUiSettings);

  const menuPositionFolder = uiFolder.addFolder('Menu Position');
  menuPositionFolder.add(orbitalSettings, 'positionCenterX', 20, 80, 5)
    .name('Center X (%)')
    .onChange(applyOrbitalSettings);
  menuPositionFolder.add(orbitalSettings, 'positionCenterY', 20, 80, 5)
    .name('Center Y (%)')
    .onChange(applyOrbitalSettings);

  const controlsFolder = uiFolder.addFolder('Bottom Arrows');
  controlsFolder.add(uiSettings, 'showOrbitControls')
    .name('Show Arrows')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'showOrbitIndicators')
    .name('Show Dots')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'orbitControlsBottom', 0, 120, 2)
    .name('Bottom Offset (px)')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'orbitControlsLeft', 30, 70, 1)
    .name('Horizontal (%)')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'orbitControlsGap', 8, 80, 2)
    .name('Arrow Gap (px)')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'indicatorOffset', 6, 40, 2)
    .name('Dots Offset (px)')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'indicatorSize', 4, 16, 1)
    .name('Dot Size (px)')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'indicatorGap', 6, 24, 1)
    .name('Dot Gap (px)')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'indicatorActiveScale', 1, 2.2, 0.05)
    .name('Dot Active Scale')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'indicatorGlow', 0, 1, 0.05)
    .name('Dot Glow')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'arrowWidth', 56, 140, 2)
    .name('Arrow Width (px)')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'arrowHeight', 36, 100, 2)
    .name('Arrow Height (px)')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'arrowRadius', 6, 30, 1)
    .name('Arrow Radius (px)')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'arrowRound')
    .name('Round Arrows')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'arrowFontSize', 1, 2, 0.05)
    .name('Arrow Font (rem)')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'arrowBlur', 0, 30, 1)
    .name('Arrow Blur (px)')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'arrowSaturate', 80, 200, 5)
    .name('Arrow Saturate (%)')
    .onChange(applyUiSettings);
  controlsFolder.addColor(uiSettings, 'arrowColor')
    .name('Arrow Text')
    .onChange(applyUiSettings);
  controlsFolder.addColor(uiSettings, 'arrowBaseColor')
    .name('Arrow Base')
    .onChange(applyUiSettings);
  controlsFolder.addColor(uiSettings, 'arrowTintColor')
    .name('Arrow Highlight')
    .onChange(applyUiSettings);
  controlsFolder.addColor(uiSettings, 'arrowAccentColor')
    .name('Arrow Accent')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'arrowGlassOpacity', 0.2, 0.9, 0.02)
    .name('Arrow Glass')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'arrowTintOpacity', 0.05, 0.5, 0.01)
    .name('Arrow Highlight Opacity')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'arrowBorderOpacity', 0, 0.6, 0.02)
    .name('Arrow Border')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'arrowShadowOpacity', 0.1, 0.9, 0.02)
    .name('Arrow Shadow')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'arrowGlowOpacity', 0, 0.6, 0.02)
    .name('Arrow Glow')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'showArrowBorder')
    .name('Show Border')
    .onChange(applyUiSettings);
  controlsFolder.add(uiSettings, 'showArrowGlow')
    .name('Show Glow')
    .onChange(applyUiSettings);

  // Apply initial settings
  applyOrbitalSettings();
  applyUiSettings();
}

// Initialize orbit colors GUI and presets (after uiSettings is defined)
initOrbitColorsGui();
initOrbitPalettePresets();

// Close button functionality
settingsClose.addEventListener('click', () => {
  boxSettingsPanel.classList.remove('active');
});

if (boxSettingsToggle) {
  boxSettingsToggle.addEventListener('click', () => {
    boxSettingsPanel.classList.toggle('active');
  });
}

// Initialize orbital layout automatically on page load
{
  // Initialize orbital layout for Home2
  const initializeOrbitalLayout = () => {
    if (!boxesContainer) return;

    document.body.classList.remove('orbit-ready');
    
    const boxOrder = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
    let currentOrbitIndex = 0;

    const renderOrbitIndicators = () => {
      if (!orbitIndicators) return;
      orbitIndicators.innerHTML = '';
      boxOrder.forEach((_, index) => {
        const dot = document.createElement('span');
        dot.className = 'orbit-dot';
        dot.dataset.index = String(index);
        orbitIndicators.appendChild(dot);
      });
    };

    const updateOrbitIndicators = () => {
      if (!orbitIndicators) return;
      const dots = orbitIndicators.querySelectorAll('.orbit-dot');
      dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentOrbitIndex);
      });
    };

    renderOrbitIndicators();

    const rotateSphereForOrbit = (exitSide) => {
      if (!exitSide) return;
      const direction = exitSide === 'left' ? -1 : 1;
      menuOrbitRotationTargetY += menuOrbitStepY * direction;
    };

    const updateOrbitPositions = (exitSide = null) => {
      const prevBoxBefore = boxesContainer.querySelector('.orbit-prev');
      const nextBoxBefore = boxesContainer.querySelector('.orbit-next');
      const activeBoxBefore = boxesContainer.querySelector('.orbit-active');
      const backBoxBefore = boxesContainer.querySelector('.orbit-back');

      // If there's an exit side, fade/shrink the side box moving to the back
      if (exitSide && orbitalSettings.enableExitAnimation) {
        const exitBox = exitSide === 'left' ? prevBoxBefore : nextBoxBefore;
        if (exitBox) {
          exitBox.classList.remove('orbit-prev', 'orbit-next', 'orbit-active');
          exitBox.classList.add(exitSide === 'left' ? 'orbit-exit-left' : 'orbit-exit-right');

          // Remove exit class after animation completes
          setTimeout(() => {
            exitBox.classList.remove('orbit-exit-left', 'orbit-exit-right');
          }, orbitalSettings.animationSpeed);
        }
      }

      const boxes = boxesContainer.querySelectorAll('.corner-box');
      boxes.forEach(box => {
        // Don't remove exit classes here - they'll be removed by setTimeout
        if (!box.classList.contains('orbit-exit-left') && !box.classList.contains('orbit-exit-right')) {
          box.classList.remove('orbit-prev', 'orbit-active', 'orbit-next', 'orbit-back', 'orbit-enter-left', 'orbit-enter-right', 'orbit-bounce-left', 'orbit-bounce-right', 'orbit-leave-left', 'orbit-leave-right', 'orbit-to-back', 'orbit-from-back');
        }
      });

      // Set positions for prev, active, next
      const prevIndex = (currentOrbitIndex - 1 + boxOrder.length) % boxOrder.length;
      const nextIndex = (currentOrbitIndex + 1) % boxOrder.length;

      const prevBox = boxesContainer.querySelector(`.${boxOrder[prevIndex]}`);
      const activeBox = boxesContainer.querySelector(`.${boxOrder[currentOrbitIndex]}`);
      const nextBox = boxesContainer.querySelector(`.${boxOrder[nextIndex]}`);
      const backIndex = (currentOrbitIndex + 2) % boxOrder.length;
      const backBox = boxesContainer.querySelector(`.${boxOrder[backIndex]}`);

      const animDuration = orbitalSettings.animationSpeed + 100;

      // Add position classes with animations for all panels
      if (prevBox) {
        prevBox.classList.add('orbit-prev');
        // If this box was the active one before (leaving front going left)
        if (exitSide && prevBox === activeBoxBefore) {
          prevBox.classList.add('orbit-leave-left');
          setTimeout(() => prevBox.classList.remove('orbit-leave-left'), animDuration);
        }
        // If this box was at back before (emerging from back)
        if (exitSide && prevBox === backBoxBefore) {
          prevBox.classList.add('orbit-from-back');
          setTimeout(() => prevBox.classList.remove('orbit-from-back'), animDuration);
        }
      }

      if (activeBox) {
        activeBox.classList.add('orbit-active');
        // Add bounce animation based on direction of entry
        if (exitSide) {
          const bounceClass = exitSide === 'left' ? 'orbit-bounce-right' : 'orbit-bounce-left';
          activeBox.classList.add(bounceClass);
          setTimeout(() => {
            activeBox.classList.remove('orbit-bounce-left', 'orbit-bounce-right');
          }, animDuration);
        }
      }

      if (nextBox) {
        nextBox.classList.add('orbit-next');
        // If this box was the active one before (leaving front going right)
        if (exitSide && nextBox === activeBoxBefore) {
          nextBox.classList.add('orbit-leave-right');
          setTimeout(() => nextBox.classList.remove('orbit-leave-right'), animDuration);
        }
        // If this box was at back before (emerging from back)
        if (exitSide && nextBox === backBoxBefore) {
          nextBox.classList.add('orbit-from-back');
          setTimeout(() => nextBox.classList.remove('orbit-from-back'), animDuration);
        }
      }

      if (backBox && !backBox.classList.contains('orbit-exit-left') && !backBox.classList.contains('orbit-exit-right')) {
        backBox.classList.add('orbit-back');
        // If was prev or next before (going to back)
        if (exitSide && (backBox === prevBoxBefore || backBox === nextBoxBefore)) {
          backBox.classList.add('orbit-to-back');
          setTimeout(() => backBox.classList.remove('orbit-to-back'), animDuration);
        }
      }

      updateOrbitIndicators();

      const enterSide = exitSide ? (exitSide === 'left' ? 'right' : 'left') : null;
      if (enterSide && orbitalSettings.enableExitAnimation) {
        const enterBox = enterSide === 'right' ? nextBox : prevBox;
        // Check if enterBox was the back box before (emerging from back)
        if (enterBox && enterBox === backBoxBefore) {
          const enterClass = enterSide === 'right' ? 'orbit-enter-right' : 'orbit-enter-left';
          enterBox.classList.add(enterClass);
          setTimeout(() => {
            enterBox.classList.remove(enterClass);
          }, orbitalSettings.animationSpeed);
        }
      }
    };

    const navigatePrev = () => {
      const exitSide = orbitalSettings.direction === 'forward' ? 'right' : 'left';

      if (orbitalSettings.direction === 'forward') {
        currentOrbitIndex = (currentOrbitIndex - 1 + boxOrder.length) % boxOrder.length;
      } else {
        currentOrbitIndex = (currentOrbitIndex + 1) % boxOrder.length;
      }
      rotateSphereForOrbit(exitSide);
      updateOrbitPositions(exitSide);
    };

    const navigateNext = () => {
      const exitSide = orbitalSettings.direction === 'forward' ? 'left' : 'right';

      if (orbitalSettings.direction === 'forward') {
        currentOrbitIndex = (currentOrbitIndex + 1) % boxOrder.length;
      } else {
        currentOrbitIndex = (currentOrbitIndex - 1 + boxOrder.length) % boxOrder.length;
      }
      rotateSphereForOrbit(exitSide);
      updateOrbitPositions(exitSide);
    };

    // Initial state
    updateOrbitPositions();

    requestAnimationFrame(() => {
      document.body.classList.add('orbit-ready');
    });

    // Arrow button navigation
    if (orbitPrev && orbitNext) {
      orbitPrev.addEventListener('click', navigatePrev);
      orbitNext.addEventListener('click', navigateNext);
    }

    // Add click handlers to side boxes to bring them to center
    const addBoxClickHandlers = () => {
      const boxes = boxesContainer.querySelectorAll('.corner-box');
      boxes.forEach(box => {
        box.addEventListener('click', (e) => {
          // Only handle clicks on prev/next boxes, not active or links
          if (box.classList.contains('orbit-prev')) {
            e.preventDefault();
            navigatePrev();
          } else if (box.classList.contains('orbit-next')) {
            e.preventDefault();
            navigateNext();
          }
          // If orbit-active, allow normal link behavior
        });
      });
    };

    addBoxClickHandlers();

    if (isMobileDevice && boxesContainer) {
      let touchStartX = 0;
      let touchStartY = 0;
      const swipeThreshold = 40;

      boxesContainer.addEventListener('touchstart', (event) => {
        const touch = event.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
      }, { passive: true });

      boxesContainer.addEventListener('touchend', (event) => {
        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > swipeThreshold) {
          if (deltaX > 0) {
            navigatePrev();
          } else {
            navigateNext();
          }
        }
      }, { passive: true });
    }
  };

  document.body.classList.add('home2-active');
  initializeOrbitalLayout();
}

if (settingsExport) {
  settingsExport.addEventListener('click', () => {
    const exportPayload = {
      orbitalSettings: getChangedSettings(defaultOrbitalSettings, orbitalSettings),
      uiSettings: getChangedSettings(defaultUiSettings, uiSettings)
    };
    console.log('=== UI SETTINGS EXPORT ===');
    console.log(JSON.stringify(exportPayload, null, 2));
  });
}

if (fontSwitcherToggle && fontSwitcherPanel) {
  fontSwitcherToggle.addEventListener('click', () => {
    fontSwitcherPanel.classList.toggle('active');
    fontSwitcherPanel.setAttribute('aria-hidden', fontSwitcherPanel.classList.contains('active') ? 'false' : 'true');
  });
}

if (fontSwitcherClose && fontSwitcherPanel) {
  fontSwitcherClose.addEventListener('click', () => {
    fontSwitcherPanel.classList.remove('active');
    fontSwitcherPanel.setAttribute('aria-hidden', 'true');
  });
}

if (fontSwitcherSelect) {
  fontSwitcherSelect.innerHTML = '';
  menuFonts.forEach(font => {
    const option = document.createElement('option');
    option.value = font.value;
    option.textContent = font.label;
    fontSwitcherSelect.appendChild(option);
  });
  fontSwitcherSelect.addEventListener('change', (event) => {
    applyMenuFontSelection(event.target.value);
  });
}

if (modelTunerToggle && modelTunerPanel) {
  modelTunerToggle.addEventListener('click', () => {
    modelTunerPanel.classList.toggle('active');
    modelTunerPanel.setAttribute('aria-hidden', modelTunerPanel.classList.contains('active') ? 'false' : 'true');
  });
}

if (modelTunerClose && modelTunerPanel) {
  modelTunerClose.addEventListener('click', () => {
    modelTunerPanel.classList.remove('active');
    modelTunerPanel.setAttribute('aria-hidden', 'true');
  });
}

if (modelTunerGui && modelControl) {
  const tunerGui = new window.lil.GUI({ container: modelTunerGui, title: 'Model Placement' });
  tunerGui.domElement.style.width = '100%';
  tunerGui.add(modelControl, 'posX', -3, 3, 0.1).name('Position X').onChange((val) => {
    if (model) model.position.x = val;
  });
  tunerGui.add(modelControl, 'posY', -3, 3, 0.1).name('Position Y').onChange((val) => {
    if (model) model.position.y = val;
  });
  tunerGui.add(modelControl, 'posZ', -3, 3, 0.1).name('Position Z').onChange((val) => {
    if (model) model.position.z = val;
  });
  tunerGui.add(modelControl, 'scale', 0.4, 2.5, 0.05).name('Scale').onChange((val) => {
    if (model) model.scale.setScalar(modelBaseScale * val);
  });

  if (materialControl) {
    const toonFolder = tunerGui.addFolder('Render Style');
    toonFolder.addColor(materialControl, 'color').name('Base Color').onChange(applyToonMaterialToModel);
    toonFolder.addColor(materialControl, 'shadowColor').name('Shadow Color').onChange(applyToonMaterialToModel);
    toonFolder.addColor(materialControl, 'highlightColor').name('Highlight Color').onChange(applyToonMaterialToModel);
    toonFolder.addColor(materialControl, 'emissiveColor').name('Emissive Color').onChange(applyToonMaterialToModel);
    toonFolder.add(materialControl, 'emissiveIntensity', 0, 1.5, 0.05).name('Emissive Power').onChange(applyToonMaterialToModel);
    toonFolder.add(materialControl, 'shadeSteps', 2, 6, 1).name('Shade Steps').onChange(applyToonMaterialToModel);
    toonFolder.add(materialControl, 'shadowStrength', 0, 0.6, 0.02).name('Shadow Cutoff').onChange(applyToonMaterialToModel);
    toonFolder.add(materialControl, 'highlightStrength', 0.4, 1, 0.02).name('Highlight Cutoff').onChange(applyToonMaterialToModel);
    toonFolder.add(materialControl, 'strictColors').name('Strict Colors').onChange(() => {
      applyStrictColorLighting();
      applyToonMaterialToModel();
    });
    toonFolder.add(materialControl, 'outlineThickness', 0, 0.12, 0.005).name('Outline Thickness').onChange(applyToonMaterialToModel);
    toonFolder.addColor(materialControl, 'outlineColor').name('Outline Color').onChange(applyToonMaterialToModel);
    toonFolder.add(materialControl, 'pencilIntensity', 0, 0.8, 0.05).name('Pencil Intensity').onChange(applyToonMaterialToModel);
    toonFolder.add(materialControl, 'pencilScale', 0.6, 3, 0.1).name('Pencil Scale').onChange(applyToonMaterialToModel);
    toonFolder.add(materialControl, 'outlineTextureScale', 0.6, 3, 0.1).name('Outline Texture Scale').onChange(applyToonMaterialToModel);
    toonFolder.add(materialControl, 'edgeEnabled').name('Edge Lines').onChange(applyToonMaterialToModel);
    toonFolder.add(materialControl, 'edgeThreshold', 1, 60, 1).name('Edge Threshold').onChange(applyToonMaterialToModel);
    toonFolder.add(materialControl, 'edgeScale', 1, 1.01, 0.0005).name('Edge Scale').onChange(applyToonMaterialToModel);
    toonFolder.close();
  }

  if (renderControl) {
    const renderFolder = tunerGui.addFolder('Rendering');
    renderFolder.add(renderControl, 'exposure', 0, 2, 0.1).name('Exposure').onChange((val) => {
      renderer.toneMappingExposure = val;
    });
    renderFolder.add(renderControl, 'useSolidBg').name('Solid Background').onChange(() => {
      applyBackgroundSetting();
    });
    renderFolder.addColor(renderControl, 'bgColor').name('Background Color').onChange(() => {
      applyBackgroundSetting();
    });
    renderFolder.close();
  }
}

if (modelTunerExport) {
  modelTunerExport.addEventListener('click', () => {
    if (!modelControl) return;
    const exportPayload = {
      model: getChangedSettings(modelTunerDefaults, modelControl),
      toon: materialControl ? getChangedSettings(defaultToonMaterialSettings, materialControl) : {},
      rendering: renderControl ? getChangedSettings({
        exposure: presetSettings.rendering.exposure,
        bgColor: presetSettings.rendering.bgColor,
        useSolidBg: !!presetSettings.rendering.useSolidBg,
      }, renderControl) : {},
    };
    console.log('=== MODEL TUNER EXPORT ===');
    console.log(JSON.stringify(exportPayload, null, 2));
  });
}

if (fontSwitcherList) {
  fontSwitcherList.innerHTML = '';
  menuFonts.forEach(font => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'font-switcher-item';
    button.dataset.fontValue = font.value;
    button.textContent = font.label;
    button.addEventListener('click', () => {
      applyMenuFontSelection(font.value);
    });
    fontSwitcherList.appendChild(button);
  });
}

applyMenuFontSelection(uiSettings.menuLabelFont);

if (customizeTabs.length && customizePanes.length) {
  const setPane = (paneName) => {
    customizeTabs.forEach(tab => {
      const isActive = tab.dataset.pane === paneName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    customizePanes.forEach(pane => {
      pane.classList.toggle('active', pane.dataset.pane === paneName);
    });
  };

  customizeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      setPane(tab.dataset.pane);
    });
  });
}

if (contactBox && contactDropdown) {
  const setContactOpen = (isOpen) => {
    contactBox.classList.toggle('dropdown-open', isOpen);
    contactBox.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  contactBox.addEventListener('click', (event) => {
    if (event.target.closest('.contact-dropdown a')) return;
    event.preventDefault();
    setContactOpen(!contactBox.classList.contains('dropdown-open'));
  });

  contactBox.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setContactOpen(!contactBox.classList.contains('dropdown-open'));
    }
  });

  document.addEventListener('click', (event) => {
    if (!contactBox.contains(event.target)) {
      setContactOpen(false);
    }
  });
}

// Open settings panel (could be triggered by a button or interaction)
// For now, add a keyboard shortcut: Press 'B' to toggle box settings
document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'b' && boxSettingsPanel) {
    boxSettingsPanel.classList.toggle('active');
  }
});




