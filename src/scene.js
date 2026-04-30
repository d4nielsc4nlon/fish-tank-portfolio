// src/scene.js
import * as THREE from "three";

const GLOBAL_KEY = "__SCENE_READY__";

function initScene() {
  if (window[GLOBAL_KEY]) return;
  window[GLOBAL_KEY] = true;

  // -----------------------
  // SCENES

  const scene = new THREE.Scene();
  const overlayScene = new THREE.Scene();

  // -----------------------
  // CAMERA

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.z = 10;

  // -----------------------
  // RENDERER

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  document.body.prepend(renderer.domElement);

  Object.assign(renderer.domElement.style, {
    position: "fixed",
    inset: "0",
    zIndex: "0",
    pointerEvents: "none",
  });

  // -----------------------
  // BACKGROUND (simple, stable)

  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshBasicMaterial({ color: 0x2e5f9e })
  );
  bg.position.z = -20;
  scene.add(bg);

  // -----------------------
  // GLOBAL EXPORT

  window.__SCENE__ = scene;
  window.__OVERLAY_SCENE__ = overlayScene;
  window.__CAMERA__ = camera;
  window.__RENDERER__ = renderer;

  // -----------------------
  // RESIZE

  window.addEventListener("resize", () => {
    const w = window.innerWidth;
    const h = window.innerHeight;

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // -----------------------
  // ANIMATION

  function animate() {
    requestAnimationFrame(animate);

    renderer.clear();

    // background
    renderer.render(scene, camera);

    // overlay (works)
    renderer.clearDepth();
    renderer.render(overlayScene, camera);
  }

  animate();
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initScene, { once: true });
} else {
  initScene();
}