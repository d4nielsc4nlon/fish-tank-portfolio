import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationMixer, Clock } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import gsap from 'gsap';

const clock = new Clock();
const loader = new GLTFLoader();

// ------------------------------
// Shared GLSL (defined BEFORE any ShaderMaterial uses it)
const RippleFnGLSL = `
float hash(vec2 p){
  p = fract(p*vec2(123.34, 345.45));
  p += dot(p, p+34.345);
  return fract(p.x*p.y);
}
float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0,0.0));
  float c = hash(i + vec2(0.0,1.0));
  float d = hash(i + vec2(1.0,1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}

// "Surface-like" flow field that produces banded caustics
float causticField(vec2 uv, float t){
  uv *= 1.25;

  // IMPORTANT CHANGE:
  // Drift mostly along +V direction (screen "toward camera" feel / background->foreground),
  // instead of right-to-left.
  uv += vec2(0.0, t * 0.22);

  float n = noise(uv*0.55 + t*0.25);
  uv += (n - 0.5) * 0.55;

  float a = sin(uv.x*3.0 + t*1.8);
  float b = sin(uv.y*3.4 - t*1.5);
  float c = sin((uv.x+uv.y)*2.4 + t*2.2);

  float v = (a + b + c) / 3.0;
  v = abs(v);
  v = pow(v, 6.0);
  return clamp(v, 0.0, 1.0);
}
`;

// ------------------------------
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x3a6f8f, 0.035);

// ------------------------------
// Camera
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(0, -1, 12);
camera.lookAt(0, 0, 0);

const cameraTarget = new THREE.Vector2();

// ------------------------------
// Renderer
const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

document.body.appendChild(renderer.domElement);

// ------------------------------

function makePixelHudCanvas({
  w = 260,
  h = 42,
  cssW = 320,
  top = '14px',
  left = null,
  right = null,
  zIndex = 30
} = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  c.width = w;
  c.height = h;
  ctx.imageSmoothingEnabled = false;

  Object.assign(c.style, {
    position: 'absolute',
    top,
    left: left ?? 'auto',
    right: right ?? 'auto',
    width: `${cssW}px`,
    height: 'auto',
    imageRendering: 'pixelated',
    pointerEvents: 'none',
    zIndex
  });

  document.body.appendChild(c);
  return { canvas: c, ctx, w, h };
}

function drawHudBlock(ctx, w, h, lines) {
  ctx.clearRect(0, 0, w, h);

  // subtle pixel “panel” background
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1.0;

  // thin border
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  ctx.globalAlpha = 1.0;

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '14px monospace';

  const padX = 8;
  const padY = 7;

  if (lines[0]) ctx.fillText(lines[0], padX, padY);
  ctx.globalAlpha = 0.9;
  ctx.font = '13px monospace';
  if (lines[1]) ctx.fillText(lines[1], padX, padY + 18);
  ctx.globalAlpha = 1.0;
}

const hudNY = makePixelHudCanvas({ left: '14px', top: '12px', w: 280, h: 44, cssW: 340 });
const hudTK = makePixelHudCanvas({ right: '14px', top: '12px', w: 280, h: 44, cssW: 340 });

function getTimeString(timeZone) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  return fmt.format(now);
}

function startHudClocks(getWeatherLineNY, getWeatherLineTK) {
  function tick() {
    const nyTime = getTimeString('America/New_York');
    const tkTime = getTimeString('Asia/Tokyo');

    drawHudBlock(hudNY.ctx, hudNY.w, hudNY.h, [
      `NYC  ${nyTime}`,
      getWeatherLineNY?.() ?? '—'
    ]);

    drawHudBlock(hudTK.ctx, hudTK.w, hudTK.h, [
      `TOKYO  ${tkTime}`,
      getWeatherLineTK?.() ?? '—'
    ]);

    requestAnimationFrame(() => {}); // no-op; keeps style consistent
  }

  tick();
  setInterval(tick, 1000);
}

function wmoIcon(code) {
  // very simple + readable set
  if (code === 0) return '☀︎';
  if (code === 1 || code === 2) return '⛅︎';
  if (code === 3) return '☁︎';
  if (code >= 45 && code <= 48) return '≋';      // fog-ish
  if (code >= 51 && code <= 67) return '☂︎';      // drizzle/freezing drizzle
  if (code >= 71 && code <= 77) return '❄︎';      // snow
  if (code >= 80 && code <= 82) return '☔︎';      // rain showers
  if (code >= 95) return '⚡︎';                   // thunder
  return '•';
}

