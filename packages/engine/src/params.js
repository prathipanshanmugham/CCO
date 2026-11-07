// Parameter schemas for the customer-facing sliders, plus ring sizing.
import { getPieceType } from './catalog.js';

/**
 * Indian ring size → inner diameter (mm), sizes 1–30, as published on the common
 * Indian retail charts (≈ 12.7 + 0.32·n). Fractional sizes are interpolated.
 */
export const INDIAN_RING_SIZES_MM = Object.freeze([
  /* 1 */ 13.0, 13.3, 13.7, 14.0, 14.3, 14.6, 15.0, 15.3, 15.6, 15.9,
  /* 11 */ 16.2, 16.5, 16.9, 17.2, 17.5, 17.8, 18.2, 18.5, 18.8, 19.1,
  /* 21 */ 19.4, 19.7, 20.1, 20.4, 20.7, 21.0, 21.3, 21.6, 22.0, 22.3,
]);

/** Indian ring size → inner diameter in mm (size 12 → 16.5 mm). */
export function ringSizeToDiameterMm(size) {
  const n = Number(size);
  if (!Number.isFinite(n)) return INDIAN_RING_SIZES_MM[11];
  const t = INDIAN_RING_SIZES_MM;
  if (n < 1 || n > 30) return +(12.7 + 0.32 * n).toFixed(2);
  const i = Math.floor(n);
  if (i === 30) return t[29];
  const f = n - i;
  return +(t[i - 1] + (t[i] - t[i - 1]) * f).toFixed(3);
}

/** US ring size → closest Indian size (used by the prompt parser for "US size 7"). */
export function usToIndianRingSize(us) {
  const d = 11.63 + 0.8128 * us;
  let best = 1;
  for (let i = 0; i < INDIAN_RING_SIZES_MM.length; i++) {
    if (Math.abs(INDIAN_RING_SIZES_MM[i] - d) < Math.abs(INDIAN_RING_SIZES_MM[best - 1] - d)) best = i + 1;
  }
  return best;
}

const opt = (...values) => values.map((v) => (Array.isArray(v) ? { value: v[0], label: v[1] } : { value: v, label: cap(v) }));
function cap(s) {
  return s.replace(/(^|-)([a-z])/g, (m, a, b) => (a ? ' ' : '') + b.toUpperCase());
}
const range = (key, label, min, max, step, unit, def) => ({ key, label, type: 'range', min, max, step, unit, default: def });
const select = (key, label, options, def) => ({ key, label, type: 'select', options, default: def });

const SCHEMAS = {
  ring: [
    range('size', 'Ring size (Indian)', 4, 30, 1, 'IN', 12),
    range('bandWidth', 'Band width', 1.5, 8, 0.1, 'mm', 2.5),
    range('bandThickness', 'Band thickness', 1, 3, 0.1, 'mm', 1.6),
    select('profile', 'Band profile', opt('plain', 'comfort', 'knife', 'twisted', ['pave', 'Pavé']), 'comfort'),
    select('head', 'Setting', opt('none', 'solitaire', 'halo', ['three-stone', 'Three Stone'], 'bezel'), 'solitaire'),
    range('stoneMm', 'Centre stone', 2, 8, 0.1, 'mm', 5),
  ],
  pendant: [
    select('shape', 'Shape', opt('heart', 'oval', 'teardrop', 'disc', 'cross'), 'heart'),
    range('width', 'Width', 8, 30, 0.5, 'mm', 14),
    range('thickness', 'Thickness', 1, 3, 0.1, 'mm', 1.6),
    select('stone', 'Stone setting', opt(['center', 'Centre stone'], 'halo', ['none', 'No stone']), 'center'),
    range('stoneMm', 'Centre stone', 2, 8, 0.1, 'mm', 4),
    select('bail', 'Bail', opt(['loop', 'Jump-ring loop'], ['tube', 'Tube bail'], ['hidden', 'Hidden bail']), 'loop'),
  ],
  earrings: [
    select('style', 'Style', opt('stud', 'hoop', 'drop'), 'stud'),
    range('sizeMm', 'Hoop diameter / drop length', 8, 40, 0.5, 'mm', 18),
    range('thickness', 'Wire thickness', 0.8, 4, 0.1, 'mm', 1.6),
    range('stoneMm', 'Stone size', 2, 8, 0.1, 'mm', 5),
  ],
  bracelet: [
    select('style', 'Style', opt('link', 'tennis', ['bangle-cuff', 'Cuff']), 'tennis'),
    range('length', 'Length', 150, 200, 1, 'mm', 175),
    range('linkWidth', 'Link / row width', 2, 12, 0.5, 'mm', 4),
  ],
  bangle: [
    range('innerDiameter', 'Inner diameter', 50, 70, 0.5, 'mm', 60),
    range('width', 'Width', 3, 20, 0.5, 'mm', 5),
    range('thickness', 'Thickness', 1.5, 5, 0.1, 'mm', 2),
    select('pattern', 'Pattern', opt('plain', 'faceted', 'dotted', ['stone-set', 'Stone set']), 'plain'),
  ],
  chain: [
    select('style', 'Style', opt('curb', 'rope', 'box', 'figaro'), 'curb'),
    range('length', 'Length', 400, 600, 10, 'mm', 450),
    range('gauge', 'Width (gauge)', 1.5, 5, 0.1, 'mm', 2.5),
  ],
  'cuban-chain': [
    range('width', 'Link width', 6, 20, 0.5, 'mm', 10),
    range('length', 'Length', 180, 760, 10, 'mm', 500),
    select('pave', 'Pavé', opt(['none', 'No stones'], ['single-row', 'Single row'], ['full', 'Fully iced']), 'single-row'),
  ],
  grillz: [
    range('teeth', 'Teeth', 4, 8, 1, 'teeth', 6),
    select('style', 'Style', opt(['plain', 'Polished'], ['pave', 'Pavé'], ['open-face', 'Open face']), 'pave'),
    range('height', 'Cap height', 6, 12, 0.5, 'mm', 9),
  ],
  'nose-pin': [
    select('style', 'Style', opt('stud', ['l-shape', 'L-shape'], ['ring', 'Nose ring']), 'stud'),
    range('stoneMm', 'Stone size', 1.5, 4, 0.1, 'mm', 2.5),
    range('wireGauge', 'Wire thickness', 0.5, 1, 0.05, 'mm', 0.7),
  ],
};

/** Adjustable parameters for a piece type (a fresh copy each call). */
export function paramSchema(pieceType) {
  getPieceType(pieceType);
  return SCHEMAS[pieceType].map((s) => ({ ...s, options: s.options ? s.options.map((o) => ({ ...o })) : undefined }));
}

/** Default parameter values for a piece type. */
export function defaultParams(pieceType) {
  const out = {};
  for (const s of paramSchema(pieceType)) out[s.key] = s.default;
  return out;
}

/** Merge params over defaults, clamping ranges to the schema and rejecting unknown options. */
export function normalizeParams(pieceType, params = {}) {
  const out = {};
  for (const s of paramSchema(pieceType)) {
    let v = params[s.key];
    if (s.type === 'range') {
      v = Number(v);
      if (!Number.isFinite(v)) v = s.default;
      v = Math.min(s.max, Math.max(s.min, v));
    } else if (!s.options.some((o) => o.value === v)) {
      v = s.default;
    }
    out[s.key] = v;
  }
  return out;
}
