// Bracelets lying flat (XZ plane, +Y up): cable link, tennis line, open cuff.
import * as THREE from 'three';
import { prep, rod, sphere, tx, RX, latheClosed } from '../geometry/core.js';
import { gemGeometry, gemDims, bezelCup } from '../geometry/gem.js';
import { linkGeometry, layLinks } from './chain.js';

export function buildBracelet(ctx) {
  const { p, rng, hasStone, parts, stones } = ctx;
  const L = p.length;
  const u = p.linkWidth;

  if (p.style === 'link') {
    const wireR = u * 0.13;
    const halfW = u / 2 - wireR;
    const halfL = halfW * rng.range(1.4, 1.7);
    const pitch = 2 * (halfL - wireR);
    const n = 2 * Math.round(L / pitch / 2);
    const geom = linkGeometry({ halfL, halfW, wireR, tubular: 40, radial: 10 });
    const seq = [];
    for (let i = 0; i < n; i++) seq.push({ geom, pitch, roll: i % 2 ? Math.PI / 2 : 0 });
    layLinks(parts, 'links', { length: L, ratio: 0.82, seq });
    ctx.meta.linkCount = n;
    return;
  }

  if (p.style === 'bangle-cuff') {
    const th = Math.max(1.4, Math.min(2.6, u * 0.32));
    const R = (L / (2 * Math.PI)) * 0.95;
    const gap = (rng.range(40, 55) * Math.PI) / 180;
    const a0 = Math.PI / 2 + gap / 2;
    const a1 = Math.PI / 2 - gap / 2 + Math.PI * 2;
    const shape = new THREE.Shape();
    const Ro = R + th;
    const mid = R + th / 2;
    shape.moveTo(Math.cos(a0) * Ro, Math.sin(a0) * Ro);
    shape.absarc(0, 0, Ro, a0, a1, false);
    shape.absarc(Math.cos(a1) * mid, Math.sin(a1) * mid, th / 2, a1, a1 + Math.PI, false);
    shape.absarc(0, 0, R, a1, a0, true);
    shape.absarc(Math.cos(a0) * mid, Math.sin(a0) * mid, th / 2, a0 + Math.PI, a0 + Math.PI * 2, false);
    const bev = Math.min(0.5, u * 0.12);
    const depth = Math.max(0.2, u - 2 * bev);
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 3, curveSegments: 72, steps: 1 });
    g.translate(0, 0, -depth / 2).applyMatrix4(RX(-Math.PI / 2)); // lie flat, width vertical, opening at the back
    parts.metal('cuff', g);
    if (hasStone) {
      // three bezel-set stones on the front face (+Z)
      const d = Math.min(u * 0.6, 6);
      const cup = bezelCup(d);
      for (const k of [-1, 0, 1]) {
        const a = k * ((d + 1.2) / Ro);
        const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        const m = new THREE.Matrix4().compose(dir.clone().multiplyScalar(Ro - cup.bottomY - 0.3), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), new THREE.Vector3(1, 1, 1));
        parts.metal('cuff', tx(cup.geometry, m));
        parts.stone('stones', tx(gemGeometry(d, 16), m));
      }
      stones.add('center', d, 3);
    }
    return;
  }

  // tennis: square baskets, each with a stone and four corner claws, hinged underneath
  const side = u;
  const pitch = side * 1.06;
  const n = Math.round(L / pitch);
  const d = +(side * 0.84).toFixed(2);
  const g = gemDims(d);
  const cupH = Math.max(1.2, g.pavilionH + 0.3);
  const Rt = (side / 2) * Math.SQRT2;
  const basket = prep(new THREE.CylinderGeometry(Rt, Rt * 0.72, cupH, 4, 1, false).rotateY(Math.PI / 4).translate(0, -cupH / 2, 0));
  const claws = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    claws.push(prep(sphere(side * 0.11, new THREE.Vector3(sx * side * 0.42, g.girdleH + g.crownH * 0.3, sz * side * 0.42), 8, 6)));
    claws.push(prep(rod(new THREE.Vector3(sx * side * 0.45, -0.2, sz * side * 0.45), new THREE.Vector3(sx * side * 0.42, g.girdleH + g.crownH * 0.3, sz * side * 0.42), side * 0.08, 6)));
  }
  const hinge = prep(rod(new THREE.Vector3(-pitch * 0.55, -cupH * 0.6, 0), new THREE.Vector3(pitch * 0.55, -cupH * 0.6, 0), Math.max(0.3, side * 0.11), 8));
  const gem = hasStone ? prep(gemGeometry(d, 16).translate(0, g.girdleH * 0.5, 0)) : null;
  const dome = hasStone ? null : prep(domeSolid(side * 0.42));
  const seq = [];
  for (let i = 0; i < n; i++) seq.push({ geom: basket, pitch, roll: Math.PI / 2 });
  // roll = 90° → local Y is world up, so the baskets stand upright with stones facing up
  const { mats } = layLinks(parts, 'settings', { length: L, ratio: 0.82, seq });
  for (const m of mats) {
    parts.metal('settings', claws.map((c) => tx(c, m)), tx(hinge, m));
    if (gem) parts.stone('stones', tx(gem, m));
    else parts.metal('settings', tx(dome, m));
  }
  if (hasStone) stones.add('line', d, n);
  ctx.meta.linkCount = n;
}

/** Closed half-dome (lathe), flat face down at y = 0. */
function domeSolid(r) {
  const pts = [[0, 0]];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    pts.push([r * Math.cos(a), r * 0.7 * Math.sin(a)]);
  }
  return latheClosed(pts, 24);
}