async function fetchOpenMeteoCurrent(lat, lon, unit = 'fahrenheit') {
  // unit: 'fahrenheit' or 'celsius'
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code&temperature_unit=${unit}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather fetch failed');
  const data = await res.json();

  const temp = data?.current?.temperature_2m;
  const code = data?.current?.weather_code;

  return { temp, code };
}

function startWeatherFeed() {
  // NYC + Tokyo coords
  const NYC = { lat: 40.7128, lon: -74.0060, unit: 'fahrenheit', labelUnit: '°F' };
  const TKY = { lat: 35.6762, lon: 139.6503, unit: 'celsius',    labelUnit: '°C' };

  let nyLine = '…';
  let tkLine = '…';

  async function refresh() {
    try {
      const ny = await fetchOpenMeteoCurrent(NYC.lat, NYC.lon, NYC.unit);
      nyLine = `${Math.round(ny.temp)}${NYC.labelUnit}  ${wmoIcon(ny.code)}`;
    } catch { nyLine = 'WEATHER —'; }

    try {
      const tk = await fetchOpenMeteoCurrent(TKY.lat, TKY.lon, TKY.unit);
      tkLine = `${Math.round(tk.temp)}${TKY.labelUnit}  ${wmoIcon(tk.code)}`;
    } catch { tkLine = 'WEATHER —'; }
  }

  refresh();
  setInterval(refresh, 10 * 60 * 1000);

  return {
    getNY: () => nyLine,
    getTK: () => tkLine
  };
}

const weather = startWeatherFeed();
startHudClocks(weather.getNY, weather.getTK);


// HTML Title (pixelated)
const titleCanvas = document.createElement('canvas');
const ctx = titleCanvas.getContext('2d');

const CANVAS_W = 320;
const CANVAS_H = 48;
titleCanvas.width = CANVAS_W;
titleCanvas.height = CANVAS_H;

ctx.imageSmoothingEnabled = false;
ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
ctx.font = '20px monospace';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillStyle = '#ffffff';
ctx.fillText('DANIEL SCANLON', CANVAS_W / 2, CANVAS_H / 2);

Object.assign(titleCanvas.style, {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  width: '420px',
  height: 'auto',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
  zIndex: 20
});
document.body.appendChild(titleCanvas);

// Hover Label (PIXELATED, canvas-based like the title)
const hoverCanvas = document.createElement('canvas');
const hoverCtx = hoverCanvas.getContext('2d');

const HOVER_W = 360;
const HOVER_H = 36;
hoverCanvas.width = HOVER_W;
hoverCanvas.height = HOVER_H;

hoverCtx.imageSmoothingEnabled = false;

Object.assign(hoverCanvas.style, {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, calc(-50% + 52px))',
  width: '420px',            // scale up (same vibe as title)
  height: 'auto',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
  zIndex: 21,
  opacity: '0',
  transition: 'opacity 160ms ease'
});

document.body.appendChild(hoverCanvas);

function drawHoverText(text) {
  hoverCtx.clearRect(0, 0, HOVER_W, HOVER_H);

  if (!text) return;

  hoverCtx.font = '18px monospace';
  hoverCtx.textAlign = 'center';
  hoverCtx.textBaseline = 'middle';
  hoverCtx.fillStyle = '#ffffff';
  hoverCtx.fillText(text.toUpperCase(), HOVER_W / 2, HOVER_H / 2);
}

// ------------------------------
// Mouse & Raycaster
const mouse = { x: 0, y: 0 };
const raycaster = new THREE.Raycaster();
let hoveredFish = null;
let lastHoverLabel = '';

