// Three.js viewer for engine-built pieces. One renderer per instance; thumbnails share an offscreen renderer.
import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

function makeScene(renderer) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xfff4e6, 1.6); key.position.set(40, 60, 50); scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe9ff, 0.9); rim.position.set(-50, 30, -40); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  return scene;
}

function fit(camera, controls, object, pad = 1.25) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = (maxDim / 2 / Math.tan((camera.fov * Math.PI) / 360)) * pad;
  camera.near = dist / 100; camera.far = dist * 20; camera.updateProjectionMatrix();
  camera.position.copy(center).add(new THREE.Vector3(0.75, 0.55, 1).normalize().multiplyScalar(dist));
  if (controls) { controls.target.copy(center); controls.minDistance = dist * 0.35; controls.maxDistance = dist * 3; controls.update(); } else camera.lookAt(center);
}

export const Viewer3D = forwardRef(function Viewer3D({ object, autoRotate = true, className = '', children }, ref) {
  const host = useRef(null);
  const st = useRef({});

  useEffect(() => {
    const el = host.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    const scene = makeScene(renderer);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.autoRotate = autoRotate; controls.autoRotateSpeed = 1.2; controls.enablePan = false;
    controls.addEventListener('start', () => { controls.autoRotate = false; });
    const holder = new THREE.Group(); scene.add(holder);
    const resize = () => { const w = el.clientWidth || 300; const h = el.clientHeight || 225; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    let raf; const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); }; loop();
    st.current = { renderer, scene, camera, controls, holder };
    return () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); el.removeChild(renderer.domElement); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const { holder, camera, controls } = st.current; if (!holder) return;
    holder.clear();
    if (object) { holder.add(object); fit(camera, controls, object); controls.autoRotate = autoRotate; }
  }, [object, autoRotate]);

  useImperativeHandle(ref, () => ({
    snapshot: (size = 768) => {
      const { renderer, scene, camera } = st.current; if (!renderer) return null;
      const prevSize = renderer.getSize(new THREE.Vector2()); const prevAspect = camera.aspect;
      renderer.setSize(size, size, false); camera.aspect = 1; camera.updateProjectionMatrix(); renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      renderer.setSize(prevSize.x, prevSize.y, false); camera.aspect = prevAspect; camera.updateProjectionMatrix();
      return url;
    },
    reset: () => { const { camera, controls, holder } = st.current; if (holder?.children[0]) fit(camera, controls, holder.children[0]); controls.autoRotate = true; },
  }));

  return <div ref={host} className={`viewer ${className}`}>{children}</div>;
});

// Shared offscreen renderer for small variant thumbnails.
let thumb;
export function renderThumbnail(object, size = 256) {
  if (!thumb) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(size, size, false); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = makeScene(renderer); const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000); const holder = new THREE.Group(); scene.add(holder);
    thumb = { renderer, scene, camera, holder };
  }
  const { renderer, scene, camera, holder } = thumb;
  // Clone so the live viewer keeps its object (three re-parents on add).
  const copy = object.clone();
  holder.clear(); holder.add(copy); fit(camera, null, copy, 1.15); renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  holder.clear();
  return url;
}
