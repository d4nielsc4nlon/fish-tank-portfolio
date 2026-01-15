
import * as THREE from 'three';
import { Clock } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import gsap from 'gsap';

// --- PROD DEBUG OVERLAY (temporary) ---
(function () {
  const box = document.createElement("pre");
  box.id = "debugOverlay";
  box.style.cssText = [
    "position:fixed",
    "left:12px",
    "right:12px",
    "bottom:12px",
    "max-height:45vh",
    "overflow:auto",
    "padding:10px",
    "border:1px solid #fff",
    "background:rgba(0,0,0,0.85)",
    "color:#fff",
    "font:12px/1.3 monospace",
    "z-index:999999",
    "white-space:pre-wrap",
  ].join(";");
  box.textContent = "contact.js loaded ✅\n";
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(box));

  window.addEventListener("error", (e) => {
    box.textContent += `\n[error]\n${e.message}\n${e.filename}:${e.lineno}:${e.colno}\n`;
  });

  window.addEventListener("unhandledrejection", (e) => {
    box.textContent += `\n[unhandledrejection]\n${String(e.reason?.stack || e.reason)}\n`;
  });
})();

// Contact page background scene:
// Same "tank" environment as main.js, but WITHOUT fish and WITHOUT HUD/time boxes.

const clock = new Clock();

function getViewportSize() {
  const vv = window.visualViewport;
  const w = vv?.width ?? window.innerWidth;
  const h = vv?.height ?? window.innerHeight;
  return { w, h };
}

// ------------------------------
// Shared GLSL
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

float causticField(vec2 uv, float t){
  uv *= 1.25;
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
// Scene
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x3a6f8f, 0.035);

// ------------------------------
// Camera
const camera = new THREE.PerspectiveCamera(
  60,
  getViewportSize().w / getViewportSize().h,
  0.1,
  200
);
camera.position.set(0, -1, 12);
camera.lookAt(0, 0, 0);

const mouse = new THREE.Vector2(0, 0);
const cameraTarget = new THREE.Vector2(0, 0);