// ------------------------------
// Fish Data (dolphin = fish5 with tint)
const fishData = [
  { url: '/src/assets/models/fish1.glb', pos: [-2, -3, -0.25], scale: 0.4, anim: 'Armature|Swim',       link: '/about',   label: 'ABOUT',          glow: '#00ff95' },
  { url: '/src/assets/models/fish2.glb', pos: [-3, -0.25, 0],   scale: 0.5, anim: 'Armature|Swim.001',  link: '/works',   label: 'SELECTED WORKS', glow: '#ff9ad5' },
  { url: '/src/assets/models/fish3.glb', pos: [2.5, -3, -0.5],  scale: 0.6, anim: 'Armature|Swim',       link: '/cv',      label: 'CV',            glow: '#da44ff' },
  { url: '/src/assets/models/fish4.glb', pos: [0.25, 3.4, 0],   scale: 1.2, anim: 'Armature|Swim',       link: '/contact', label: 'CONTACT',       glow: '#8fffc1' },
  { url: '/src/assets/models/fish5.glb', pos: [2.7, -0.6, 0],   scale: 0.8, anim: 'Armature|Swim',       link: '/extra',   label: 'EXTRA',         glow: '#8fd3ff', tint: '#ffc7de' },
];

const fishObjects = [];

// ------------------------------
// Load Fish Models + Glow Shell Overlay
fishData.forEach((data) => {
  loader.load(
    data.url,
    (gltf) => {
      const fish = gltf.scene;
      fish.position.set(...data.pos);
      fish.scale.setScalar(data.scale);
      scene.add(fish);

      const tintColor = data.tint ? new THREE.Color(data.tint) : null;

      fish.traverse((child) => {
        if (!child.isMesh) return;

        child.material = child.material.clone();
        child.material.fog = true;

        // Dolphin tint: keep it BRIGHT + pink even in shadow
        if (tintColor && child.material && 'color' in child.material) {
          child.material.color.lerp(tintColor, 0.12);
          child.material.color.multiplyScalar(1.1);

          if ('emissive' in child.material) {
            child.material.emissive = tintColor.clone();
            child.material.emissiveIntensity = 0.50;
          }
        }

        child.material.needsUpdate = true;
      });

      // Glow overlay group
      const glowGroup = new THREE.Group();
      glowGroup.name = 'GlowOverlay';

      fish.traverse((child) => {
        if (!child.isMesh) return;

        const glowMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(data.glow),
          transparent: true,
          opacity: 0.0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2
        });

        let glowMesh;

        if (child.isSkinnedMesh) {
          glowMesh = new THREE.SkinnedMesh(child.geometry, glowMat);
          glowMesh.skeleton = child.skeleton;
          glowMesh.bindMatrix.copy(child.bindMatrix);
          glowMesh.bind(child.skeleton, child.bindMatrix);

          if (child.morphTargetInfluences) {
            glowMesh.morphTargetInfluences = child.morphTargetInfluences;
            glowMesh.morphTargetDictionary = child.morphTargetDictionary;
          }
        } else {
          glowMesh = new THREE.Mesh(child.geometry, glowMat);
        }

        glowMesh.position.copy(child.position);
        glowMesh.quaternion.copy(child.quaternion);
        glowMesh.scale.copy(child.scale).multiplyScalar(1.10);
        glowMesh.renderOrder = 999;
        glowMesh.frustumCulled = false;

        glowGroup.add(glowMesh);
      });

      fish.add(glowGroup);

      // Animation
      const mixer = new AnimationMixer(fish);
      const animOffset = Math.random() * 2.0;

      if (gltf.animations?.length) {
        const clip = THREE.AnimationClip.findByName(gltf.animations, data.anim);
        if (clip) {
          const action = mixer.clipAction(clip);
          action.setEffectiveTimeScale(0.25);
          action.startAt(animOffset);
          action.play();
        }
      }

      fishObjects.push({
        mesh: fish,
        glowGroup,
        mixer,
        home: data.pos,
        link: data.link,
        label: data.label,
        baseScale: data.scale,
        proceduralOffset: Math.random() * Math.PI * 2
      });
    },
    undefined,
    (err) => console.error('GLB load failed:', data.url, err)
  );
});

// ------------------------------
// Lighting
scene.add(new THREE.AmbientLight(0x406080, 1.0));

const directional = new THREE.DirectionalLight(0xaaccff, 1.2);
directional.position.set(3, 5, 2);
scene.add(directional);

scene.add(new THREE.AmbientLight(0xffffff, 6.0));

const directional2 = new THREE.DirectionalLight(0xffffff, 2.5);
directional2.position.set(5, 5, 5);
scene.add(directional2);

const sun = new THREE.DirectionalLight(0xfff1d6, 0.5);
sun.position.set(-4, 9, 6);
scene.add(sun);

