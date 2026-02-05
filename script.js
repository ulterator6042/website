const downloadButton = document.getElementById('downloadButton');
const sound = document.getElementById('sound');
const modelContainer = document.getElementById('modelContainer');

// Three.js Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, modelContainer.clientWidth / modelContainer.clientHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

renderer.setSize(modelContainer.clientWidth, modelContainer.clientHeight);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
modelContainer.appendChild(renderer.domElement);

// Better renderer settings for PBR and color
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

camera.position.z = 2;

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

// Try loading .glb first, then .gltf as fallback
const modelUrls = ['3d/abstract.glb', '3d/abstract/scene.gltf', '3d/3d_nodraco.glb', '3d/3d.glb', '3d/3d.gltf'];
let attempt = 0;
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
    
    const scale = maxDim === 0 ? 1 : 2 / maxDim;
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
    
    scene.add(model);
    clearTimeout(fallbackTimer);
    console.log('Model added to scene. Final position:', model.position);
    console.log('Model loaded successfully!', url, gltf);
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

tryLoadNext();

// Mouse tracking
let mouseX = 0;
let mouseY = 0;

document.addEventListener('mousemove', (event) => {
  mouseX = (event.clientX / window.innerWidth) * 2 - 1;
  mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  if (model) {
    // Rotate based on cursor position with adjustable sensitivity
    model.rotation.y = mouseX * Math.PI * mouseControl.rotationSpeedX;
    model.rotation.x = mouseY * Math.PI * 0.5 * mouseControl.rotationSpeedY;
  }
  
  renderer.render(scene, camera);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
  const width = modelContainer.clientWidth;
  const height = modelContainer.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});

// Download button - play sound
downloadButton.addEventListener('click', () => {
  sound.play();
});

// ============================================
// GUI CONTROLS FOR FINE-TUNING
// ============================================
const gui = new window.lil.GUI({ title: 'Model Settings' });

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

// Lighting controls
const lightFolder = gui.addFolder('Lighting');

const ambientControl = { intensity: 0.3, color: 0xe60f07 };
lightFolder.add(ambientControl, 'intensity', 0, 2, 0.05).onChange((val) => {
  ambientLight.intensity = val;
}).name('Ambient Intensity');
lightFolder.addColor(ambientControl, 'color').onChange((val) => {
  ambientLight.color.setHex(val);
}).name('Ambient Color');

const hemiControl = { intensity: 0.4, skyColor: 0xffffff, groundColor: 0x666666 };
lightFolder.add(hemiControl, 'intensity', 0, 2, 0.05).onChange((val) => {
  hemiLight.intensity = val;
}).name('Hemisphere Intensity');
lightFolder.addColor(hemiControl, 'skyColor').onChange((val) => {
  hemiLight.color.setHex(val);
}).name('Hemisphere Sky');
lightFolder.addColor(hemiControl, 'groundColor').onChange((val) => {
  hemiLight.groundColor.setHex(val);
}).name('Hemisphere Ground');

const dir1Control = { intensity: 1.15, color: 0xffffff, x: -10, y: 6, z: 5 };
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

const dir2Control = { intensity: 1.1, color: 0x8a45f6, x: -5, y: -3, z: 5 };
lightFolder.add(dir2Control, 'intensity', 0, 2, 0.05).onChange((val) => {
  directionalLight2.intensity = val;
}).name('Dir Light 2 Intensity');
lightFolder.addColor(dir2Control, 'color').onChange((val) => {
  directionalLight2.color.setHex(val);
}).name('Dir Light 2 Color');

const point1Control = { intensity: 0.6, color: 0xffbfa8, x: 2.5, y: 1.5, z: 2 };
lightFolder.add(point1Control, 'intensity', 0, 2, 0.05).onChange((val) => {
  point1.intensity = val;
}).name('Point Light 1 Intensity');

const point2Control = { intensity: 1.15, color: 0x8fb6ff, x: -2.5, y: 1, z: 3 };
lightFolder.add(point2Control, 'intensity', 0, 2, 0.05).onChange((val) => {
  point2.intensity = val;
}).name('Point Light 2 Intensity');

const point3Control = { intensity: 0.3, color: 0xffffff, x: 0, y: -3, z: 5 };
lightFolder.add(point3Control, 'intensity', 0, 2, 0.05).onChange((val) => {
  point3.intensity = val;
}).name('Point Light 3 Intensity');

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
const mouseControl = { rotationSpeedX: 1, rotationSpeedY: 0.5 };
mouseFolder.add(mouseControl, 'rotationSpeedX', 0, 3, 0.1).name('Rotation Speed X');
mouseFolder.add(mouseControl, 'rotationSpeedY', 0, 3, 0.1).name('Rotation Speed Y');

// Settings export/save
const settingsFolder = gui.addFolder('Settings');
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
  };
  console.log('=== CURRENT SETTINGS ===');
  console.log(JSON.stringify(settingsObj, null, 2));
  console.log('Save this to lock in your settings!');
}}, 'exportSettings').name('📋 Export to Console');


