// Grillz: a row of hollow tooth caps along the dental arch (XZ plane, front toward +Z, caps hang down).
// Each cap = a walled sleeve (extruded rounded trapezoid with a hole) + an incisal plate, so the
// metal weight reflects a real ~0.7 mm shell rather than a solid block.
import * as THREE from 'three';
import { basis, tx, RX } from '../geometry/core.js';
import { gemAt, bead } from '../geometry/gem.js';

// Tooth widths/heights/depths from the midline outwards: central, lateral, canine, premolar.
const TEETH = [
  { w: 8.6, h: 1.0, d: 7.0 },
  { w: 6.8, h: 0.9, d: 6.2 },
  { w: 7.6, h: 1.0, d: 7.6 },
  { w: 7.0, h: 0.86, d: 8.0 },
];

/** Rounded trapezoid outline (labial edge at -y is widest). */
function capOutline(w, d, inset = 0, r = 1.4) {
  const hw = w / 2 - inset, hd = d / 2 - inset;
  const lingual = hw * 0.78;
  const rr = Math.max(0.2, r - inset);
  const pts = [];
  const corners = [
    [-hw, -hd], [hw, -hd], [lingual, hd], [-lingual, hd],
  ];
  // round each corner with a short arc approximation
  for (let i = 0; i < 4; i++) {
    const c = corners[i], prev = corners[(i + 3) % 4], next = corners[(i + 1) % 4];
    const v1 = new THREE.Vector2(prev[0] - c[0], prev[1] - c[1]).normalize();
    const v2 = new THREE.Vector2(next[0] - c[0], next[1] - c[1]).normalize();
    const a = new THREE.Vector2(c[0] + v1.x * rr, c[1] + v1.y * rr);
    const b = new THREE.Vector2(c[0] + v2.x * rr, c[1] + v2.y * rr);
    const C = new THREE.Vector2(c[0], c[1]);
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      // quadratic Bézier a → C → b
      pts.push(new THREE.Vector2(
        (1 - t) ** 2 * a.x + 2 * (1 - t) * t * C.x + t * t * b.x,
        (1 - t) ** 2 * a.y + 2 * (1 - t) * t * C.y + t * t * b.y,
      ));
    }
  }
  return pts;
}

function extrudeUp(shapePts, height, holes = [], bevel = 0.25) {
  const shape = new THREE.Shape(shapePts);
  for (const h of holes) shape.holes.push(new THREE.Path(h));
  const depth = Math.max(0.05, height - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 4, steps: 1 });
  // shape XY → local XZ (y_shape → -z), extrusion → +Y; base at y = 0
  return g.translate(0, 0, bevel).applyMatrix4(RX(-Math.PI / 2));
}

