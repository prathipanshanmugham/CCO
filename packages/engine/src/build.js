// buildPiece(): params → THREE.Group in millimetres, plus volume / weight / dimensions / summary.
import * as THREE from 'three';
import { getPieceType, getMetal, getStone } from './catalog.js';
import { normalizeParams, paramSchema } from './params.js';
import { interpretPrompt, seedFromPrompt } from './prompt.js';
import { makeRng } from './rng.js';
import { PartSet, StoneTally } from './geometry/core.js';
import { metalMaterial, stoneMaterial } from './materials.js';
import { computeVolumeMm3, weightG, countTriangles } from './volume.js';
import { buildRing } from './pieces/ring.js';
import { buildPendant } from './pieces/pendant.js';
import { buildEarrings } from './pieces/earrings.js';
import { buildBracelet } from './pieces/bracelet.js';
import { buildBangle } from './pieces/bangle.js';
import { buildChain, buildCuban } from './pieces/chain.js';
import { buildGrillz } from './pieces/grillz.js';
import { buildNosePin } from './pieces/nosepin.js';

const BUILDERS = {
  ring: buildRing,
  pendant: buildPendant,
  earrings: buildEarrings,
  bracelet: buildBracelet,
  bangle: buildBangle,
  chain: buildChain,
  'cuban-chain': buildCuban,
  grillz: buildGrillz,
  'nose-pin': buildNosePin,
};

/**
 * Select params that variants 1 and 2 may change (in priority order) and the cycle of values
 * they step through. Keys the prompt mentioned explicitly are never changed.
 */
const VARIANT_CYCLES = {
  ring: { head: ['solitaire', 'halo', 'three-stone', 'bezel'], profile: ['comfort', 'twisted', 'pave', 'knife', 'plain'] },
  pendant: { stone: ['center', 'halo'], shape: ['heart', 'oval', 'teardrop', 'disc', 'cross'], bail: ['loop', 'tube', 'hidden'] },
  earrings: { style: ['stud', 'drop', 'hoop'] },
  bracelet: { style: ['tennis', 'link', 'bangle-cuff'] },
  bangle: { pattern: ['plain', 'faceted', 'dotted', 'stone-set'] },
  chain: { style: ['curb', 'rope', 'box', 'figaro'] },
  'cuban-chain': { pave: ['single-row', 'full', 'none'] },
  grillz: { style: ['pave', 'plain', 'open-face'] },
  'nose-pin': { style: ['stud', 'l-shape', 'ring'] },
};
/** Fallback when every variant key is locked: nudge one dimension ±12 %. */
const VARIANT_TWEAK = {
  ring: 'bandWidth', pendant: 'width', earrings: 'thickness', bracelet: 'linkWidth', bangle: 'width',
  chain: 'gauge', 'cuban-chain': 'width', grillz: 'height', 'nose-pin': 'stoneMm',
};

export function applyVariant(pieceType, params, variant, lockedKeys = []) {
  const v = Math.max(0, Math.min(2, Math.round(Number(variant) || 0)));
  const out = { ...params };
  if (!v) return out;
  const locked = new Set(lockedKeys);
  const cycles = VARIANT_CYCLES[pieceType];
  const keys = Object.keys(cycles).filter((k) => !locked.has(k));
  if (!keys.length) {
    const k = VARIANT_TWEAK[pieceType];
    if (!locked.has(k)) out[k] = params[k] * (v === 1 ? 0.88 : 1.12);
    return normalizeParams(pieceType, out);
  }
  const key = keys[(v - 1) % keys.length];
  const shift = keys.length === 1 ? v : 1;
  const cyc = cycles[key];
  const i = Math.max(0, cyc.indexOf(out[key]));
  out[key] = cyc[(i + shift) % cyc.length];
  return out;
}

/**
 * Build a piece.
 * @param {{pieceType:string, metal?:string, stone?:string, params?:object, prompt?:string, variant?:0|1|2}} spec
 */
