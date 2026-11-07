// Curves: rounded rectangles (links), twisted wires (rings), flat loops (chains laid on a table).
import * as THREE from 'three';

/**
 * Closed rounded rectangle in the XY plane, arc-length parameterised.
 * halfW along X, halfH along Y, corner radius cr (≤ min(halfW, halfH)).
 */
export class RoundedRectCurve extends THREE.Curve {
  constructor(halfW, halfH, cr) {
    super();
    this.hw = halfW;
    this.hh = halfH;
    this.cr = Math.min(cr, halfW, halfH);
    const { hw, hh } = this;
    const c = this.cr;
    const sx = 2 * (hw - c), sy = 2 * (hh - c), q = (Math.PI * c) / 2;
    // Segment list starting at (hw, 0) going counter-clockwise.
    const line = (x0, y0, x1, y1, len) => ({ len, at: (u, t) => t.set(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 0) });
    const arc = (cx, cy, a0) => ({ len: q, at: (u, t) => t.set(cx + c * Math.cos(a0 + (u * Math.PI) / 2), cy + c * Math.sin(a0 + (u * Math.PI) / 2), 0) });
    this.segs = [
      line(hw, 0, hw, hh - c, sy / 2),
      arc(hw - c, hh - c, 0),
      line(hw - c, hh, -hw + c, hh, sx),
      arc(-hw + c, hh - c, Math.PI / 2),
      line(-hw, hh - c, -hw, -hh + c, sy),
      arc(-hw + c, -hh + c, Math.PI),
      line(-hw + c, -hh, hw - c, -hh, sx),
      arc(hw - c, -hh + c, (3 * Math.PI) / 2),
      line(hw, -hh + c, hw, 0, sy / 2),
    ].filter((s) => s.len > 1e-9);
    this.total = this.segs.reduce((a, s) => a + s.len, 0);
  }
  getPoint(t, target = new THREE.Vector3()) {
    let s = (((t % 1) + 1) % 1) * this.total;
    for (const seg of this.segs) {
      if (s <= seg.len) return seg.at(seg.len ? s / seg.len : 0, target);
      s -= seg.len;
    }
    const last = this.segs[this.segs.length - 1];
    return last.at(1, target);
  }
  getLength() {
    return this.total;
  }
}

/**
 * Wire twisted around a ring band: the band centre circle (radius Rm, in XY plane, axis Z),
 * with the strand orbiting the cross-section on an ellipse (ar radial, az axial).
 */
export class TwistStrandCurve extends THREE.Curve {
  constructor(Rm, ar, az, twists, phase) {
    super();
    Object.assign(this, { Rm, ar, az, twists, phase });
  }
  getPoint(t, target = new THREE.Vector3()) {
    const th = t * Math.PI * 2;
    const ph = th * this.twists + this.phase;
    const r = this.Rm + this.ar * Math.cos(ph);
    return target.set(r * Math.cos(th), r * Math.sin(th), this.az * Math.sin(ph));
  }
}

/**
 * Flat closed loop in the XZ plane (a chain lying on a table), arc-length addressable.
 * ratio = minor/major semi-axis (1 → circle).
 */
export class FlatLoop {
  constructor(perimeter, ratio = 0.42, samples = 4096) {
    const h = ((1 - ratio) / (1 + ratio)) ** 2;
    const k = Math.PI * (1 + ratio) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h))); // Ramanujan II
    this.a = perimeter / k;
    this.b = this.a * ratio;
    const pts = [];
    const cum = [0];
    for (let i = 0; i <= samples; i++) {
      const u = (i / samples) * Math.PI * 2;
      pts.push(new THREE.Vector3(this.a * Math.cos(u), 0, this.b * Math.sin(u)));
      if (i > 0) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    }
    this.pts = pts;
    this.cum = cum;
    this.length = cum[cum.length - 1];
  }
  _locate(s) {
    const L = this.length;
    s = ((s % L) + L) % L;
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const f = (s - this.cum[lo]) / (this.cum[hi] - this.cum[lo] || 1);
    return { lo, hi, f };
  }
  pointAt(s, target = new THREE.Vector3()) {
    const { lo, hi, f } = this._locate(s);
    return target.lerpVectors(this.pts[lo], this.pts[hi], f);
  }
  tangentAt(s, target = new THREE.Vector3()) {
    const { lo, hi } = this._locate(s);
    return target.subVectors(this.pts[hi], this.pts[lo]).normalize();
  }
  /** Frame at arc length s: T (tangent), N (in-plane outward-ish normal), U (+Y). */
  frameAt(s) {
    const T = this.tangentAt(s);
    const U = new THREE.Vector3(0, 1, 0);
    const N = new THREE.Vector3().crossVectors(U, T).normalize();
    return { P: this.pointAt(s), T, N, U };
  }
}
