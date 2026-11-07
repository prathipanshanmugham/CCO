// Bangles standing upright (axis along Z, like the ring): plain, faceted, dotted, stone-set.
import * as THREE from 'three';
import { latheClosed, flat, RX, sphere } from '../geometry/core.js';
import { gemAt, bead } from '../geometry/gem.js';
import { bandProfile } from './ring.js';

const PLAIN = { aOut: 0.72, nOut: 2.6, nIn: 3 };

export function buildBangle(ctx) {
  const { p, rng, hasStone, parts, stones } = ctx;
  const Ri = p.innerDiameter / 2;
  const w = p.width;
  const t = p.thickness;
  const Ro = Ri + t;
  let pattern = p.pattern;
  if (pattern === 'stone-set' && !hasStone) pattern = 'dotted';

  if (pattern === 'faceted') {
    const segs = rng.pick([12, 16, 20, 24]);
    const prof = bandProfile(Ri, w, t, { aOut: 0.75, nOut: 1.6, nIn: 4 }, rng.pick([8, 10]));
    const g = latheClosed(prof, segs).applyMatrix4(RX(Math.PI / 2));
    parts.metal('bangle', flat(g));
    ctx.meta.facets = segs;
    return;
  }

  const spec = pattern === 'stone-set' ? { aOut: 0.72, nOut: 4.5, nIn: 3 } : PLAIN;
  parts.metal('bangle', latheClosed(bandProfile(Ri, w, t, spec, 40), 160).applyMatrix4(RX(Math.PI / 2)));

  if (pattern === 'dotted') {
    const r = Math.max(0.5, Math.min(w, t) * rng.range(0.22, 0.3));
    const rows = w >= 9 ? 2 : 1;
    const count = Math.floor((2 * Math.PI * Ro) / (r * 3.4));
    for (let row = 0; row < rows; row++) {
      const z = rows === 1 ? 0 : (row ? 1 : -1) * w * 0.22;
      for (let i = 0; i < count; i++) {
        const a = ((i + (row ? 0.5 : 0)) / count) * Math.PI * 2;
        const rr = Ro - r * 0.35 - (rows === 2 ? t * 0.08 : 0);
        parts.metal('bangle', sphere(r, new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, z), 8, 6));
      }
    }
    return;
  }

  if (pattern === 'stone-set') {
    const ps = Math.max(1.2, Math.min(3.5, w * 0.5, t * 1.4));
    const pitch = ps * 1.12;
    const count = Math.floor((2 * Math.PI * Ro) / pitch);
    const Rg = Ro - ps * 0.12;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
      parts.stone('stones', gemAt(ps, dir.clone().multiplyScalar(Rg), dir, 8));
      const b = a + Math.PI / count;
      for (const z of [-1, 1]) parts.metal('bangle', bead(ps * 0.17, new THREE.Vector3(Math.cos(b) * (Ro + 0.02), Math.sin(b) * (Ro + 0.02), z * ps * 0.42)));
    }
    stones.add('channel', ps, count);
  }
}
