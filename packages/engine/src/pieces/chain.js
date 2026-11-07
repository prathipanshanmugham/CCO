// Chains laid flat on a table (XZ plane, +Y up): curb, rope, box, figaro, cable and Miami cuban.
// Links are real closed solids (tubes along rounded-rect curves) placed with a per-link frame.
import * as THREE from 'three';
import { prep, basis, tx, S, RZ, polyRadius } from '../geometry/core.js';
import { RoundedRectCurve, FlatLoop } from '../geometry/curves.js';
import { gemAt, gemDims } from '../geometry/gem.js';

/** Closed link solid in its local frame: long axis X, loop in XY plane, flattened along Z by `flatten`. */
export function linkGeometry({ halfL, halfW, wireR, cornerR = halfW, tubular = 32, radial = 8, flatten = 1 }) {
  const curve = new RoundedRectCurve(halfL, halfW, cornerR);
  const g = new THREE.TubeGeometry(curve, tubular, polyRadius(wireR, radial), radial, true);
  if (flatten !== 1) g.applyMatrix4(S(1, 1, flatten));
  return prep(g);
}

/**
 * Place a sequence of links around a flat loop of centre-line `length`.
 * seq: [{ geom, pitch, roll }] where roll = rotation about the tangent (0 = lying flat).
 * Returns the per-link matrices (so callers can decorate links).
 */
export function layLinks(parts, partName, { length, ratio = 0.42, seq }) {
  const total = seq.reduce((a, l) => a + l.pitch, 0);
  const loop = new FlatLoop(length, ratio);
  const k = loop.length / total; // stretch pitches to close the loop exactly
  const mats = [];
  let s = 0;
  for (let i = 0; i < seq.length; i++) {
    const l = seq[i];
    const c = s + (l.pitch * k) / 2;
    s += l.pitch * k;
    const { P, T: Tg, N, U } = loop.frameAt(c);
    const y = N.clone().multiplyScalar(Math.cos(l.roll)).addScaledVector(U, Math.sin(l.roll));
    const z = new THREE.Vector3().crossVectors(Tg, y);
    const m = basis(Tg, y, z, P);
    if (l.preRotate) m.multiply(l.preRotate);
    mats.push(m);
    parts.metal(partName, tx(l.geom, m));
  }
  return { mats, loop };
}

/** Pick tube resolution so the whole chain stays within a triangle budget. */
function tubeRes(linkCount, budget = 120000) {
  const t6 = Math.floor(budget / (linkCount * 6 * 2));
  if (t6 >= 12) return { tubular: Math.min(40, t6), radial: 6 };
  return { tubular: Math.max(8, Math.min(40, Math.floor(budget / (linkCount * 4 * 2)))), radial: 4 };
}

export function buildChain(ctx) {
  const { p, rng, parts } = ctx;
  const g = p.gauge;
  const L = p.length;
  const style = p.style;
  let seq = [];

  if (style === 'rope') {
    // many small tilted links spiralling around the chain axis
    const wireR = g * 0.12;
    const halfL = g * 0.42, halfW = g * 0.26;
    const pitch = halfL * 2 * 0.3;
    const n = Math.round(L / pitch);
    const geom = linkGeometry({ halfL, halfW, wireR, ...tubeRes(n, 125000) });
    const tilt = rng.range(0.5, 0.7);
    const spin = (Math.PI * 2) / rng.pick([5, 6]);
    for (let i = 0; i < n; i++) seq.push({ geom, pitch, roll: i * spin, preRotate: RZ(tilt) });
  } else if (style === 'box') {
    // square box links, alternating 90°
    const R = g * 0.42, r = g * 0.11;
    const box = prep(new THREE.TorusGeometry(R, r, 4, 4).applyMatrix4(RZ(Math.PI / 4))); // square wire by design
    const pitch = (R * Math.SQRT2 - 2 * r) * 1.02;
    const n = 2 * Math.round(L / pitch / 2);
    for (let i = 0; i < n; i++) seq.push({ geom: box, pitch, roll: i % 2 ? Math.PI / 2 : 0 });
  } else {
    // curb & figaro: flat, twisted links alternating ±roll
    const wireR = g * 0.14;
    const halfW = g / 2 - wireR;
    const short = { halfL: halfW * 1.42, halfW, wireR };
    const long = { halfL: halfW * 2.9, halfW, wireR };
    const pattern = style === 'figaro' ? [short, short, short, long] : [short];
    const pitchOf = (d) => 2 * (d.halfL - d.wireR) * 0.98;
    const patPitch = pattern.reduce((a, d) => a + pitchOf(d), 0);
    const reps = Math.max(1, Math.round(L / patPitch / (pattern.length % 2 ? 2 : 1))) * (pattern.length % 2 ? 2 : 1);
    const n = reps * pattern.length;
    const res = tubeRes(n * (style === 'figaro' ? 1.1 : 1), 120000);
    const geoms = pattern.map((d) => linkGeometry({ ...d, tubular: Math.round(res.tubular * (d === long ? 1.4 : 1)), radial: res.radial, flatten: 0.8 }));
    const roll = rng.range(0.3, 0.42);
    for (let i = 0; i < n; i++) {
      const j = i % pattern.length;
      seq.push({ geom: geoms[j], pitch: pitchOf(pattern[j]), roll: i % 2 ? roll : -roll });
    }
  }
  layLinks(parts, 'chain', { length: L, ratio: 0.42, seq });
  ctx.meta.linkCount = seq.length;
}

