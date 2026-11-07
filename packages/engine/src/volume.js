// Volume / weight and shared world-space mesh extraction (used by exporters too).
import * as THREE from 'three';
import { getMetal } from './catalog.js';

/** 'metal' | 'stone' for a mesh (userData.kind, material.userData.kind, or transmission heuristic). */
export function meshKind(mesh) {
  const k = mesh.userData?.kind || mesh.material?.userData?.kind;
  if (k === 'metal' || k === 'stone') return k;
  return mesh.material && mesh.material.transmission > 0 ? 'stone' : 'metal';
}

/** All meshes under root, with world matrices updated. */
export function collectMeshes(root, { includeStones = true, includeMetal = true } = {}) {
  root.updateMatrixWorld(true);
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const kind = meshKind(o);
    if (kind === 'stone' && !includeStones) return;
    if (kind === 'metal' && !includeMetal) return;
    out.push({ mesh: o, kind, name: o.name || o.userData?.partName || `${kind}-${out.length}` });
  });
  return out;
}

/**
 * World-space buffers for a mesh: positions (Float32Array), normals, index (Uint32Array).
 * Winding is flipped if the world matrix mirrors, so outward stays outward.
 */
export function worldData(mesh) {
  const geom = mesh.geometry;
  const m = mesh.matrixWorld;
  const src = geom.attributes.position;
  const n = src.count;
  const positions = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(src, i).applyMatrix4(m);
    positions[i * 3] = v.x; positions[i * 3 + 1] = v.y; positions[i * 3 + 2] = v.z;
  }
  let normals = null;
  if (geom.attributes.normal) {
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const ns = geom.attributes.normal;
    normals = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(ns, i).applyMatrix3(nm).normalize();
      normals[i * 3] = v.x; normals[i * 3 + 1] = v.y; normals[i * 3 + 2] = v.z;
    }
  }
  let index;
  if (geom.index) index = Uint32Array.from(geom.index.array);
  else {
    index = new Uint32Array(n);
    for (let i = 0; i < n; i++) index[i] = i;
  }
  if (m.determinant() < 0) {
    for (let i = 0; i < index.length; i += 3) {
      const t = index[i + 1]; index[i + 1] = index[i + 2]; index[i + 2] = t;
    }
  }
  return { positions, normals, index };
}

function signedVolumeOf(positions, index) {
  let vol = 0;
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
    const cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];
    vol += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return vol / 6;
}

/**
 * Metal volume in mm³: Σ signed tetrahedron volumes over every METAL mesh's triangles in world space.
 * Stone meshes are ignored (stones are set, not cast). Each mesh may hold several overlapping
 * closed solids (e.g. prongs sunk into a band); their volumes are summed, so overlaps are counted
 * twice — a small, deliberate overestimate (typically < 3 %).
 */
export function computeVolumeMm3(object3D) {
  let total = 0;
  for (const { mesh } of collectMeshes(object3D, { includeStones: false })) {
    const { positions, index } = worldData(mesh);
    total += Math.abs(signedVolumeOf(positions, index));
  }
  return total;
}

/** Metal weight in grams: volume (mm³) / 1000 × density (g/cm³). */
export function weightG(volumeMm3, metalId) {
  return (volumeMm3 / 1000) * getMetal(metalId).densityGcm3;
}

/** Triangle count of all (or filtered) meshes. */
export function countTriangles(root, opts) {
  let t = 0;
  for (const { mesh } of collectMeshes(root, opts)) {
    const g = mesh.geometry;
    t += (g.index ? g.index.count : g.attributes.position.count) / 3;
  }
  return t;
}
