// Rings: lathe-profiled bands (D / comfort / knife / pavé), twisted wire bands, and heads.
// Frame: finger axis along Z, band in the XY plane, head on top (+Y).
import * as THREE from 'three';
import { latheClosed, torus, rod, RX, RZ, tx, polyRadius } from '../geometry/core.js';
import { gemDims, gemGeometry, prongSetting, bezelCup, bead, gemAt } from '../geometry/gem.js';
import { TwistStrandCurve } from '../geometry/curves.js';
import { ringSizeToDiameterMm } from '../params.js';

const sgnpow = (v, e) => Math.sign(v) * Math.abs(v) ** e;

/** Band cross-section specs: amplitude fractions of thickness + superellipse exponents. */
const PROFILES = {
  plain: { aOut: 0.8, nOut: 2.4, nIn: 8 }, // classic D: domed outside, flat inside
  comfort: { aOut: 0.7, nOut: 2.4, nIn: 2.4 }, // domed both sides (comfort fit)
  knife: { aOut: 0.85, nOut: 1.15, nIn: 6 }, // ridge on top
  pave: { aOut: 0.75, nOut: 4.5, nIn: 2.4 }, // flatter top for a stone row
};

/**
 * Closed (r, axial) profile for a band of inner radius Ri, width w, thickness t.
 * Exported for bangles.
 */
export function bandProfile(Ri, w, t, spec, n = 48) {
  const aOut = spec.aOut * t;
  const aIn = t - aOut;
  const rc = Ri + aIn;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const c = Math.cos(th), s = Math.sin(th);
    const outer = c >= 0;
    const e = 2 / (outer ? spec.nOut : spec.nIn);
    pts.push([rc + (outer ? aOut : aIn) * sgnpow(c, e), (w / 2) * sgnpow(s, e)]);
  }
  return pts;
}

/** Band solid with axis along Z. */
export function bandSolid(Ri, w, t, spec, { segments = 96, profilePts = 48 } = {}) {
  return latheClosed(bandProfile(Ri, w, t, spec, profilePts), segments).applyMatrix4(RX(Math.PI / 2));
}

