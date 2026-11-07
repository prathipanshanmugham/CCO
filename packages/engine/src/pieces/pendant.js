// Pendants: bevelled extruded outlines with set stones and a bail.
// Frame: pendant face toward +Z, bail on top (+Y).
import * as THREE from 'three';
import { torus, latheClosed, RX, RZ, T, chain, tx } from '../geometry/core.js';
import { gemDims, gemGeometry, prongSetting, bead } from '../geometry/gem.js';

/** Unit outline points (any scale), later normalised to width. */
function rawOutline(shape) {
  const pts = [];
  const N = 120;
  if (shape === 'heart') {
    const s = new THREE.Shape();
    s.moveTo(5, 5);
    s.bezierCurveTo(5, 5, 4, 0, 0, 0);
    s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
    s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
    s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
    s.bezierCurveTo(16, 7, 16, 0, 10, 0);
    s.bezierCurveTo(7, 0, 5, 5, 5, 5);
    for (const v of s.getSpacedPoints(N)) pts.push([v.x, -v.y]); // point down
    pts.pop();
  } else if (shape === 'teardrop') {
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      pts.push([Math.sin(t) * Math.abs(Math.sin(t / 2)) ** 1.4, Math.cos(t) * 1.35]);
    }
  } else if (shape === 'oval') {
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      pts.push([Math.cos(t), Math.sin(t) * 1.32]);
    }
  } else if (shape === 'cross') {
    const a = 0.15, top = 0.62, bot = -0.95, arm = 0.5, ay = 0.22;
    const corner = [
      [-a, top], [a, top], [a, ay + a], [arm, ay + a], [arm, ay - a], [a, ay - a], [a, bot], [-a, bot],
      [-a, ay - a], [-arm, ay - a], [-arm, ay + a], [-a, ay + a],
    ];
    // slightly rounded corners: chamfer each vertex
    for (let i = 0; i < corner.length; i++) {
      const p = corner[i], prev = corner[(i + corner.length - 1) % corner.length], next = corner[(i + 1) % corner.length];
      const k = 0.025;
      const toPrev = [prev[0] - p[0], prev[1] - p[1]], toNext = [next[0] - p[0], next[1] - p[1]];
      const lp = Math.hypot(...toPrev), ln = Math.hypot(...toNext);
      pts.push([p[0] + (toPrev[0] / lp) * k, p[1] + (toPrev[1] / lp) * k]);
      pts.push([p[0] + (toNext[0] / ln) * k, p[1] + (toNext[1] / ln) * k]);
    }
  } else {
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      pts.push([Math.cos(t), Math.sin(t)]);
    }
  }
  return pts;
}

/** Outline scaled to `width` mm and centred on its bounding box. Returns {pts, H, centroid, topAt0}. */
export function outline(shape, width) {
  const raw = rawOutline(shape);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of raw) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const s = width / (maxX - minX);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const pts = raw.map(([x, y]) => new THREE.Vector2((x - cx) * s, (y - cy) * s));
  const H = (maxY - minY) * s;
  // polygon centroid
  let A = 0, Cx = 0, Cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const cr = a.x * b.y - b.x * a.y;
    A += cr; Cx += (a.x + b.x) * cr; Cy += (a.y + b.y) * cr;
  }
  const centroid = new THREE.Vector2(Cx / (3 * A), Cy / (3 * A));
  if (shape === 'cross') centroid.set(0, (0.22 - cy) * s); // stone at the arm intersection
  let topAt0 = -Infinity;
  for (const v of pts) if (Math.abs(v.x) < width * 0.08) topAt0 = Math.max(topAt0, v.y);
  if (!Number.isFinite(topAt0)) topAt0 = H / 2;
  return { pts, H, centroid, topAt0 };
}

/** Bevelled slab of the outline, centred in Z (front face at +th/2). */
export function slab(pts, th, holes = []) {
  const shape = new THREE.Shape(pts);
  for (const h of holes) shape.holes.push(new THREE.Path(h));
  const bev = Math.min(0.45, th * 0.25);
  const depth = Math.max(0.05, th - 2 * bev);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.85, bevelSegments: 3, curveSegments: 12, steps: 1 });
  return g.translate(0, 0, -depth / 2);
}

