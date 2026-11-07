// Nose pins: stud, L-shape and small nose ring. Stone faces +Z, pin runs back along -Z.
import * as THREE from 'three';
import { rod, sphere, torus, tx, RX, T, chain } from '../geometry/core.js';
import { gemGeometry, bezelCup } from '../geometry/gem.js';

export function buildNosePin(ctx) {
  const { p, hasStone, parts, stones } = ctx;
  const d = p.stoneMm;
  const r = p.wireGauge / 2;
  const cup = bezelCup(d, { wall: Math.max(0.3, d * 0.12), segments: 24 });
  const toFace = RX(Math.PI / 2); // local +Y → +Z

  const head = (m) => {
    parts.metal('setting', tx(cup.geometry, m));
    if (hasStone) parts.stone('stones', tx(gemGeometry(d, 12), m));
    else parts.metal('setting', tx(sphere(d * 0.45, new THREE.Vector3(0, 0, 0), 16, 10), m));
  };

  if (p.style === 'ring') {
    const R = 4; // ~8 mm hoop
    parts.metal('ring', torus(R, r, { axis: new THREE.Vector3(0, 0, 1), radial: 10, tubular: 64 }));
    // stone sits on the front of the lower arc
    head(chain(toFace, T(0, -R, r + -cup.bottomY - 0.15)));
  } else {
    head(toFace);
    const z0 = cup.bottomY + 0.1; // back of the cup (local y → z)
    if (p.style === 'l-shape') {
      const bendZ = z0 - 5.5;
      const a = new THREE.Vector3(0, 0, z0), b = new THREE.Vector3(0, 0, bendZ), c = new THREE.Vector3(0, -3.2, bendZ);
      parts.metal('pin', rod(a, b, r, 10), sphere(r, b, 10, 8), rod(b, c, r, 10));
    } else {
      const end = new THREE.Vector3(0, 0, z0 - 6.5);
      parts.metal('pin', rod(new THREE.Vector3(0, 0, z0), end, r, 10), sphere(r * 1.6, end, 10, 8));
    }
  }
  if (hasStone) stones.add('center', d, 1);
}