// ------------------------------
// Sea Floor (effectively infinite)
const floorGroup = new THREE.Group();
floorGroup.name = 'SeaFloor';
scene.add(floorGroup);

const FLOOR_W = 260;
const FLOOR_H = 180;
const FLOOR_SEG_X = 64;
const FLOOR_SEG_Y = 40;

const floorGeo = new THREE.PlaneGeometry(FLOOR_W, FLOOR_H, FLOOR_SEG_X, FLOOR_SEG_Y);
floorGeo.rotateX(-Math.PI / 2);

const floorMat = new THREE.MeshStandardMaterial({
  color: 0xd8c7a2,
  roughness: 0.95,
  metalness: 0.0,
  flatShading: true
});

const seaFloor = new THREE.Mesh(floorGeo, floorMat);
seaFloor.frustumCulled = false;
seaFloor.position.set(0, -5, -4);
seaFloor.rotation.y = 0.08;
floorGroup.add(seaFloor);

// Underlayer
const seaFloor2 = seaFloor.clone();
seaFloor2.material = seaFloor.material.clone();
seaFloor2.material.color.set(0xb79f7d);
seaFloor2.position.y -= 0.45;
seaFloor2.position.z -= 1.1;
seaFloor2.scale.set(1.06, 1.0, 1.06);
seaFloor2.frustumCulled = false;
floorGroup.add(seaFloor2);

// Caustics on sand: shadow (multiply) + highlight (add)
const causticsShadowMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.MultiplyBlending,
  uniforms: {
    time: { value: 0 },
    strength: { value: 0.18 }
  },
  vertexShader: `
    varying vec2 vXZ;
    void main(){
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vXZ = wp.xz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    precision highp float;
    varying vec2 vXZ;
    uniform float time;
    uniform float strength;
    ${RippleFnGLSL}
    void main(){
  float t = time * 0.55;

  float c1 = causticField(vXZ * 0.14, t);
  float c2 = causticField(vXZ * 0.10, t + 11.0);
  float c  = clamp(c1*0.75 + c2*0.55, 0.0, 1.0);

  // fade caustics out as they approach the far edge (prevents a hard horizon band)
  float fade = 1.0 - smoothstep(35.0, 85.0, abs(vXZ.y));

  float shade = 1.0 - (c * strength * fade);
  gl_FragColor = vec4(vec3(shade), 0.55 * fade);
}
  `
});

const causticsHighlightMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    time: { value: 0 },
    strength: { value: 0.35 }
  },
  vertexShader: `
    varying vec2 vXZ;
    void main(){
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vXZ = wp.xz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    precision highp float;
    varying vec2 vXZ;
    uniform float time;
    uniform float strength;
    ${RippleFnGLSL}
    void main(){
  float t = time * 0.55;

  float c1 = causticField(vXZ * 0.14, t + 2.0);
  float c2 = causticField(vXZ * 0.09,  t + 13.0);
  float c  = clamp(c1*0.85 + c2*0.65, 0.0, 1.0);

  float fade = 1.0 - smoothstep(35.0, 85.0, abs(vXZ.y));

  vec3 glow = vec3(1.0, 0.98, 0.92) * (c * strength * fade);
  gl_FragColor = vec4(glow, c * 0.65 * fade);
}

  `
});

const causticsShadowPlane = new THREE.Mesh(floorGeo.clone(), causticsShadowMat);
const causticsHighlightPlane = new THREE.Mesh(floorGeo.clone(), causticsHighlightMat);

causticsShadowPlane.frustumCulled = false;
causticsHighlightPlane.frustumCulled = false;

causticsShadowPlane.position.copy(seaFloor.position);
causticsShadowPlane.rotation.copy(seaFloor.rotation);
causticsShadowPlane.position.y += 0.0015;
causticsShadowPlane.renderOrder = 50;

causticsHighlightPlane.position.copy(seaFloor.position);
causticsHighlightPlane.rotation.copy(seaFloor.rotation);
causticsHighlightPlane.position.y += 0.0025;
causticsHighlightPlane.renderOrder = 51;

floorGroup.add(causticsShadowPlane);
floorGroup.add(causticsHighlightPlane);

// Cache base positions for dunes
const seaPos = seaFloor.geometry.attributes.position;
const seaBase = new Float32Array(seaPos.array.length);
seaBase.set(seaPos.array);

