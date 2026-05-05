import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";

const container = document.getElementById("extra-scene");

if (!container) {
  throw new Error("Missing #extra-scene div in extra.html");
}

let hoveredObject = null;
let selectedObject = null;

function isMobileView() {
  return window.innerWidth <= 768;
}

function getCameraZ() {
  return isMobileView() ? 10.5 : 8;
}

function updateResponsiveUI() {
  pageTitle.style.fontSize = isMobileView() ? "18px" : "32px";
  pageTitle.style.width = isMobileView() ? "90vw" : "auto";

if (infoPanel) {
  if (isMobileView()) {
    infoPanel.style.width = "52vw";
infoPanel.style.maxWidth = "320px";
    infoPanel.style.maxWidth = "88vw";
    infoPanel.style.left = "auto";
infoPanel.style.right = "12px";
infoPanel.style.transform = "none";
    infoPanel.style.top = "55%";
    infoPanel.style.padding = "18px";
    infoPanel.style.backdropFilter = "blur(6px)";
  } else {
    infoPanel.style.width = "";
    infoPanel.style.maxWidth = "";
    infoPanel.style.left = "";
    infoPanel.style.transform = "";
    infoPanel.style.top = "";
    infoPanel.style.padding = "";
  }
}
}

const pageTitle = document.createElement("div");
pageTitle.textContent = "Anatomy of a Fish Kill";
pageTitle.style.position = "fixed";
pageTitle.style.top = "50%";
pageTitle.style.left = "50%";
pageTitle.style.transform = "translate(-50%, -50%)";
pageTitle.style.zIndex = "30";
pageTitle.style.fontFamily = "monospace";
pageTitle.style.fontSize = isMobileView() ? "18px" : "32px";
pageTitle.style.width = isMobileView() ? "90vw" : "auto";
pageTitle.style.fontWeight = "700";
pageTitle.style.letterSpacing = "0.1em";
pageTitle.style.color = "#ffffff";
pageTitle.style.textAlign = "center";
pageTitle.style.pointerEvents = "none";
pageTitle.style.textShadow = "0 0 12px rgba(0,0,0,0.35)";
document.body.appendChild(pageTitle);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfcfcf);
scene.fog = new THREE.Fog(0xcfcfcf, 6, 13);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, getCameraZ());

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.52);
dirLight.position.set(3, 5, 6);
scene.add(dirLight);

const gridMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: true,
  uniforms: {
    time: { value: 0 },
    opacity: { value: 0.18 }
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float time;
    uniform float opacity;

    float gridLine(float value, float thickness) {
      float line = abs(fract(value) - 0.5);
      return 1.0 - smoothstep(0.0, thickness, line);
    }

    void main() {
      vec2 uv = vUv;
      uv.y += time * 0.035;

      float scale = 16.0;
      float gx = gridLine(uv.x * scale, 0.035);
      float gy = gridLine(uv.y * scale, 0.035);

      float grid = max(gx, gy);
      gl_FragColor = vec4(1.0, 1.0, 1.0, grid * opacity);
    }
  `
});

const gridPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 20),
  gridMaterial
);

// camera is at z = 8 looking toward negative z,
// so this puts the grid behind the floating assets
gridPlane.position.set(0, 0, -4.5);
gridPlane.renderOrder = -10;
scene.add(gridPlane);

const DitherPixelShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: {
      value: new THREE.Vector2(window.innerWidth, window.innerHeight)
    },
    pixelSize: { value: 3.0 },
    ditherStrength: { value: 0.1 }
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float pixelSize;
    uniform float ditherStrength;

    varying vec2 vUv;

    float bayer4(vec2 p) {
      int x = int(mod(p.x, 4.0));
      int y = int(mod(p.y, 4.0));
      int index = x + y * 4;

      if (index == 0) return 0.0 / 16.0;
      if (index == 1) return 8.0 / 16.0;
      if (index == 2) return 2.0 / 16.0;
      if (index == 3) return 10.0 / 16.0;
      if (index == 4) return 12.0 / 16.0;
      if (index == 5) return 4.0 / 16.0;
      if (index == 6) return 14.0 / 16.0;
      if (index == 7) return 6.0 / 16.0;
      if (index == 8) return 3.0 / 16.0;
      if (index == 9) return 11.0 / 16.0;
      if (index == 10) return 1.0 / 16.0;
      if (index == 11) return 9.0 / 16.0;
      if (index == 12) return 15.0 / 16.0;
      if (index == 13) return 7.0 / 16.0;
      if (index == 14) return 13.0 / 16.0;
      return 5.0 / 16.0;
    }

    void main() {
      vec2 pixelatedUv = floor(vUv * resolution / pixelSize) * pixelSize / resolution;
      vec4 color = texture2D(tDiffuse, pixelatedUv);

      color.rgb *= 0.58;

      float threshold = bayer4(gl_FragCoord.xy);
      color.rgb += (threshold - 0.5) * ditherStrength;
      color.rgb = clamp(color.rgb, 0.0, 1.0);

      color.rgb = floor(color.rgb * 64.0) / 64.0;

      gl_FragColor = color;
    }
  `
};

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const outlinePass = new OutlinePass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  scene,
  camera
);
outlinePass.edgeStrength = isMobileView() ? 4.0 : 6.0;
outlinePass.edgeThickness = isMobileView() ? 1.6 : 2.4;
outlinePass.edgeThickness = 2.4;
outlinePass.pulsePeriod = 1.2;
outlinePass.visibleEdgeColor.set("#8ace00");
outlinePass.hiddenEdgeColor.set("#8ace00");
composer.addPass(outlinePass);

