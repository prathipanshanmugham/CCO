// Round brilliant approximation + reusable stone settings (prongs, bezels, beads).
import * as THREE from 'three';
import { rod, sphere, torus, latheClosed, flat } from './core.js';

/** Proportions of a round brilliant (fractions of girdle diameter). */
export function gemDims(d) {
  return {
    d,
    r: d / 2,
    tableR: d * 0.28, // 56 % table
    crownH: d * 0.15,
    girdleH: Math.max(0.02, d * 0.03),
    pavilionH: d * 0.43,
  };
}

const gemCache = new Map();

/**
 * Low-poly round brilliant: octagonal-ish table, star/kite crown facets, girdle band and a
 * pavilion cone to the culet. Girdle centred on y = 0, table up (+Y). Closed, flat-shaded.
 * 6·segments triangles (16 → 96 tris).
 */
export function gemGeometry(diameterMm, segments = 16) {
  const n = Math.max(6, Math.round(segments));
  const key = `${diameterMm.toFixed(4)}:${n}`;
  const cached = gemCache.get(key);
  if (cached) return cached.clone();

  const { r, tableR, crownH, girdleH, pavilionH } = gemDims(diameterMm);
  const yT = girdleH / 2 + crownH;
  const yG = girdleH / 2;
  const yB = -girdleH / 2;
  const yC = yB - pavilionH;
  const step = (Math.PI * 2) / n;
  const ringPt = (rad, y, a) => [rad * Math.cos(a), y, rad * Math.sin(a)];
  const T0 = [0, yT, 0];
  const C = [0, yC, 0];
  const t = [], g = [], b = [];
  for (let i = 0; i < n; i++) {
    t.push(ringPt(tableR, yT, (i + 0.5) * step));
    g.push(ringPt(r, yG, i * step));
    b.push(ringPt(r, yB, i * step));
  }
  const pos = [];
  const tri = (p, q, s) => pos.push(...p, ...q, ...s);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tri(T0, t[i], t[j]); // table
    tri(t[i], g[i], g[j]); // crown kite (lower)
    tri(t[i], g[j], t[j]); // crown star (upper)
    tri(g[i], b[i], b[j]); // girdle
    tri(g[i], b[j], g[j]);
    tri(C, b[j], b[i]); // pavilion
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.computeVertexNormals(); // non-indexed → flat facets
  gemCache.set(key, geom);
  return geom.clone();
}

/**
 * Prong head in a local frame: stone girdle at y = girdleY, prongs rise from `baseY`.
 * Returns metal geometries (prongs, tip beads, gallery rail).
 */
export function prongSetting({ d, prongs = 4, prongR, baseY, girdleY = 0, baseSpread, angle = Math.PI / 4, gallery = true }) {
  const g = gemDims(d);
  const pr = prongR ?? Math.min(0.6, Math.max(0.3, d * 0.075));
  const spread = baseSpread ?? d * 0.22;
  const out = [];
  const tipY = girdleY + g.girdleH / 2 + g.crownH * 0.55;
  const outR = g.r + pr * 0.55;
  for (let k = 0; k < prongs; k++) {
    const a = angle + (k * Math.PI * 2) / prongs;
    const c = Math.cos(a), s = Math.sin(a);
    const bottom = new THREE.Vector3(c * spread, baseY, s * spread);
    const mid = new THREE.Vector3(c * outR, girdleY, s * outR);
    const tip = new THREE.Vector3(c * (g.r - pr * 0.2), tipY, s * (g.r - pr * 0.2));
    out.push(rod(bottom, mid, pr, 8, pr * 0.95));
    out.push(rod(mid, tip, pr * 0.95, 8, pr * 0.85));
    out.push(sphere(pr * 0.98, mid, 8, 6));
    out.push(sphere(pr * 1.05, tip, 8, 6));
  }
  if (gallery && girdleY - baseY > pr * 3) {
    const gy = girdleY - g.pavilionH * 0.45;
    const t = (gy - baseY) / (girdleY - baseY);
    const R = spread + (outR - spread) * t;
    out.push(torus(R, pr * 0.7, { center: new THREE.Vector3(0, gy, 0), radial: 6, tubular: 32 }));
  }
  return out;
}

/**
 * Bezel cup (closed lathe) holding a stone whose girdle is at y = 0.
 * Solid bottom; inner cone follows the pavilion. Returns { geometry, bottomY }.
 */
export function bezelCup(d, { wall = Math.max(0.45, d * 0.09), segments = 32 } = {}) {
  const g = gemDims(d);
  const ri = g.r - Math.min(0.15, d * 0.04); // lip overlaps the girdle
  const ro = g.r + wall;
  const top = g.girdleH / 2 + g.crownH * 0.3;
  const floorY = -(g.girdleH / 2 + g.pavilionH + 0.15);
  const bottom = floorY - Math.max(0.35, wall * 0.7);
  const pts = [
    [ri, top],
    [ro, top],
    [ro, top - 0.2],
    [ro * 0.9, bottom],
    [0, bottom],
    [0, floorY],
    [g.r * 0.95, -g.girdleH],
    [ri, -g.girdleH * 0.2],
  ];
  return { geometry: latheClosed(pts, segments), bottomY: bottom, topY: top, outerR: ro };
}

/** Small beads ("grains") used between pavé stones. */
export function bead(r, center) {
  return sphere(r, center, 6, 4);
}

/** Stone + its gem geometry, placed with table toward `dir` and girdle centre at `pos`. */
export function gemAt(d, pos, dir, segments = 16, spin = 0) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  if (spin) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin));
  return gemGeometry(d, segments).applyMatrix4(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1)));
}

export { flat };