export function buildRing(ctx) {
  const { p, rng, hasStone, parts, stones } = ctx;
  const Ri = ringSizeToDiameterMm(p.size) / 2;
  const w = p.bandWidth;
  const t = p.bandThickness;
  const Ro = Ri + t;
  const head = hasStone ? p.head : 'none';
  let profile = p.profile;

  // ---- band --------------------------------------------------------------
  if (profile === 'twisted') {
    const strands = rng.chance(0.5) ? 2 : 3;
    const rs = Math.min(w, t) * (strands === 2 ? 0.34 : 0.3);
    const ar = Math.max(0.05, t / 2 - rs);
    const az = Math.max(0.05, w / 2 - rs);
    const Rm = Ri + t / 2;
    const twists = Math.max(6, Math.round((2 * Math.PI * Rm) / (w * rng.range(2.0, 2.8))));
    const tubular = Math.min(900, twists * 22);
    for (let k = 0; k < strands; k++) {
      const curve = new TwistStrandCurve(Rm, ar, az, twists, (k * Math.PI * 2) / strands);
      parts.metal('band', new THREE.TubeGeometry(curve, tubular, polyRadius(rs, 8), 8, true));
    }
    // hidden core keeps the strands fused into one castable solid
    parts.metal('band', torus(Rm, Math.min(ar, az) + rs * 0.55, { axis: new THREE.Vector3(0, 0, 1), radial: 8, tubular: 96 }));
  } else {
    parts.metal('band', bandSolid(Ri, w, t, PROFILES[profile] || PROFILES.comfort));
  }

  // ---- head ---------------------------------------------------------------
  const d = p.stoneMm;
  const g = gemDims(d);
  const girdleY = Ro + g.girdleH / 2 + g.pavilionH + 0.35;
  const prongR = Math.min(0.6, Math.max(0.35, d * 0.075));
  const prongCount = rng.chance(0.5) ? 6 : 4;
  const baseY = Ro - 0.35;
  const spread = Math.min(d * 0.24, w * 0.42);
  let headClearMm = 0;

  const addCenter = (n, extraGallery = true) => {
    parts.metal('head', prongSetting({ d, prongs: n, prongR, baseY, girdleY, baseSpread: spread, angle: n === 4 ? Math.PI / 4 : 0, gallery: extraGallery }));
    parts.stone('stones', gemGeometry(d, 16).translate(0, girdleY, 0));
    stones.add('center', d, 1);
  };

  if (head === 'solitaire') {
    addCenter(prongCount);
    headClearMm = d / 2 + 0.6;
  } else if (head === 'halo') {
    addCenter(4);
    const hs = Math.min(1.6, Math.max(0.9, d * 0.2));
    const haloR = g.r + hs / 2 + 0.25;
    const haloY = girdleY - g.crownH * 0.35;
    const count = Math.max(8, Math.floor((2 * Math.PI * haloR) / (hs * 1.12)));
    const frameY = haloY - hs * 0.42;
    parts.metal('head', torus(haloR, hs * 0.42, { center: new THREE.Vector3(0, frameY, 0), radial: 8, tubular: Math.max(48, count * 4) }));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      parts.stone('stones', gemGeometry(hs, 8).translate(c * haloR, haloY, s * haloR));
      const b = a + Math.PI / count;
      parts.metal('head', bead(hs * 0.17, new THREE.Vector3(Math.cos(b) * (haloR + hs * 0.36), haloY + hs * 0.12, Math.sin(b) * (haloR + hs * 0.36))));
    }
    stones.add('halo', hs, count);
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const top = new THREE.Vector3(Math.cos(a) * haloR * 0.92, frameY, Math.sin(a) * haloR * 0.92);
      const bot = new THREE.Vector3(Math.cos(a) * Math.min(haloR * 0.55, w * 0.45), baseY, Math.sin(a) * Math.min(haloR * 0.55, w * 0.45));
      parts.metal('head', rod(bot, top, prongR * 0.85, 8));
    }
    headClearMm = haloR + hs / 2 + 0.4;
  } else if (head === 'three-stone') {
    addCenter(4);
    const d2 = +(d * 0.7).toFixed(2);
    const g2 = gemDims(d2);
    const gy2 = Ro + g2.girdleH / 2 + g2.pavilionH + 0.3;
    const alpha = ((d + d2) / 2 + 0.35) / girdleY;
    const side = prongSetting({ d: d2, prongs: 4, prongR: prongR * 0.85, baseY, girdleY: gy2, baseSpread: Math.min(d2 * 0.24, w * 0.4) });
    const sideGem = gemGeometry(d2, 16).translate(0, gy2, 0);
    for (const sgn of [-1, 1]) {
      const m = RZ(sgn * alpha);
      parts.metal('head', side.map((geom) => tx(geom, m)));
      parts.stone('stones', tx(sideGem, m));
    }
    stones.add('side', d2, 2);
    headClearMm = girdleY * alpha + d2 / 2 + 0.6;
  } else if (head === 'bezel') {
    const cup = bezelCup(d);
    parts.metal('head', cup.geometry.translate(0, girdleY, 0));
    const postTop = girdleY + cup.bottomY + 0.2;
    if (postTop > baseY) {
      parts.metal('head', new THREE.CylinderGeometry(Math.min(cup.outerR * 0.8, d * 0.32), Math.min(w * 0.45, d * 0.3), postTop - baseY, 16, 1, false).translate(0, (postTop + baseY) / 2, 0));
    }
    parts.stone('stones', gemGeometry(d, 16).translate(0, girdleY, 0));
    stones.add('center', d, 1);
    headClearMm = cup.outerR + 0.5;
  }

  // ---- pavé row along the top of the band --------------------------------
  if (profile === 'pave') {
    const ps = Math.min(2.2, Math.max(0.9, w * 0.55));
    const pitch = ps + 0.18;
    const Rg = Ro - ps * 0.1;
    const dpsi = pitch / Ro;
    let angles = [];
    if (head === 'none') {
      const count = Math.floor((2 * Math.PI * Ro) / pitch);
      for (let i = 0; i < count; i++) angles.push((i / count) * Math.PI * 2);
    } else {
      const psi0 = (headClearMm + ps / 2) / Ro;
      const psiMax = (rng.range(65, 85) * Math.PI) / 180;
      for (let a = psi0; a <= psiMax; a += dpsi) angles.push(a, -a);
    }
    const stepA = angles.length > 1 && head === 'none' ? (Math.PI * 2) / angles.length : dpsi;
    for (const a of angles) {
      const dir = new THREE.Vector3(Math.sin(a), Math.cos(a), 0);
      if (hasStone) parts.stone('stones', gemAt(ps, dir.clone().multiplyScalar(Rg), dir, 8));
      else parts.metal('band', bead(ps * 0.4, dir.clone().multiplyScalar(Ro - ps * 0.1)));
      for (const z of [-1, 1]) {
        const b = a + stepA / 2;
        const bd = new THREE.Vector3(Math.sin(b), Math.cos(b), 0).multiplyScalar(Ro + 0.02);
        parts.metal('band', bead(ps * 0.17, bd.setZ(z * ps * 0.42)));
      }
    }
    if (hasStone) stones.add('pave', ps, angles.length);
  }

  ctx.meta.innerDiameterMm = 2 * Ri;
  ctx.meta.outerDiameterMm = 2 * Ro;
}