const ditherPass = new ShaderPass(DitherPixelShader);
composer.addPass(ditherPass);

const loader = new GLTFLoader();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const floatingObjects = [];
const factoryObjects = [];
const clickableObjects = [];

const infoPanel = document.getElementById("infoPanel");
const infoTitle = document.getElementById("infoTitle");
const infoBlurb = document.getElementById("infoBlurb");
const infoSource = document.getElementById("infoSource");
const closePanel = document.getElementById("closePanel");

const modelPaths = {
  book: "/extra_assets/Book.glb",
  boxes: "/extra_assets/boxes.glb",
  deadfish: "/extra_assets/deadfish.glb",
  factory: "/extra_assets/factory.glb",
  salmon: "/extra_assets/Salmon.glb",
  mackerel: "/extra_assets/Mackerel.glb",
  rod: "/extra_assets/rod.glb",
  tissueBox: "/extra_assets/Tissue Box.glb",
  toiletPaper: "/extra_assets/Toilet paper.glb",
  trout: "/extra_assets/trout.glb"
};

const fishKillBlurb =
  "Fish species native to the Jackson River in Covington, Virginia provide essential ecosystem services: they support food webs, cycle nutrients, and help indicate the health of the river system. Their survival depends on stable dissolved oxygen levels and balanced water chemistry. In November 2024, a fish kill downstream of the Smurfit WestRock paper mill was linked to low dissolved oxygen conditions after an unpermitted wastewater release, showing how industrial pollution can quickly destabilize aquatic life.";

const fishKillSource =
  "https://www.yahoo.com/news/virginia-deq-report-blames-covington-203100489.html";

const paperProductBlurb =
  "Disposable paper products connect everyday consumption to the industrial pollution of the Smurfit WestRock paper mill in Covington, Virginia. According to reporting on EPA Greenhouse Gas Reporting Program data, the mill reported 970,084 metric tons of greenhouse gas emissions in 2023, making it the highest-emitting U.S. paper mill. Environmental Integrity Project analysis estimates the true climate impact at about 2.49 million metric tons when biogenic CO2 from burning wood and wood byproducts is included.";

const paperProductSource =
  "https://insideclimatenews.org/news/30052025/paper-mill-greenhouse-gase-pollution-report/";

const floatingAssets = [
  { key: "deadfish", title: "Jackson River Fish Kill", count: 6, targetSize: 0.75, blurb: fishKillBlurb, source: fishKillSource },
  { key: "salmon", title: "Jackson River Fish Kill", count: 5, targetSize: 0.85, blurb: fishKillBlurb, source: fishKillSource },
  { key: "mackerel", title: "Jackson River Fish Kill", count: 5, targetSize: 0.85, blurb: fishKillBlurb, source: fishKillSource },
  { key: "trout", title: "Jackson River Fish Kill", count: 4, targetSize: 0.8, blurb: fishKillBlurb, source: fishKillSource },
  { key: "book", title: "Paper Products and Mill Emissions", count: 3, targetSize: 0.75, blurb: paperProductBlurb, source: paperProductSource },
  { key: "tissueBox", title: "Paper Products and Mill Emissions", count: 4, targetSize: 0.75, blurb: paperProductBlurb, source: paperProductSource },
  { key: "toiletPaper", title: "Paper Products and Mill Emissions", count: 4, targetSize: 0.75, blurb: paperProductBlurb, source: paperProductSource },
  { key: "boxes", title: "Paper Products and Mill Emissions", count: 5, targetSize: 0.7, blurb: paperProductBlurb, source: paperProductSource },
  {
    key: "rod",
    title: "Fishing Rod",
    count: 2,
    targetSize: 1.2,
    blurb:
      "The fishing rod connects the scene to human extraction, recreation, food systems, and damaged aquatic habitats.",
    source: fishKillSource
  }
];