export function buildGrillz(ctx) {
  const { p, rng, hasStone, parts, stones } = ctx;
  const n = p.teeth;
  const H = p.height;
  const wall = 0.7;
  let style = p.style;
  if (style === 'pave' && !hasStone) style = 'plain';

  // order teeth along the arch, left → right
  const left = Math.floor(n / 2), right = n - left;
  const seq = [];
  for (let i = left - 1; i >= 0; i--) seq.push(TEETH[Math.min(i, 3)]);
  for (let i = 0; i < right; i++) seq.push(TEETH[Math.min(i, 3)]);
  const taper = (idx) => 1 - 0.035 * Math.max(0, idx - 1);
  const widths = seq.map((t, i) => t.w * taper(Math.abs(i - (left - 0.5))) * 0.97);
  const total = widths.reduce((a, b) => a + b, 0);

  // arch: ellipse x = A sin φ, z = B cos φ; sample arc length
  const A = 21, B = 16;
  const samples = 2000;
  const cum = [0], P = [];
  for (let i = 0; i <= samples; i++) {
    const ph = -Math.PI / 2 + (i / samples) * Math.PI;
    P.push(new THREE.Vector3(A * Math.sin(ph), 0, B * Math.cos(ph)));
    if (i) cum.push(cum[i - 1] + P[i].distanceTo(P[i - 1]));
  }
  const mid = cum[samples] / 2;
  const at = (s) => {
    let i = cum.findIndex((c) => c >= s);
    if (i <= 0) i = 1;
    const f = (s - cum[i - 1]) / (cum[i] - cum[i - 1]);
    const pos = P[i - 1].clone().lerp(P[i], f);
    const tan = P[i].clone().sub(P[i - 1]).normalize();
    return { pos, tan };
  };

  const ps = +rng.range(1.15, 1.45).toFixed(2);
  let s = mid - total / 2;
  let stoneCount = 0;
  for (let i = 0; i < seq.length; i++) {
    const t = seq[i];
    const w = widths[i] / 0.97;
    const h = H * t.h * taper(Math.abs(i - (left - 0.5)));
    const d = t.d * 0.9;
    const c = s + widths[i] / 2;
    s += widths[i];
    const { pos, tan } = at(c);
    const up = new THREE.Vector3(0, 1, 0);
    const out = new THREE.Vector3().crossVectors(tan, up).normalize(); // outward (labial)
    const ctr = pos.clone().addScaledVector(out, -d / 2);
    const m = basis(tan, up, out, ctr.setY(-h)); // cap occupies y ∈ [-h, 0]

    const outer = capOutline(w, d);
    const inner = capOutline(w, d, wall).reverse();
    const plateT = 0.8;
    const sleeveH = style === 'open-face' ? Math.max(2, h * 0.3) : h - plateT * 0.5;
    const sleeveY = style === 'open-face' ? h - sleeveH : plateT * 0.5;
    parts.metal('caps', tx(extrudeUp(outer, sleeveH, [inner]), new THREE.Matrix4().makeTranslation(0, sleeveY, 0).premultiply(m)));
    parts.metal('caps', tx(extrudeUp(outer, plateT, [], 0.2), m));

    if (style === 'open-face') {
      // labial frame with a window
      const fw = w * 0.96, fh = h;
      const frame = [new THREE.Vector2(-fw / 2, 0), new THREE.Vector2(fw / 2, 0), new THREE.Vector2(fw / 2, fh), new THREE.Vector2(-fw / 2, fh)];
      const bw = 1.1;
      const hole = [new THREE.Vector2(-fw / 2 + bw, bw), new THREE.Vector2(-fw / 2 + bw, fh - bw * 1.4), new THREE.Vector2(fw / 2 - bw, fh - bw * 1.4), new THREE.Vector2(fw / 2 - bw, bw)];
      const shape = new THREE.Shape(frame);
      shape.holes.push(new THREE.Path(hole));
      const g = new THREE.ExtrudeGeometry(shape, { depth: wall, bevelEnabled: false, steps: 1 });
      parts.metal('caps', tx(g.translate(0, 0, d / 2 - wall), m));
    }

    if (style === 'pave') {
      const pitch = ps * 1.08;
      const cols = Math.max(1, Math.floor((w * 0.86 - 0.4) / pitch));
      const rows = Math.max(1, Math.floor((h - 1.0) / pitch));
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? pitch / 2 : 0;
        const colsR = r % 2 ? cols - 1 : cols;
        for (let k = 0; k < colsR; k++) {
          const x = (k - (colsR - 1) / 2) * pitch + off * 0;
          const y = 0.6 + ps / 2 + r * pitch;
          const local = new THREE.Vector3(x, y, d / 2 + ps * 0.02);
          parts.stone('stones', tx(gemAt(ps, local, new THREE.Vector3(0, 0, 1), 8), m));
          stoneCount++;
        }
      }
      // beads along the gum line hold the top row
      for (let k = 0; k <= cols; k++) {
        const x = (k - cols / 2) * pitch;
        parts.metal('caps', tx(bead(ps * 0.2, new THREE.Vector3(x, 0.6 + rows * pitch, d / 2 + 0.05)), m));
      }
    }
  }
  if (stoneCount) stones.add('pave', ps, stoneCount);
  ctx.meta.archWidthMm = total;
}