export function buildCuban(ctx) {
  const { p, rng, parts, stones, hasStone } = ctx;
  const W = p.width;
  const L = p.length;
  const wireR = W * 0.13;
  const flatten = 0.72;
  const halfW = W / 2 - wireR;
  const halfL = W * 0.5 - wireR;
  const cornerR = wireR * 1.25;
  const pitch = 2 * (halfL - wireR) * 1.0;
  const n = 2 * Math.round(L / pitch / 2);
  const pave = hasStone ? p.pave : 'none';
  // pavé layout first, so the triangle budget can be split between stones, domes and links
  const straight = 2 * (halfL - cornerR);
  const ps = +Math.max(0.8, Math.min(2.2, wireR * 1.05)).toFixed(2);
  const perSide = Math.max(1, Math.floor((straight + ps * 0.5) / (ps * 1.08)));
  const sidesPerLink = pave === 'full' ? 2 : pave === 'single-row' ? 1 : 0;
  const stoneTotal = n * sidesPerLink * perSide;
  const stoneSeg = stoneTotal * 48 > 30000 ? 6 : 8;
  const domeRadial = n > 160 ? 6 : 8;
  const domeTris = n * sidesPerLink * (2 * 3 + 1) * domeRadial * 2;
  const linkBudget = Math.max(30000, 140000 - stoneTotal * stoneSeg * 6 - domeTris);
  const radial = n > 200 ? 6 : 8;
  const tubular = Math.max(12, Math.min(56, Math.floor(linkBudget / (n * radial * 2))));
  const geom = linkGeometry({ halfL, halfW, wireR, cornerR, tubular, radial, flatten });
  const roll = rng.range(0.28, 0.38);
  const seq = [];
  for (let i = 0; i < n; i++) seq.push({ geom, pitch, roll: i % 2 ? roll : -roll });
  const { mats } = layLinks(parts, 'links', { length: L, ratio: 0.42, seq });

  if (pave !== 'none') {
    // pavé domes along the long sides of each link (local ±Y), stones facing local +Z (up)
    const domeR = wireR * 0.62;
    const zTop = wireR * flatten;
    const gd = gemDims(ps);
    const domeLen = Math.max(0.1, perSide * ps * 1.08 - domeR);
    const dome = prep(new THREE.CapsuleGeometry(domeR, domeLen, 3, domeRadial).applyMatrix4(RZ(Math.PI / 2)).applyMatrix4(S(1, 1, 0.6)));
    const up = new THREE.Vector3(0, 0, 1);
    const sideStones = [];
    const domes = [];
    for (const side of [1, -1]) {
      domes[side] = tx(dome, new THREE.Matrix4().makeTranslation(0, side * halfW, zTop * 0.55));
      const arr = [];
      for (let k = 0; k < perSide; k++) {
        const x = (k - (perSide - 1) / 2) * ps * 1.08;
        arr.push(gemAt(ps, new THREE.Vector3(x, side * halfW, zTop * 0.55 + domeR * 0.6 + gd.pavilionH * 0.35), up, stoneSeg));
      }
      sideStones[side] = arr;
    }
    let count = 0;
    for (let i = 0; i < mats.length; i++) {
      // single-row: only the raised side of each link; full: both sides
      const raised = i % 2 ? 1 : -1;
      const sides = pave === 'full' ? [1, -1] : [raised];
      for (const side of sides) {
        parts.metal('domes', tx(domes[side], mats[i]));
        for (const s of sideStones[side]) parts.stone('stones', tx(s, mats[i]));
        count += perSide;
      }
    }
    stones.add('pave', ps, count);
  }
  ctx.meta.linkCount = n;
}