const factoryAsset = {
  key: "factory",
  title: "Smurfit WestRock Covington Mill",
  count: 38,
  targetSize: 1.15,
  blurb:
    "The repeated factory wall represents the Smurfit WestRock paper mill in Covington, Virginia, framing the lower edge of the scene as an industrial shoreline of greenhouse gas emissions, wastewater discharge, and river pollution.",
  source: paperProductSource
};

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function updateOutline() {
  const outlined = [];

  if (hoveredObject) outlined.push(hoveredObject);
  if (selectedObject && !outlined.includes(selectedObject)) outlined.push(selectedObject);

  outlinePass.selectedObjects = outlined;
}

function darkenAndFlattenMaterials(model, strength = 0.45) {
  model.traverse(child => {
    if (!child.isMesh || !child.material) return;

    const oldMat = Array.isArray(child.material)
      ? child.material[0]
      : child.material;

    const baseColor = oldMat.color
      ? oldMat.color.clone().multiplyScalar(strength)
      : new THREE.Color(strength, strength, strength);

    const newMat = new THREE.MeshBasicMaterial({
      color: baseColor,
      map: oldMat.map || null,
      transparent: oldMat.transparent || false,
      opacity: oldMat.opacity !== undefined ? oldMat.opacity : 1
    });

    if (newMat.map) {
      newMat.map.colorSpace = THREE.SRGBColorSpace;
    }

    child.material = newMat;
  });
}

function normalizeModel(model, targetSize) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 0 ? targetSize / maxDim : 1;

  model.scale.setScalar(scale);
  model.position.sub(center.multiplyScalar(scale));

  darkenAndFlattenMaterials(model, 1.05);

  return model;
}

function loadModel(path) {
  return new Promise((resolve, reject) => {
    loader.load(path, gltf => resolve(gltf.scene), undefined, error => reject(error));
  });
}

function createInstance(baseModel, asset, options = {}) {
  const clone = baseModel.clone(true);
  const group = new THREE.Group();

  group.add(clone);

  group.userData.info = asset;
  group.userData.velocity = options.velocity || new THREE.Vector3(0, 0, 0);
  group.userData.rotationSpeed = options.rotationSpeed || new THREE.Vector3(0, 0, 0);
  group.userData.isFactory = Boolean(options.isFactory);
  group.userData.isSelected = false;
  group.userData.baseScale = options.baseScale || 1;
  group.userData.targetScale = options.baseScale || 1;

  if (options.position) group.position.copy(options.position);

  if (options.scaleVariation) {
    const s = randomBetween(options.scaleVariation[0], options.scaleVariation[1]);
    group.scale.setScalar(s);
    group.userData.baseScale = s;
    group.userData.targetScale = s;
  }

  scene.add(group);
  return group;
}

async function init() {
  const loadedModels = {};
  const allKeys = [
    ...new Set([...floatingAssets.map(asset => asset.key), factoryAsset.key])
  ];

  for (const key of allKeys) {
    try {
      const assetConfig = floatingAssets.find(asset => asset.key === key) || factoryAsset;
      const rawModel = await loadModel(modelPaths[key]);
      loadedModels[key] = normalizeModel(rawModel, assetConfig.targetSize);
    } catch (error) {
      console.error("Model failed to load:", key, modelPaths[key], error);
    }
  }

  createFactoryWall(loadedModels.factory);
  createFloatingField(loadedModels);
}

function createFactoryWall(factoryModel) {
  if (!factoryModel) return;

  const count = factoryAsset.count;
  const xStart = -6.6;
  const xEnd = 6.6;
  const spacing = (xEnd - xStart) / (count - 1);

  for (let i = 0; i < count; i++) {
    const factory = createInstance(factoryModel, factoryAsset, {
      isFactory: true,
      position: new THREE.Vector3(
        xStart + spacing * i,
       (isMobileView() ? -3.6 : -2.95) + randomBetween(-0.06, 0.08),
        randomBetween(-0.75, 0.15)
      ),
      scaleVariation: [0.78, 1.25]
    });

    factory.rotation.y = randomBetween(-0.08, 0.08);
    factoryObjects.push(factory);
  }
}

function createFloatingField(loadedModels) {
  floatingAssets.forEach(asset => {
    const baseModel = loadedModels[asset.key];
    if (!baseModel) return;

    for (let i = 0; i < asset.count; i++) {
      const obj = createInstance(baseModel, asset, {
        position: new THREE.Vector3(
          randomBetween(-4.3, 4.3),
          randomBetween(-1.75, 2.55),
          randomBetween(-0.8, 0.8)
        ),
        velocity: new THREE.Vector3(
          randomBetween(-0.013, 0.013),
          randomBetween(-0.01, 0.01),
          0
        ),
        rotationSpeed: new THREE.Vector3(
          randomBetween(-0.004, 0.004),
          randomBetween(-0.014, 0.014),
          randomBetween(-0.004, 0.004)
        ),
        scaleVariation: [0.75, 1.35]
      });

      obj.rotation.set(
        randomBetween(-0.25, 0.25),
        randomBetween(0, Math.PI * 2),
        randomBetween(-0.2, 0.2)
      );

      floatingObjects.push(obj);
      clickableObjects.push(obj);
    }
  });
}

