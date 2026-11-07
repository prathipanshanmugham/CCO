// Geometry plumbing: closed-solid preparation, transforms, primitive helpers, part sets.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const UP = Object.freeze(new THREE.Vector3(0, 1, 0));
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** Signed volume (mm³) of an indexed or non-indexed geometry in its local space. */
export function signedVolume(geom) {
  const pos = geom.attributes.position.array;
  const idx = geom.index ? geom.index.array : null;
  const n = idx ? idx.length : pos.length / 3;
  let v = 0;
  for (let i = 0; i < n; i += 3) {
    const a = (idx ? idx[i] : i) * 3;
    const b = (idx ? idx[i + 1] : i + 1) * 3;
    const c = (idx ? idx[i + 2] : i + 2) * 3;
    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
    const bx = pos[b], by = pos[b + 1], bz = pos[b + 2];
    const cx = pos[c], cy = pos[c + 1], cz = pos[c + 2];
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return v / 6;
}

function flipWinding(geom) {
  const idx = geom.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const t = idx[i + 1];
    idx[i + 1] = idx[i + 2];
    idx[i + 2] = t;
  }
  geom.index.needsUpdate = true;
  const nrm = geom.attributes.normal;
  if (nrm) {
    for (let i = 0; i < nrm.array.length; i++) nrm.array[i] = -nrm.array[i];
    nrm.needsUpdate = true;
  }
}

/**
 * Normalise a CLOSED solid for merging/export: keep only position+normal, make it indexed,
 * drop groups, and orient triangles outward (positive signed volume).
 */
export function prep(geom) {
  const g = geom;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  g.morphAttributes = {};
  g.clearGroups();
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.index) {
    const count = g.attributes.position.count;
    const arr = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
    for (let i = 0; i < count; i++) arr[i] = i;
    g.setIndex(new THREE.BufferAttribute(arr, 1));
  } else if (!(g.index.array instanceof Uint32Array) && !(g.index.array instanceof Uint16Array)) {
    g.setIndex(new THREE.BufferAttribute(Uint32Array.from(g.index.array), 1));
  }
  if (signedVolume(g) < 0) flipWinding(g);
  return g;
}

/** Flat-shaded copy (per-face normals) — gives facets on gems/faceted bangles. */
export function flat(geom) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}

/** Merge prepared geometries (all indexed, position+normal). */
export function merge(geoms) {
  if (geoms.length === 1) return geoms[0];
  const m = mergeGeometries(geoms, false);
  if (!m) throw new Error('mergeGeometries failed');
  return m;
}

// ---------- matrices -------------------------------------------------------

/** Matrix that rotates +Y onto `dir` and translates to `pos`. */
export function alignY(dir, pos = new THREE.Vector3(), spin = 0) {
  const d = dir.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(Y, d);
  if (spin) q.multiply(new THREE.Quaternion().setFromAxisAngle(Y, spin));
  return new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1));
}

/** Matrix from an orthonormal basis (x, y, z) and origin. */
export function basis(x, y, z, pos) {
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  m.setPosition(pos);
  return m;
}

export const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
export const RX = (a) => new THREE.Matrix4().makeRotationX(a);
export const RY = (a) => new THREE.Matrix4().makeRotationY(a);
export const RZ = (a) => new THREE.Matrix4().makeRotationZ(a);
export const S = (x, y = x, z = x) => new THREE.Matrix4().makeScale(x, y, z);
/** Compose matrices left-to-right in application order: chain(A, B) applies A then B. */
export function chain(...ms) {
  const out = new THREE.Matrix4();
  for (const m of ms) out.premultiply(m);
  return out;
}

/** Clone + transform. */
export function tx(geom, matrix) {
  return geom.clone().applyMatrix4(matrix);
}

// ---------- primitives -----------------------------------------------------

/**
 * Radius for an n-sided polygonal cross-section with the same AREA as a true circle of radius r.
 * Low-poly tubes/cylinders are inscribed polygons and would otherwise under-report metal volume
 * (8 sides: −10 %, 6 sides: −17 %).
 */