/** Tube bail / annulus along X: closed lathe of a rectangle, rotated so its axis is X. */
export function tubeBail(ri, ro, len) {
  return latheClosed([[ri, -len / 2], [ro, -len / 2], [ro, len / 2], [ri, len / 2]], 32).applyMatrix4(RZ(Math.PI / 2));
}

/**
 * Face-mounted stone (table toward +Z) with a prong head. Local frame: girdle at y = 0,
 * metal face at y = -sink. Returns matrix mapping that frame onto the pendant face at (x, y).
 */
export function faceMount(x, y, faceZ, sink) {
  return chain(RX(Math.PI / 2), T(x, y, faceZ + sink));
}

export function buildPendant(ctx) {
  const { p, rng, hasStone, parts, stones } = ctx;
  const W = p.width;
  const th = p.thickness;
  const o = outline(p.shape, W);
  parts.metal('body', slab(o.pts, th));
  const face = th / 2;
  const setting = hasStone ? p.stone : 'none';

  if (setting !== 'none') {
    const halo = setting === 'halo';
    const maxD = halo ? W * 0.38 : W * 0.55;
    let d = Math.min(p.stoneMm, maxD);
    if (p.shape === 'cross') d = Math.min(d, W * 0.3 * (halo ? 0.6 : 1));
    const g = gemDims(d);
    const sink = g.pavilionH * 0.55;
    const m = faceMount(o.centroid.x, o.centroid.y, face, sink);
    const prongs = rng.chance(0.5) ? 4 : 6;
    const head = prongSetting({ d, prongs, baseY: -sink - 0.25, girdleY: 0, baseSpread: d * 0.32, angle: prongs === 4 ? Math.PI / 4 : 0, gallery: false });
    parts.metal('setting', head.map((geom) => tx(geom, m)));
    parts.metal('setting', tx(torus(d * 0.36, Math.max(0.25, d * 0.06), { radial: 6, tubular: 32, center: new THREE.Vector3(0, -sink + 0.05, 0) }), m));
    parts.stone('stones', tx(gemGeometry(d, 16), m));
    stones.add('center', d, 1);
    if (halo) {
      const hs = Math.min(1.5, Math.max(0.8, d * 0.24));
      const R = g.r + hs / 2 + 0.3;
      const count = Math.max(8, Math.floor((2 * Math.PI * R) / (hs * 1.12)));
      const hg = gemDims(hs);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const x = o.centroid.x + Math.cos(a) * R, y = o.centroid.y + Math.sin(a) * R;
        parts.stone('stones', gemGeometry(hs, 8).applyMatrix4(RX(Math.PI / 2)).translate(x, y, face + hg.pavilionH * 0.8));
        const b = a + Math.PI / count;
        parts.metal('setting', bead(hs * 0.18, new THREE.Vector3(o.centroid.x + Math.cos(b) * (R + hs * 0.3), o.centroid.y + Math.sin(b) * (R + hs * 0.3), face + hg.pavilionH * 0.8 + hs * 0.08)));
      }
      parts.metal('setting', torus(R, hs * 0.5, { axis: new THREE.Vector3(0, 0, 1), center: new THREE.Vector3(o.centroid.x, o.centroid.y, face), radial: 6, tubular: count * 3 }));
      stones.add('halo', hs, count);
    }
  }

  // ---- bail -----------------------------------------------------------------
  const top = o.topAt0;
  if (p.bail === 'tube') {
    const ri = 1.4, ro = ri + Math.max(0.5, th * 0.35);
    const len = Math.min(W * 0.35, 5);
    parts.metal('bail', tubeBail(ri, ro, len).translate(0, top + ri + 0.1, 0));
  } else if (p.bail === 'hidden') {
    const R = 1.6, r = Math.max(0.45, th * 0.28);
    parts.metal('bail', torus(R, r, { axis: new THREE.Vector3(1, 0, 0), center: new THREE.Vector3(0, top - R - 1.2, -face - R + r * 1.6), radial: 8, tubular: 32 }));
  } else {
    const R = Math.max(1.7, th * 1.1), r = Math.max(0.45, th * 0.32);
    parts.metal('bail', torus(R, r, { axis: new THREE.Vector3(1, 0, 0), center: new THREE.Vector3(0, top + R - r * 0.8, 0), radial: 8, tubular: 40 }));
  }
}
