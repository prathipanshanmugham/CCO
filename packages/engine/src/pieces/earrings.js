// Earrings (always a pair): studs, hoops, drops. Face toward +Z, posts toward -Z.
import * as THREE from 'three';
import { PartSet, torus, rod, sphere, RX, T, chain, tx } from '../geometry/core.js';
import { gemDims, gemGeometry, prongSetting, bezelCup, gemAt } from '../geometry/gem.js';
import { outline, slab } from './pendant.js';

const Zaxis = new THREE.Vector3(0, 0, 1);

/** Post (ear wire) running back along -Z from (x, y, z0). */
function post(x, y, z0, len = 10, r = 0.4) {
  return [rod(new THREE.Vector3(x, y, z0), new THREE.Vector3(x, y, z0 - len), r, 10), sphere(r * 1.05, new THREE.Vector3(x, y, z0 - len), 8, 6)];
}

function buildOne(ctx, one, tally) {
  const { p, rng, hasStone } = ctx;
  const th = p.thickness;

  if (p.style === 'hoop') {
    const D = p.sizeMm;
    const r = th / 2;
    const R = D / 2 - r;
    one.metal('hoop', torus(R, r, { axis: Zaxis, radial: 12, tubular: 96 }));
    one.metal('hoop', post(0, R, 0, 9, 0.4));
    if (hasStone) {
      // inside-out pavé on the front of the lower arc
      const ps = Math.min(Math.max(0.9, th * 0.75), 2.4);
      const span = (rng.range(110, 150) * Math.PI) / 180;
      const count = Math.max(3, Math.floor((span * R) / (ps * 1.1)));
      const g = gemDims(ps);
      for (let i = 0; i < count; i++) {
        const a = -Math.PI / 2 - span / 2 + (span * (i + 0.5)) / count;
        const pos = new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, r * 0.55 + g.pavilionH * 0.35);
        one.stone('stones', gemAt(ps, pos, Zaxis, 8));
      }
      tally.add('pave', ps, count);
    }
    return { width: D, height: D };
  }

  if (p.style === 'drop') {
    const L = p.sizeMm;
    // top stud
    const ts = Math.max(2, Math.min(p.stoneMm * 0.5, 3.5));
    const cup = bezelCup(ts);
    const toFace = RX(Math.PI / 2);
    const topY = 0;
    one.metal('setting', tx(cup.geometry, chain(toFace, T(0, topY, 0))));
    if (hasStone) {
      one.stone('stones', tx(gemGeometry(ts, 12), chain(toFace, T(0, topY, 0))));
      tally.add('top', ts, 1);
    }
    one.metal('setting', post(0, topY, cup.bottomY, 10, 0.4));
    // jump ring
    const jr = Math.max(1.0, th * 0.9), jt = Math.max(0.35, th * 0.25);
    const jy = topY - cup.outerR - jr + jt;
    one.metal('setting', torus(jr, jt, { axis: new THREE.Vector3(1, 0, 0), center: new THREE.Vector3(0, jy, 0), radial: 8, tubular: 32 }));
    // body
    const bodyH = Math.max(6, L - (topY - jy) - jr - 1);
    const bodyW = bodyH / outline('teardrop', 1).H;
    const o = outline('teardrop', bodyW);
    const pts = o.pts;
    const bodyTop = jy - jr + jt * 1.5;
    const cy = bodyTop - o.H / 2;
    const d = Math.min(p.stoneMm, bodyW * 0.72);
    const g = gemDims(d);
    const holes = [];
    if (hasStone) {
      const hr = g.r * 0.82;
      const hole = [];
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2; // CCW: three.js mis-caps clockwise holes when bevelled
        hole.push(new THREE.Vector2(o.centroid.x + Math.cos(a) * hr, o.centroid.y + Math.sin(a) * hr));
      }
      holes.push(hole);
    }
    const bodyTh = Math.max(1.2, th);
    one.metal('body', slab(pts, bodyTh, holes).translate(0, cy, 0));
    if (hasStone) {
      one.stone('stones', gemAt(d, new THREE.Vector3(o.centroid.x, cy + o.centroid.y, bodyTh / 2 - g.crownH * 0.2), Zaxis, 16));
      // four claws over the girdle
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + (k * Math.PI) / 2;
        const base = new THREE.Vector3(o.centroid.x + Math.cos(a) * (g.r + 0.3), cy + o.centroid.y + Math.sin(a) * (g.r + 0.3), bodyTh / 2 - 0.2);
        const tip = new THREE.Vector3(o.centroid.x + Math.cos(a) * (g.r - 0.15), cy + o.centroid.y + Math.sin(a) * (g.r - 0.15), bodyTh / 2 + g.crownH * 0.6);
        one.metal('setting', rod(base, tip, 0.35, 8), sphere(0.38, tip, 8, 6));
      }
      tally.add('drop', d, 1);
    }
    return { width: bodyW, height: L };
  }

  // stud
  const d = p.stoneMm;
  const g = gemDims(d);
  const prongs = rng.chance(0.4) ? 6 : 4;
  const baseY = -(g.pavilionH + g.girdleH / 2 + 0.6);
  const toFace = RX(Math.PI / 2); // local +Y → +Z
  if (hasStone) {
    one.metal('setting', prongSetting({ d, prongs, baseY, girdleY: 0, baseSpread: d * 0.26, angle: prongs === 4 ? Math.PI / 4 : 0 }).map((geom) => tx(geom, toFace)));
    one.metal('setting', tx(torus(d * 0.26, 0.35, { radial: 6, tubular: 24, center: new THREE.Vector3(0, baseY, 0) }), toFace));
    one.stone('stones', tx(gemGeometry(d, 16), toFace));
    tally.add('center', d, 1);
  } else {
    // polished metal ball stud
    one.metal('setting', sphere(d / 2, new THREE.Vector3(0, 0, -baseY * 0.4), 24, 16));
  }
  one.metal('setting', post(0, 0, baseY, 10, 0.4));
  return { width: d, height: d };
}

export function buildEarrings(ctx) {
  const one = new PartSet();
  const dims = buildOne(ctx, one, ctx.stones);
  const gap = Math.max(dims.width, 6) + 8;
  // second earring: same piece translated (not mirrored → orientation stays outward)
  ctx.parts.absorb(one, T(-gap / 2, 0, 0));
  ctx.parts.absorb(one, T(gap / 2, 0, 0));
  for (const s of ctx.stones.items) s.count *= 2;
  ctx.meta.pair = true;
}