export function buildPiece({ pieceType = 'ring', metal = 'gold-18k', stone = 'diamond', params = {}, prompt = '', variant = 0 } = {}) {
  const type = getPieceType(pieceType);
  const metalId = getMetal(metal).id;
  const stoneId = stone === 'none' ? 'none' : getStone(stone).id;
  const locked = prompt ? interpretPrompt(prompt, pieceType).locked : [];
  const v = Math.max(0, Math.min(2, Math.round(Number(variant) || 0)));
  const p = normalizeParams(pieceType, applyVariant(pieceType, normalizeParams(pieceType, params), v, locked));
  const seed = (seedFromPrompt(prompt) ^ Math.imul(v + 1, 0x9e3779b1)) >>> 0;

  const ctx = {
    p,
    rng: makeRng(seed),
    seed,
    variant: v,
    hasStone: stoneId !== 'none',
    stoneId,
    parts: new PartSet(),
    stones: new StoneTally(),
    meta: {},
  };
  BUILDERS[pieceType](ctx);

  // merge per part, centre the bounding box on the origin
  const finals = ctx.parts.finalize();
  const box = new THREE.Box3();
  for (const f of finals) {
    f.geometry.computeBoundingBox();
    box.union(f.geometry.boundingBox);
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const group = new THREE.Group();
  group.name = `${pieceType}-v${v}`;
  const mMetal = metalMaterial(metalId);
  const mStone = ctx.hasStone ? stoneMaterial(stoneId) : null;
  const parts = [];
  for (const f of finals) {
    f.geometry.translate(-center.x, -center.y, -center.z);
    f.geometry.computeBoundingBox();
    f.geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(f.geometry, f.kind === 'metal' ? mMetal : mStone);
    mesh.name = f.name;
    mesh.userData = { kind: f.kind, partName: f.name };
    mesh.castShadow = true;
    mesh.receiveShadow = f.kind === 'metal';
    group.add(mesh);
    parts.push({ name: f.name, kind: f.kind, mesh });
  }

  const volumeMm3 = computeVolumeMm3(group);
  const weight = weightG(volumeMm3, metalId);
  const dimensions = { widthMm: +size.x.toFixed(2), heightMm: +size.y.toFixed(2), depthMm: +size.z.toFixed(2) };
  const stonesList = ctx.stones.items.map((s) => ({ ...s, stone: stoneId, approxCaratEach: +caratOf(s.diameterMm, stoneId).toFixed(3) }));
  const result = {
    group,
    volumeMm3: +volumeMm3.toFixed(2),
    weightG: +weight.toFixed(3),
    dimensions,
    stoneCount: ctx.stones.count,
    stones: stonesList,
    parts,
    params: p,
    seed,
    variant: v,
    triangles: countTriangles(group),
    meta: ctx.meta,
  };
  const spec = { pieceType, metal: metalId, stone: stoneId, params: p };
  result.summary = describePiece(spec, result);
  group.userData = {
    pieceType, group: type.group, metal: metalId, stone: stoneId, params: p, variant: v, seed,
    volumeMm3: result.volumeMm3, weightG: result.weightG, dimensions, stones: stonesList, summary: result.summary, units: 'mm', meta: ctx.meta,
  };
  return result;
}

/** Approx. carat weight of a round brilliant of girdle diameter d (mm). */
function caratOf(d, stoneId) {
  const s = getStone(stoneId);
  if (!s.densityGcm3) return 0;
  // diamond: ct ≈ 0.00364·d³ (≈ 1 ct at 6.5 mm); other stones scale by density
  return d ** 3 * 0.00364 * (s.densityGcm3 / 3.52);
}

const fmt = (n) => {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};
const an = (word) => (/^(8|11|18|80|[aeiou])/i.test(word) ? 'an' : 'a');

/** One-sentence human summary, e.g. "18k yellow gold twisted band (size 12), 2.4 mm wide, with a 4 mm halo-set emerald. Approx. 3.1 g." */
export function describePiece(spec, result = {}) {
  const pieceType = spec.pieceType;
  const p = normalizeParams(pieceType, spec.params || {});
  const metal = getMetal(spec.metal).short;
  const stoneId = spec.stone || 'diamond';
  const hasStone = stoneId !== 'none';
  const stone = hasStone ? getStone(stoneId).short : null;
  const stonePl = stone ? (/y$/.test(stone) ? stone.replace(/y$/, 'ies') : `${stone}s`) : '';
  const count = result.stoneCount ?? 0;
  const w = result.weightG != null ? ` Approx. ${fmt(result.weightG)} g${pieceType === 'earrings' ? ' (pair)' : ''}.` : '';
  const label = (key) => paramSchema(pieceType).find((s) => s.key === key).options.find((o) => o.value === p[key]).label.toLowerCase();
  let s;
  switch (pieceType) {
    case 'ring': {
      const prof = { plain: 'D-profile', comfort: 'comfort-fit', knife: 'knife-edge', twisted: 'twisted', pave: 'pavé' }[p.profile];
      s = `${metal} ${prof} band (size ${p.size}), ${fmt(p.bandWidth)} mm wide`;
      if (hasStone && p.head !== 'none') {
        const mm = `${fmt(p.stoneMm)} mm`;
        if (p.head === 'three-stone') s += `, with ${an(mm)} ${mm} ${stone} three-stone setting`;
        else s += `, with ${an(mm)} ${mm} ${p.head}-set ${stone}`;
      }
      if (hasStone && p.profile === 'pave') s += `${p.head !== 'none' ? ' and' : ','} pavé ${stonePl} on the band`;
      break;
    }
    case 'pendant': {
      s = `${metal} ${p.shape} pendant, ${fmt(p.width)} mm wide`;
      if (hasStone && p.stone !== 'none') {
        const d = result.stones?.find((x) => x.role === 'center')?.diameterMm ?? p.stoneMm;
        const mm = `${fmt(d)} mm`;
        s += `, with ${an(mm)} ${mm} ${p.stone === 'halo' ? 'halo-set' : 'centre-set'} ${stone}`;
      }
      s += ` on a ${label('bail')}`;
      break;
    }
    case 'earrings': {
      s = `Pair of ${metal} ${p.style === 'hoop' ? `${fmt(p.sizeMm)} mm hoop` : p.style} earrings`;
      if (hasStone) s += p.style === 'hoop' ? ` with pavé ${stonePl}` : ` with ${fmt(p.stoneMm)} mm ${stonePl}`;
      break;
    }
    case 'bracelet': {
      const style = { link: 'cable-link bracelet', tennis: 'tennis bracelet', 'bangle-cuff': 'open cuff' }[p.style];
      s = `${metal} ${style}, ${Math.round(p.length)} mm long`;
      if (hasStone && count) s += `, with ${count} ${stonePl}`;
      break;
    }
    case 'bangle':
      s = `${metal} ${p.pattern === 'stone-set' ? 'channel-set' : p.pattern} bangle, ${fmt(p.innerDiameter)} mm inner diameter, ${fmt(p.width)} mm wide`;
      if (hasStone && p.pattern === 'stone-set' && count) s += `, with ${count} ${stonePl}`;
      break;
    case 'chain':
      s = `${metal} ${p.style} chain, ${Math.round(p.length)} mm (${fmt(p.length / 25.4)} in), ${fmt(p.gauge)} mm wide`;
      break;
    case 'cuban-chain':
      s = `${metal} Miami cuban chain, ${fmt(p.width)} mm wide, ${Math.round(p.length)} mm long`;
      if (hasStone && p.pave !== 'none' && count) s += `, ${p.pave === 'full' ? 'fully iced' : 'single-row iced'} with ${count} ${stonePl}`;
      break;
    case 'grillz':
      s = `${metal} ${label('style')} grillz, ${p.teeth} teeth`;
      if (hasStone && count) s += `, with ${count} ${stonePl}`;
      break;
    case 'nose-pin': {
      s = `${metal} ${p.style === 'ring' ? 'nose ring' : `${p.style === 'l-shape' ? 'L-shape' : label('style')} nose pin`}`;
      if (hasStone) {
        const mm = `${fmt(p.stoneMm)} mm`;
        s += ` with ${an(mm)} ${mm} ${stone}`;
      }
      break;
    }
    default:
      s = `${metal} ${pieceType}`;
  }
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return `${s}.${w}`;
}