// ------------------------------
// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const vp0 = getViewportSize();
renderer.setSize(vp0.w, vp0.h, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

document.body.appendChild(renderer.domElement);
Object.assign(renderer.domElement.style, {
  position: 'fixed',
  inset: '0',
  width: '100%',
  height: '100%',
  display: 'block',
  touchAction: 'none'
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
// Sea Floor
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

const seaFloor2 = seaFloor.clone();
seaFloor2.material = seaFloor.material.clone();
seaFloor2.material.color.set(0xb79f7d);
seaFloor2.position.y -= 0.45;
seaFloor2.position.z -= 1.1;
seaFloor2.scale.set(1.06, 1.0, 1.06);
seaFloor2.frustumCulled = false;
floorGroup.add(seaFloor2);

// Caustics mats
const causticsShadowMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.MultiplyBlending,
  uniforms: { time: { value: 0 }, strength: { value: 0.18 } },
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
  uniforms: { time: { value: 0 }, strength: { value: 0.35 } },
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
// Postprocessing
const OverheadRipplesShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    aspect: { value: (getViewportSize().w / getViewportSize().h) },
    scale: { value: 1 },
    speed: { value: 0.1 },
    shadowStrength: { value: 0.2 },
    highlightStrength: { value: 0.2 },
    tint: { value: new THREE.Color(0xcff7ff) },
    opacity: { value: 0.8 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
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
      vec2 uv = vUv;
      vec2 p = (uv - 0.5);
      p.x *= aspect;
      p *= scale;
      float t = time;
      p += vec2(0.0, t * speed * 2.0);

      float c1 = causticField(p * 0.85, t * 0.75);
      float c2 = causticField(p * 0.62, t * 0.75 + 9.0);
      float c  = clamp(c1 * 0.75 + c2 * 0.65, 0.0, 1.0);

      float depthBoost = smoothstep(0.25, 1.0, vUv.y);
      float k = c * depthBoost * opacity;

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
    void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
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

    void main(){
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
    void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float intensity;
    uniform float radius;
    varying vec2 vUv;

    void main(){
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
    void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 center;
    uniform float time;
    uniform float strength;
    varying vec2 vUv;

    void main(){
      vec2 dir = vUv - center;
      float dist = length(dir);
      float ripple = sin(dist * 40.0 - time * 6.0) * strength;
      vec2 offset = normalize(dir) * ripple * smoothstep(0.3, 0.0, dist);
      vec4 color = texture2D(tDiffuse, vUv + offset);
      gl_FragColor = color;
    }
  `
};

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const overheadPass = new ShaderPass(OverheadRipplesShader);
composer.addPass(overheadPass);
const pixelPass = new ShaderPass(PixelShader);
composer.addPass(pixelPass);
const ripplePass = new ShaderPass(RippleShader);
composer.addPass(ripplePass);
const vignettePass = new ShaderPass(VignetteShader);
composer.addPass(vignettePass);

// ------------------------------
// Events (touch-friendly)
window.addEventListener('pointermove', (e) => {
  const { w, h } = getViewportSize();
  mouse.x = (e.clientX / w) * 2 - 1;
  mouse.y = -(e.clientY / h) * 2 + 1;
}, { passive: true });

window.addEventListener('pointerdown', (e) => {
  const { w, h } = getViewportSize();
  const nx = (e.clientX / w) * 2 - 1;
  const ny = -(e.clientY / h) * 2 + 1;

  ripplePass.uniforms.center.value.set((nx + 1) / 2, (ny + 1) / 2);

  gsap.fromTo(
    ripplePass.uniforms.strength,
    { value: 0.02 },
    { value: 0.0, duration: 0.8, ease: 'power2.out' }
  );
}, { passive: true });

// ------------------------------
// Animate
function animate() {
  const delta = clock.getDelta();
  void delta; // (keeps parity with main.js in case you re-add mixers later)

  const t = performance.now() * 0.001;

  // camera parallax
  cameraTarget.x = mouse.x;
  cameraTarget.y = mouse.y;
  camera.position.x += (cameraTarget.x - camera.position.x) * 0.03;
  camera.position.y += (cameraTarget.y - camera.position.y - 1.0) * 0.03;
  camera.lookAt(0, 0, 0);

  // keep sand under camera (no visible end)
  seaFloor.position.x = camera.position.x;
  seaFloor2.position.x = camera.position.x;

  causticsShadowPlane.position.copy(seaFloor.position);
  causticsShadowPlane.rotation.copy(seaFloor.rotation);
  causticsShadowPlane.position.y += 0.002;

  causticsHighlightPlane.position.copy(seaFloor.position);
  causticsHighlightPlane.rotation.copy(seaFloor.rotation);
  causticsHighlightPlane.position.y += 0.003;

  // time uniforms
  bgMat.uniforms.time.value = performance.now() * 0.00001;
  ripplePass.uniforms.time.value += 0.03;
  bubbleMat.uniforms.time.value = performance.now() * 0.005;

  causticsShadowMat.uniforms.time.value = t;
  causticsHighlightMat.uniforms.time.value = t;

  overheadPass.uniforms.time.value = t;

  // dunes
  animateSeaFloor(seaFloor, seaBase, t, 0.22, 0.33, 0.35);
  animateSeaFloor(seaFloor2, sea2Base, t + 2.0, 0.14, 0.28, 0.28);

  composer.render();
  requestAnimationFrame(animate);
}
animate();

// ------------------------------
// Resize
function onResize() {
  const { w, h } = getViewportSize();

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h, false);
  composer.setSize(w, h);

  overheadPass.uniforms.aspect.value = w / h;
}

window.addEventListener('resize', onResize);
window.visualViewport?.addEventListener('resize', onResize);
window.visualViewport?.addEventListener('scroll', onResize);
onResize();