export function polyRadius(r, n) {
  return r * Math.sqrt((2 * Math.PI) / (n * Math.sin((2 * Math.PI) / n)));
}

const sphereK = new Map();
/** Same idea for UV spheres: scale so the polyhedron's volume equals 4/3·π·r³. */
function sphereRadius(r, ws, hs) {
  const key = `${ws}x${hs}`;
  if (!sphereK.has(key)) {
    const v = Math.abs(signedVolume(new THREE.SphereGeometry(1, ws, hs)));
    sphereK.set(key, Math.cbrt(((4 / 3) * Math.PI) / v));
  }
  return r * sphereK.get(key);
}

/** Capped cylinder from a to b. */
export function rod(a, b, r, seg = 8, r2 = r) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(dir.length(), 1e-4);
  const g = new THREE.CylinderGeometry(polyRadius(r2, seg), polyRadius(r, seg), len, seg, 1, false);
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  return g.applyMatrix4(alignY(dir, mid));
}

export function sphere(r, center = new THREE.Vector3(), ws = 10, hs = 7) {
  return new THREE.SphereGeometry(sphereRadius(r, ws, hs), ws, hs).translate(center.x, center.y, center.z);
}

/** Torus with its hole axis along `axis` (default Y → lies flat in XZ). */
export function torus(R, r, { axis = Y, center = new THREE.Vector3(), radial = 10, tubular = 48 } = {}) {
  const g = new THREE.TorusGeometry(R, polyRadius(r, radial), radial, tubular);
  const q = new THREE.Quaternion().setFromUnitVectors(Z, axis.clone().normalize());
  return g.applyMatrix4(new THREE.Matrix4().compose(center, q, new THREE.Vector3(1, 1, 1)));
}

/** Closed lathe solid about Y from a closed (r, y) polygon. */
export function latheClosed(points2, segments = 48) {
  const pts = points2.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first.x !== last.x || first.y !== last.y) pts.push(first.clone());
  return new THREE.LatheGeometry(pts, segments);
}

// ---------- part sets --------------------------------------------------------

/** Collects prepared geometries per named part (kind: 'metal' | 'stone'). */
export class PartSet {
  constructor() {
    this.parts = new Map();
  }
  add(name, kind, ...geoms) {
    let p = this.parts.get(name);
    if (!p) {
      p = { name, kind, geoms: [] };
      this.parts.set(name, p);
    }
    for (const g of geoms.flat(Infinity)) if (g) p.geoms.push(prep(g));
    return this;
  }
  metal(name, ...g) { return this.add(name, 'metal', ...g); }
  stone(name, ...g) { return this.add(name, 'stone', ...g); }
  /** Add another PartSet's contents transformed by `matrix`, with optional name prefix. */
  absorb(other, matrix = null) {
    for (const p of other.parts.values()) {
      this.add(p.name, p.kind, p.geoms.map((g) => (matrix ? tx(g, matrix) : g)));
    }
    return this;
  }
  applyMatrix4(m) {
    for (const p of this.parts.values()) for (const g of p.geoms) g.applyMatrix4(m);
    return this;
  }
  /** Merge per part → [{ name, kind, geometry }]. Stones last. */
  finalize() {
    const out = [];
    for (const p of this.parts.values()) if (p.geoms.length) out.push({ name: p.name, kind: p.kind, geometry: merge(p.geoms) });
    out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'metal' ? -1 : 1));
    return out;
  }
}

/** Tracks stones for spec sheets / quotes. */
export class StoneTally {
  constructor() {
    this.items = [];
  }
  add(role, diameterMm, count = 1) {
    if (count <= 0) return;
    const d = +diameterMm.toFixed(2);
    const hit = this.items.find((s) => s.role === role && s.diameterMm === d);
    if (hit) hit.count += count;
    else this.items.push({ role, diameterMm: d, count });
  }
  get count() {
    return this.items.reduce((a, s) => a + s.count, 0);
  }
}

export { THREE };