const sea2Pos = seaFloor2.geometry.attributes.position;
const sea2Base = new Float32Array(sea2Pos.array.length);
sea2Base.set(sea2Pos.array);

function animateSeaFloor(mesh, base, t, amp, freq, speed) {
  const pos = mesh.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ix = i * 3;
    const x = base[ix + 0];
    const y = base[ix + 1];
    const z = base[ix + 2];

    const h =
      Math.sin(x * freq + t * speed) * amp +
      Math.cos(z * (freq * 0.9) + t * (speed * 0.85)) * (amp * 0.7) +
      Math.sin((x + z) * (freq * 0.55) + t * (speed * 1.25)) * (amp * 0.35);

    pos.array[ix + 1] = y + h;
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

// ------------------------------
// Background
const bgGeo = new THREE.PlaneGeometry(200, 200);
const bgMat = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    varying vec2 vUv;

    float caustic(vec2 uv) {
      float c1 = sin((uv.x + time * 0.05) * 30.0);
      float c2 = sin((uv.y + time * 0.04) * 24.0);
      return (c1 + c2) * 0.015;
    }

    void main() {
      float depth = clamp(vUv.y, 0.0, 1.0);

      vec3 surfaceColor = vec3(0.65, 0.90, 0.88);
      vec3 midColor     = vec3(0.25, 0.55, 0.75);
      vec3 deepColor    = vec3(0.05, 0.18, 0.38);

      vec3 color = mix(
        mix(deepColor, midColor, smoothstep(0.0, 0.6, depth)),
        surfaceColor,
        smoothstep(0.6, 1.0, depth)
      );

      color += depth * 0.10;
      color += caustic(vUv) * smoothstep(0.3, 1.0, depth);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
  side: THREE.DoubleSide,
  depthWrite: false
});
const bgPlane = new THREE.Mesh(bgGeo, bgMat);
bgPlane.position.z = -20;
scene.add(bgPlane);

// ------------------------------
// Bubbles
const bubbleCount = 120;
const bubbleGeo = new THREE.BufferGeometry();
const bubblePos = new Float32Array(bubbleCount * 3);
const bubbleSize = new Float32Array(bubbleCount);

for (let i = 0; i < bubbleCount; i++) {
  bubblePos[i * 3 + 0] = THREE.MathUtils.randFloat(-10, 10);
  bubblePos[i * 3 + 1] = THREE.MathUtils.randFloat(-8, 8);
  bubblePos[i * 3 + 2] = THREE.MathUtils.randFloat(-8, -2);
  bubbleSize[i] = THREE.MathUtils.randFloat(0.4, 1.2);
}

bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePos, 3));
bubbleGeo.setAttribute('size', new THREE.BufferAttribute(bubbleSize, 1));

const bubbleMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: false,
  uniforms: { time: { value: 0 } },
  vertexShader: `
    attribute float size;
    uniform float time;
    varying float vAlpha;

    void main() {
      vec3 pos = position;
      pos.y = mod(pos.y + time * 0.4 + 8.0, 16.0) - 8.0;
      pos.x += sin(time * 0.6 + position.y * 2.0) * 0.15;
      vAlpha = smoothstep(-8.0, 8.0, pos.y);

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = size * 50.0 * (1.0 / abs(mvPosition.z));
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying float vAlpha;

    void main() {
      vec2 uv = gl_PointCoord - vec2(0.5);
      float r = length(uv);

      float edge   = smoothstep(0.5, 0.45, r);
      float hollow = smoothstep(0.35, 0.25, r);
      float rim    = smoothstep(0.48, 0.5, r);

      float alpha = edge * (1.0 - hollow);
      vec3 color = vec3(0.75, 0.9, 1.0) + rim * 0.6;

      gl_FragColor = vec4(color, alpha * vAlpha * 0.9);
    }
  `
});
const bubbles = new THREE.Points(bubbleGeo, bubbleMat);
scene.add(bubbles);

// ------------------------------
// Postprocessing Shaders