function bringObjectForward(obj) {
  obj.renderOrder = 999;

  obj.traverse(child => {
    child.renderOrder = 999;

    if (child.material) {
      child.material.depthTest = true;
      child.material.depthWrite = true;
    }
  });
}

function restoreObjectDepth(obj) {
  obj.renderOrder = 0;

  obj.traverse(child => {
    child.renderOrder = 0;

    if (child.material) {
      child.material.depthTest = true;
      child.material.depthWrite = true;
    }
  });
}

function selectObject(obj) {
  if (selectedObject && selectedObject !== obj) deselectObject();

  selectedObject = obj;
  selectedObject.userData.isSelected = true;
  selectedObject.userData.savedVelocity = selectedObject.userData.velocity.clone();
  selectedObject.userData.velocity.set(0, 0, 0);
  selectedObject.userData.targetScale = selectedObject.userData.baseScale * 2.2;
  pageTitle.style.opacity = "0";

  bringObjectForward(selectedObject);
  updateOutline();

  if (infoPanel && infoTitle && infoBlurb && infoSource) {
    const info = selectedObject.userData.info;

    infoTitle.textContent = info.title;
    infoBlurb.textContent = info.blurb;
    infoSource.href = info.source;
    infoSource.textContent = "Read source";

    infoPanel.classList.remove("hidden");
  }
}

function deselectObject() {
  if (!selectedObject) return;

  selectedObject.userData.isSelected = false;

  if (selectedObject.userData.savedVelocity) {
    selectedObject.userData.velocity.copy(selectedObject.userData.savedVelocity);
  }
pageTitle.style.opacity = "1";
  selectedObject.userData.targetScale = selectedObject.userData.baseScale;
  restoreObjectDepth(selectedObject);

  selectedObject = null;
  updateOutline();

  if (infoPanel) infoPanel.classList.add("hidden");
}

function updateMouse(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function getClickedObject() {
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(clickableObjects, true);

  if (hits.length === 0) return null;

  let obj = hits[0].object;

  while (obj.parent && !clickableObjects.includes(obj)) {
    obj = obj.parent;
  }

  return clickableObjects.includes(obj) ? obj : null;
}

window.addEventListener("mousemove", event => {
  updateMouse(event);
  const hit = getClickedObject();

  if (hit !== hoveredObject) {
    hoveredObject = hit;
    updateOutline();
  }

  document.body.style.cursor = hit ? "pointer" : "default";
});

window.addEventListener("click", event => {
  updateMouse(event);
  const hit = getClickedObject();

  if (hit) selectObject(hit);
});

if (closePanel) {
  closePanel.addEventListener("click", event => {
    event.stopPropagation();
    deselectObject();
  });
}

function animate() {
  requestAnimationFrame(animate);

  gridMaterial.uniforms.time.value += 0.03;

  floatingObjects.forEach(obj => {
    if (obj.userData.isSelected) {
     const targetPos = isMobileView()
  ? new THREE.Vector3(-1.4, 0.15, 1.9) // ← LEFT, not center
  : new THREE.Vector3(-2.5, 0.25, 1.2);

obj.position.lerp(targetPos, 0.08);
      obj.rotation.x += 0.01;
      obj.rotation.y += 0.015;
      obj.rotation.z *= 0.96;

      obj.scale.lerp(
        new THREE.Vector3(
          obj.userData.targetScale,
          obj.userData.targetScale,
          obj.userData.targetScale
        ),
        0.08
      );

      return;
    }

    obj.position.add(obj.userData.velocity);

    if (obj.position.x > 4.5 || obj.position.x < -4.5) obj.userData.velocity.x *= -1;
    if (obj.position.y > 2.65 || obj.position.y < -2.0) obj.userData.velocity.y *= -1;

    obj.rotation.x += obj.userData.rotationSpeed.x;
    obj.rotation.y += obj.userData.rotationSpeed.y;
    obj.rotation.z += obj.userData.rotationSpeed.z;

    obj.scale.lerp(
      new THREE.Vector3(
        obj.userData.baseScale,
        obj.userData.baseScale,
        obj.userData.baseScale
      ),
      0.08
    );
  });

  factoryObjects.forEach((obj, index) => {
    obj.position.y += Math.sin(Date.now() * 0.001 + index) * 0.0006;
  });

  composer.render();
}

init();
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.position.z = getCameraZ();
  updateResponsiveUI();

  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);

  outlinePass.setSize(window.innerWidth, window.innerHeight);

  ditherPass.uniforms.resolution.value.set(
    window.innerWidth,
    window.innerHeight
  );
});