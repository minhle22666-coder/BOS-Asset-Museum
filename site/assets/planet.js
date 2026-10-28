// The purple planet floating in the bottom-right corner.
// 3D model: "Purple Planet" by Yo.Ri (https://sketchfab.com/grox777), CC BY 4.0,
// https://sketchfab.com/3d-models/purple-planet-264eb22207184fc99a5e3b1279a763b8 (textures re-encoded as WebP).
import * as THREE from "three";
import { GLTFLoader } from "./vendor/jsm/loaders/GLTFLoader.js";

const wrap = document.getElementById("planet");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const flat = () => wrap.classList.add("flat", "ready"); // plain picture instead of 3D

async function main() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  } catch (_) { return flat(); }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x000000, 0);
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 7.2);

  // Violet planet, sea-blue light: a cool key light, a strong blue rim from behind, a soft violet fill.
  scene.add(new THREE.HemisphereLight("#8fb8ff", "#2a1470", 0.9));
  const key = new THREE.DirectionalLight("#e4ecff", 2.4); key.position.set(-3.5, 2.5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight("#2cc6ff", 5.5); rim.position.set(4, 1.2, -3.5); scene.add(rim);
  const sea = new THREE.PointLight("#3a7bff", 30, 12, 2); sea.position.set(2.5, -2.5, 2.5); scene.add(sea);

  let gltf;
  try {
    gltf = await new GLTFLoader().loadAsync("assets/planet/purple-planet.glb");
  } catch (e) { console.warn(e); renderer.dispose(); renderer.domElement.remove(); return flat(); }

  const model = gltf.scene;
  // centre the model and size it to a radius of about 1.55
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()).length() / 2;
  model.position.sub(box.getCenter(new THREE.Vector3()));
  const holder = new THREE.Group();
  holder.add(model);
  holder.scale.setScalar(1.55 / size);
  const tilt = new THREE.Group();
  tilt.rotation.set(0.32, 0, 0.38);
  tilt.add(holder);
  scene.add(tilt);

  // a touch of sea blue in the purple
  model.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (/planet/i.test(m.name)) { m.color = new THREE.Color("#b4c2ff"); m.emissiveIntensity = 0.32; }
    else { m.emissiveIntensity = 0.45; m.opacity = 0.9; }
  });

  const mixer = gltf.animations.length ? new THREE.AnimationMixer(model) : null;
  if (mixer && !reduce) gltf.animations.forEach((a) => mixer.clipAction(a).play());

  const fit = () => {
    const s = wrap.clientWidth || 300;
    renderer.setSize(s, s, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(fit).observe(wrap);
  fit();

  let mx = 0, my = 0, tx = 0, ty = 0, last = performance.now(), raf = 0;
  addEventListener("pointermove", (e) => { tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1; });

  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // only the home page shows the planet; skip drawing while it's away
    if ((parseFloat(wrap.style.getPropertyValue("--deck")) || 0) > 0.98) { raf = requestAnimationFrame(frame); return; }
    if (!reduce) {
      holder.rotation.y += dt * 0.16;
      mx += (tx - mx) * Math.min(1, dt * 2); my += (ty - my) * Math.min(1, dt * 2);
      tilt.rotation.x = 0.32 + my * 0.12;
      tilt.rotation.y = mx * 0.18;
      mixer && mixer.update(dt);
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  raf = requestAnimationFrame(frame);
  wrap.classList.add("ready");
}

main().catch((e) => { console.warn(e); flat(); });
