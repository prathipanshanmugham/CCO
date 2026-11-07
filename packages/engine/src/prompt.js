// Deterministic keyword-based prompt interpretation (no network, no ML).
import { paramSchema, usToIndianRingSize } from './params.js';
import { getPieceType, getMetal, getStone } from './catalog.js';
import { fnv1a } from './rng.js';

/** Lower-case, strip accents (pavé → pave), unify quotes and whitespace. */
export function normalizePrompt(prompt) {
  return String(prompt ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”″]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stable 32-bit seed from a prompt (case/whitespace/accent-insensitive). */
export function seedFromPrompt(prompt) {
  return fnv1a(normalizePrompt(prompt));
}

// Size-word presets per piece type. Applied before specific rules / numbers.
const SIZE_PRESETS = {
  dainty: {
    ring: { bandWidth: 1.8, bandThickness: 1.3, stoneMm: 3.5 },
    pendant: { width: 10, thickness: 1.2, stoneMm: 3 },
    earrings: { sizeMm: 12, thickness: 1.0, stoneMm: 3.5 },
    bracelet: { linkWidth: 2.5 },
    bangle: { width: 3.5, thickness: 1.6 },
    chain: { gauge: 1.6 },
    'cuban-chain': { width: 7 },
    grillz: { height: 7.5 },
    'nose-pin': { stoneMm: 1.8, wireGauge: 0.6 },
  },
  bold: {
    ring: { bandWidth: 5, bandThickness: 2.2 },
    pendant: { thickness: 2.4, width: 20 },
    earrings: { thickness: 3, sizeMm: 30 },
    bracelet: { linkWidth: 8 },
    bangle: { width: 12, thickness: 3 },
    chain: { gauge: 4.5 },
    'cuban-chain': { width: 16 },
    grillz: { height: 10.5 },
    'nose-pin': { wireGauge: 0.9 },
  },
  big: {
    ring: { stoneMm: 7.5 },
    pendant: { width: 24, stoneMm: 7 },
    earrings: { sizeMm: 35, stoneMm: 7 },
    bracelet: { linkWidth: 7 },
    bangle: { width: 14 },
    chain: { gauge: 4 },
    'cuban-chain': { width: 18 },
    grillz: { height: 11 },
    'nose-pin': { stoneMm: 3.5 },
  },
};

const WIDTH_KEY = { ring: 'bandWidth', bangle: 'width', bracelet: 'linkWidth', 'cuban-chain': 'width', chain: 'gauge', pendant: 'width', earrings: 'sizeMm', grillz: 'height' };
const THICK_KEY = { ring: 'bandThickness', bangle: 'thickness', pendant: 'thickness', earrings: 'thickness', 'nose-pin': 'wireGauge' };
const DEFAULT_MM_KEY = { chain: 'gauge', 'cuban-chain': 'width', bangle: 'width', bracelet: 'linkWidth', grillz: 'height' };
const NUMBER_WORDS = { four: 4, five: 5, six: 6, seven: 7, eight: 8 };

/**
 * Turn a free-text prompt into parameter suggestions.
 * @returns {{ params: object, styleTags: string[], summary: string, metal: string|null,
 *            stone: string|null, suggestedPieceType: string|null, locked: string[] }}
 */
export function interpretPrompt(prompt, pieceType = 'ring') {
  const type = getPieceType(pieceType);
  const text = normalizePrompt(prompt);
  const schema = paramSchema(pieceType);
  const byKey = new Map(schema.map((s) => [s.key, s]));
  const params = {};
  const tags = new Set();
  let metal = null;
  let stone = null;
  let suggestedPieceType = null;

  const set = (key, value) => {
    const s = byKey.get(key);
    if (!s) return false;
    if (s.type === 'select') {
      if (!s.options.some((o) => o.value === value)) return false;
    } else {
      value = Math.min(s.max, Math.max(s.min, Math.round(Number(value) / s.step) * s.step));
      value = +value.toFixed(3);
    }
    params[key] = value;
    return true;
  };
  const has = (re) => re.test(text);
  const applyPreset = (name) => {
    for (const [k, v] of Object.entries(SIZE_PRESETS[name][pieceType] || {})) set(k, v);
  };

  // ---- size words -------------------------------------------------------
  if (has(/\b(thin|slim|skinny|dainty|delicate|petite|minimal(ist)?|tiny|small|fine|subtle)\b/)) { applyPreset('dainty'); tags.add('dainty'); }
  if (has(/\b(wide|bold|chunky|thick|heavy|broad|hefty)\b/)) { applyPreset('bold'); tags.add('bold'); }
  if (has(/\b(big|large|statement|huge|massive|oversized|giant)\b/)) { applyPreset('big'); tags.add('statement'); }

  // ---- ring profile / head ---------------------------------------------
  if (has(/\b(twist(ed|y)?|rope|braid(ed)?|infinity|woven)\b/)) {
    if (set('profile', 'twisted')) tags.add('twisted');
    if (set('style', 'rope')) tags.add('rope');
  }
  if (has(/\bcomfort\b/)) set('profile', 'comfort');
  if (has(/\bknife(-| )?(edge)?\b/)) { set('profile', 'knife'); tags.add('knife-edge'); }
  if (has(/\b(plain|simple|classic|polished)\b/)) {
    tags.add('minimal');
    if (pieceType === 'ring' && !params.profile) set('profile', 'plain');
    set('pattern', 'plain');
  }
  if (has(/\bhalo\b/)) { set('head', 'halo'); set('stone', 'halo'); tags.add('halo'); }
  if (has(/\bsolitaire\b/)) { set('head', 'solitaire'); set('stone', 'center'); tags.add('solitaire'); }
  if (has(/\b(three|3)[ -]?stones?\b|\btrilogy\b|\btrinity\b/)) { set('head', 'three-stone'); tags.add('three-stone'); }
  if (has(/\bbezel\b/)) { set('head', 'bezel'); tags.add('bezel'); }
  if (has(/\b(vintage|antique|art deco|milgrain|heritage|temple)\b/)) tags.add('vintage');

  // ---- pavé / iced -------------------------------------------------------
  const iced = has(/\b(pave|iced|icy|icey|bling|blinged|encrusted|eternity|micro ?pave|flooded|bust ?down)\b/);
  if (iced) {
    tags.add('pave');
    if (has(/\b(iced|icy|icey|bling|flooded|bust ?down)\b/)) tags.add('iced');
    set('profile', 'pave');
    set('pattern', 'stone-set');
    set('style', 'pave');
    set('pave', has(/\b(single|one|1)[ -]?row\b/) ? 'single-row' : 'full');
  } else if (has(/\b(single|one|1)[ -]?row\b/)) {
    set('pave', 'single-row');
  }

  // ---- pendant shapes ---------------------------------------------------
  if (has(/\b(heart|love)\b/)) { set('shape', 'heart'); tags.add('heart'); }
  if (has(/\boval\b/)) { set('shape', 'oval'); tags.add('oval'); }
  if (has(/\b(tear ?drop|pear|droplet)\b/)) { set('shape', 'teardrop'); tags.add('teardrop'); }
  if (has(/\b(disc|disk|coin|medallion)\b/)) { set('shape', 'disc'); tags.add('disc'); }
  if (has(/\b(cross|crucifix)\b/)) { set('shape', 'cross'); tags.add('cross'); }
  if (has(/\btube bail\b/)) set('bail', 'tube');
  if (has(/\bhidden bail\b/)) set('bail', 'hidden');

  // ---- earrings ----------------------------------------------------------
  if (has(/\b(hoops?|huggies?)\b/)) { set('style', 'hoop'); tags.add('hoop'); if (has(/\bhuggies?\b/)) set('sizeMm', 12); }
  if (has(/\b(drops?|dangl\w*|chandelier|jhumka\w*)\b/) || (pieceType === 'earrings' && has(/\b(tear ?drop|pear)\b/))) { set('style', 'drop'); tags.add('drop'); }
  if (has(/\bstuds?\b/)) { set('style', 'stud'); tags.add('stud'); }

  // ---- bracelets / bangles ---------------------------------------------
  if (has(/\btennis\b/)) { set('style', 'tennis'); tags.add('tennis'); }
  if (has(/\b(link|links|cable)\b/)) set('style', 'link');
  if (has(/\b(cuff|kada)\b/)) { set('style', 'bangle-cuff'); tags.add('cuff'); }
  if (has(/\b(facet(ed|s)?|diamond[- ]cut|geometric|hex(agonal)?)\b/)) { set('pattern', 'faceted'); tags.add('faceted'); }
  if (has(/\b(dot(s|ted)?|bead(ed|s)?|granulat\w*|ball)\b/)) { set('pattern', 'dotted'); tags.add('beaded'); }
  if (has(/\b(stone[- ]set|channel|studded)\b/)) set('pattern', 'stone-set');

  // ---- chains -------------------------------------------------------------
  if (has(/\bcurb\b/)) set('style', 'curb');
  if (has(/\bbox\b/)) set('style', 'box');
  if (has(/\bfigaro\b/)) set('style', 'figaro');
  if (has(/\b(cuban|miami)\b/)) {
    tags.add('cuban');
    if (pieceType !== 'cuban-chain') suggestedPieceType = 'cuban-chain';
    set('style', 'curb');
  }

  // ---- grillz ---------------------------------------------------------------
  if (has(/\bopen[- ]?face\b|\bwindow\b/)) { set('style', 'open-face'); tags.add('open-face'); }
  else if (pieceType === 'grillz' && !iced && has(/\b(plain|polished|solid)\b/)) set('style', 'plain');
  {
    const m = text.match(/\b(\d|four|five|six|seven|eight)\s*(teeth|tooth|caps?)\b/) || text.match(/\b(?:top|bottom|upper|lower)\s+(\d|four|five|six|seven|eight)\b/);
    if (m) set('teeth', NUMBER_WORDS[m[1]] ?? Number(m[1]));
  }
  if (has(/\bgrill(z|s)?\b/) && pieceType !== 'grillz') suggestedPieceType = 'grillz';

  // ---- nose pin ---------------------------------------------------------------
  if (pieceType === 'nose-pin') {
    if (has(/\bl[- ]?shape(d)?\b|\bbent\b/)) set('style', 'l-shape');
    else if (has(/\b(nose ?ring|ring|hoop|nath)\b/)) set('style', 'ring');
    else if (has(/\b(stud|screw)\b/)) set('style', 'stud');
  }

  // ---- metal -----------------------------------------------------------------
  const karat = text.match(/\b(24|22|18|14)\s*(?:k|kt|karat|carat|ct)\b/);
  if (has(/\bplatinum\b|\bpt ?950\b/)) metal = 'platinum-950';
  else if (has(/\b(sterling )?silver\b|\b925\b/)) metal = 'silver-925';
  else if (has(/\b(rose|pink) gold\b/)) metal = 'rose-gold-18k';
  else if (has(/\bwhite gold\b/)) metal = 'white-gold-18k';
  else if (karat) metal = `gold-${karat[1]}k`;
  else if (has(/\bpure gold\b/)) metal = 'gold-24k';
  else if (has(/\bgold\b/)) metal = 'gold-18k';

  // ---- stone -----------------------------------------------------------------
  const noStone = has(/\b(no|without( a)?) (stones?|gems?|diamonds?)\b|\bstoneless\b|\bmetal only\b|\bplain band\b|\bwedding band\b/);
  if (noStone) {
    stone = 'none';
    set('head', 'none');
    set('stone', 'none');
    if (params.profile === 'pave') delete params.profile;
    tags.add('metal-only');
  } else if (has(/\blab[- ]?(grown|created|made)?[- ]?diamonds?\b/)) stone = 'lab-diamond';
  else if (has(/\bmoissanite\b/)) stone = 'moissanite';
  else if (has(/\b(ruby|rubies)\b/)) stone = 'ruby';
  else if (has(/\bemeralds?\b/)) stone = 'emerald';
  else if (has(/\bsapphires?\b/)) stone = 'sapphire';
  else if (has(/\bcz\b|\bcubic zirconia\b|\bzircon\b|\bamerican diamond\b/)) stone = 'cz';
  else if (has(/\bdiamonds?\b/)) stone = 'diamond';

  // ---- numbers (most specific, applied last) ----------------------------------
  if (pieceType === 'ring') {
    const us = text.match(/\bus\s*(?:ring\s*)?size\s*(\d{1,2}(?:\.5)?)\b/);
    const ind = text.match(/\bsize\s*(\d{1,2}(?:\.\d)?)\b/);
    if (us) set('size', usToIndianRingSize(Number(us[1])));
    else if (ind) set('size', Number(ind[1]));
  }
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*mm\b\s*(wide|width|band|thick|thickness|gauge|hoops?|drops?|long|length|stones?|diamonds?|cent(?:er|re)|links?)?/g)) {
    const v = Number(m[1]);
    const word = m[2] || '';
    const before = text.slice(Math.max(0, m.index - 12), m.index);
    if (/^(wide|width|band|gauge|links?)$/.test(word) || (/^(hoops?|drops?|long|length)$/.test(word) && pieceType === 'earrings')) {
      set(WIDTH_KEY[pieceType], v);
    } else if (/^thick/.test(word)) {
      set(THICK_KEY[pieceType], v);
    } else if (/^(stones?|diamonds?|cent)/.test(word) || /\b(stone|diamond|gem|center|centre)\s*$/.test(before)) {
      set('stoneMm', v);
    } else if (pieceType === 'earrings' && (v > 8 || /hoop|drop/.test(text))) {
      set('sizeMm', v);
    } else if (byKey.has('stoneMm')) {
      set('stoneMm', v);
    } else if (DEFAULT_MM_KEY[pieceType]) {
      set(DEFAULT_MM_KEY[pieceType], v);
    }
  }
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*(?:inch(?:es)?\b|in\b|")/g)) {
    const v = Number(m[1]);
    if (pieceType === 'bangle') set('innerDiameter', v * 25.4); // Indian bangle sizes (2.4, 2.6, 2.8 in)
    else set('length', v * 25.4);
  }
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*cm\b/g)) {
    const v = Number(m[1]) * 10;
    if (pieceType === 'bangle') set('innerDiameter', v);
    else set('length', v);
  }
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*(?:ct|cts|carats?)\b(?!\s*(?:yellow |white |rose )?gold)/g)) {
    const ct = Number(m[1]);
    if (ct > 0 && ct <= 5) set('stoneMm', +(6.5 * Math.cbrt(ct)).toFixed(1)); // round brilliant ≈ 6.5 mm per carat^(1/3)
  }

  const locked = Object.keys(params);
  const summary = buildSummary(type, schema, params, metal, stone, suggestedPieceType);
  return { params, styleTags: [...tags], summary, metal, stone, suggestedPieceType, locked };
}

function buildSummary(type, schema, params, metal, stone, suggested) {
  const bits = [];
  for (const s of schema) {
    if (!(s.key in params)) continue;
    const v = params[s.key];
    if (s.type === 'select') bits.push(`${s.label.toLowerCase()}: ${s.options.find((o) => o.value === v).label.toLowerCase()}`);
    else if (s.key === 'size') bits.push(`size ${v}`);
    else bits.push(`${s.label.toLowerCase()} ${v}${s.unit === 'mm' ? ' mm' : ` ${s.unit}`}`);
  }
  if (metal) bits.push(getMetal(metal).short);
  if (stone) bits.push(stone === 'none' ? 'no stones' : getStone(stone).short);
  let out = bits.length ? `${type.label}: ${bits.join(', ')}.` : `${type.label} with default settings.`;
  if (suggested) out += ` (Tip: this sounds like a ${suggested.replace('-', ' ')}.)`;
  return out;
}