// NEW: Overhead ripples that ALWAYS sit above the manta ray (screen-space)
const OverheadRipplesShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    aspect: { value: window.innerWidth / window.innerHeight },

    // Tune these:
    scale: { value: 1 },        // bigger = larger ripples
    speed: { value: 0.1 },       // background -> foreground flow speed
    shadowStrength: { value: 0.2 },
    highlightStrength: { value: 0.2 },
    tint: { value: new THREE.Color(0xcff7ff) },
    opacity: { value: 0.8 }      // overall visibility of overhead effect
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float aspect;
    uniform float scale;
    uniform float speed;
    uniform float shadowStrength;
    uniform float highlightStrength;
    uniform vec3 tint;
    uniform float opacity;
    varying vec2 vUv;
    ${RippleFnGLSL}

    void main(){
      vec4 base = texture2D(tDiffuse, vUv);

      // Screen-space pattern:
      // Move from background->foreground: top -> bottom (increasing vUv.y)
      vec2 uv = vUv;
      vec2 p = (uv - 0.5);
      p.x *= aspect;

      // scale pattern
      p *= scale;

      // animate forward in +Y (screen space) so it "comes toward camera"
      float t = time;
      p += vec2(0.0, t * speed * 2.0);

      float c1 = causticField(p * 0.85, t * 0.75);
      float c2 = causticField(p * 0.62, t * 0.75 + 9.0);
      float c  = clamp(c1 * 0.75 + c2 * 0.65, 0.0, 1.0);

      // Make it stronger near bottom (closer to camera)
      float depthBoost = smoothstep(0.25, 1.0, vUv.y);
      float k = c * depthBoost * opacity;

      // Apply as subtle shadow + highlight (caustics feel)
      vec3 col = base.rgb;
      col *= (1.0 - k * shadowStrength);
      col += tint * (k * highlightStrength);

      gl_FragColor = vec4(col, base.a);
    }
  `
};

const PixelShader = {
  uniforms: {
    tDiffuse: { value: null },
    pixelSize: { value: 380.0 },
    colorDepth: { value: 7.5 },
    ditherAmount: { value: 0.03 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float pixelSize;
    uniform float colorDepth;
    uniform float ditherAmount;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = floor(vUv * pixelSize) / pixelSize + 0.5 / pixelSize;
      vec4 color = texture2D(tDiffuse, uv);

      float noise = rand(uv + color.xy) * ditherAmount;
      color.rgb += noise;

      color.rgb = floor(color.rgb * colorDepth) / colorDepth;
      color.rgb = pow(color.rgb, vec3(1.1));

      gl_FragColor = color;
    }
  `
};

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    intensity: { value: 1.18 },
    radius: { value: 0.6 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float intensity;
    uniform float radius;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float dist = distance(vUv, vec2(0.5));
      float edge = smoothstep(radius, 1.0, dist);
      color.rgb += edge * intensity;
      gl_FragColor = color;
    }
  `
};

const RippleShader = {
  uniforms: {
    tDiffuse: { value: null },
    center: { value: new THREE.Vector2(0.5, 0.5) },
    time: { value: 0 },
    strength: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 center;
    uniform float time;
    uniform float strength;
    varying vec2 vUv;

    void main() {
      vec2 dir = vUv - center;
      float dist = length(dir);

      float ripple = sin(dist * 40.0 - time * 6.0) * strength;
      vec2 offset = normalize(dir) * ripple * smoothstep(0.3, 0.0, dist);

      vec4 color = texture2D(tDiffuse, vUv + offset);
      gl_FragColor = color;
    }
  `
};

// ------------------------------
// Composer
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// IMPORTANT: overhead ripples happen right after scene render
const overheadPass = new ShaderPass(OverheadRipplesShader);
composer.addPass(overheadPass);

// then your PS1 look
const pixelPass = new ShaderPass(PixelShader);
composer.addPass(pixelPass);

const ripplePass = new ShaderPass(RippleShader);
composer.addPass(ripplePass);

const vignettePass = new ShaderPass(VignetteShader);
composer.addPass(vignettePass);

// ------------------------------
// Events (now that ripplePass exists)
window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(fishObjects.map(f => f.mesh), true);

  hoveredFish = hits.length
    ? fishObjects.find(
        f =>
          hits[0].object === f.mesh ||
          hits[0].object.parent === f.mesh ||
          f.mesh.getObjectById(hits[0].object.id)
      )
    : null;

  const nextLabel = hoveredFish ? hoveredFish.label : '';
  if (nextLabel !== lastHoverLabel) {
    drawHoverText(nextLabel);
    hoverCanvas.style.opacity = nextLabel ? '1' : '0';
    lastHoverLabel = nextLabel;
  }
});

window.addEventListener('click', () => {
  raycaster.setFromCamera(mouse, camera);

  ripplePass.uniforms.center.value.set((mouse.x + 1) / 2, (mouse.y + 1) / 2);

  gsap.fromTo(
    ripplePass.uniforms.strength,
    { value: 0.02 },
    { value: 0.0, duration: 0.8, ease: 'power2.out' }
  );

  const hits = raycaster.intersectObjects(fishObjects.map(f => f.mesh), true);
  if (hits.length) {
    const clickedFish = fishObjects.find(
      f =>
        hits[0].object === f.mesh ||
        hits[0].object.parent === f.mesh ||
        f.mesh.getObjectById(hits[0].object.id)
    );
    if (clickedFish) window.location.href = clickedFish.link;
  }
});

// ------------------------------
// Glow updater
function updateGlowShell(fishObj, isHovered) {
  const target = isHovered ? 0.85 : 0.0;
  const pulse = isHovered ? (0.65 + Math.sin(performance.now() * 0.008) * 0.25) : 0.0;

  fishObj.glowGroup.children.forEach((m) => {
    m.material.opacity += ((target * pulse) - m.material.opacity) * 0.18;
  });
}

// ------------------------------
// Animate
function animate() {
  const delta = clock.getDelta();
  const t = performance.now() * 0.001;
  const baseTime = t * 0.25;

  // camera parallax
  cameraTarget.x = mouse.x;
  cameraTarget.y = mouse.y;
  camera.position.x += (cameraTarget.x - camera.position.x) * 0.03;
  camera.position.y += (cameraTarget.y - camera.position.y - 1.0) * 0.03;
  camera.lookAt(0, 0, 0);

  // keep sand under camera (no visible end)
seaFloor.position.x = camera.position.x;
seaFloor2.position.x = camera.position.x;

// IMPORTANT: make caustics follow the sand EXACTLY (pos + rot), not just x
causticsShadowPlane.position.copy(seaFloor.position);
causticsShadowPlane.rotation.copy(seaFloor.rotation);
causticsShadowPlane.position.y += 0.002;   // was ~0.055 (too high)

causticsHighlightPlane.position.copy(seaFloor.position);
causticsHighlightPlane.rotation.copy(seaFloor.rotation);
causticsHighlightPlane.position.y += 0.003; // was ~0.06 (too high)

  // time uniforms
  bgMat.uniforms.time.value = performance.now() * 0.00001;
  ripplePass.uniforms.time.value += 0.03;
  bubbleMat.uniforms.time.value = performance.now() * 0.005;

  causticsShadowMat.uniforms.time.value = t;
  causticsHighlightMat.uniforms.time.value = t;

  // NEW: overhead ripples time
  overheadPass.uniforms.time.value = t;
  overheadPass.uniforms.aspect.value = window.innerWidth / window.innerHeight;

  // sand dunes
  animateSeaFloor(seaFloor, seaBase, t, 0.22, 0.33, 0.35);
  animateSeaFloor(seaFloor2, sea2Base, t + 2.0, 0.14, 0.28, 0.28);

  // fish
  fishObjects.forEach((fishObj, i) => {
    const home = fishObj.home;
    const off = fishObj.proceduralOffset;

    const amplitudeX = 0.2 + i * 0.1;
    const amplitudeY = 0.1 + i * 0.05;
    const speed = 0.2 + i * 0.05;

    fishObj.mesh.position.x = home[0] + Math.sin(baseTime * speed + off) * amplitudeX;
    fishObj.mesh.position.y = home[1] + Math.cos(baseTime * speed + off * 1.3) * amplitudeY;

    if (i === 3) fishObj.mesh.position.y += 0.02;
    if (fishObj.mixer) fishObj.mixer.update(delta);

    const isHovered = hoveredFish === fishObj;
    updateGlowShell(fishObj, isHovered);

    const targetScale = isHovered ? fishObj.baseScale * 1.07 : fishObj.baseScale;
    fishObj.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
  });

  composer.render();
  requestAnimationFrame(animate);
}
animate();

// ------------------------------
// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);

  // keep overhead pass aspect correct
  overheadPass.uniforms.aspect.value = window.innerWidth / window.innerHeight;
});
