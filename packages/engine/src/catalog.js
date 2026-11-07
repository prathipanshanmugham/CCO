// Static catalogues: piece types, metals and stones.
// All densities are g/cm³ (= mg/mm³). Colours are sRGB hex.

/** Piece types offered in the studio. group: 'classic' (Clelia & Co.) | 'iced' (Scorpling). */
export const PIECE_TYPES = Object.freeze([
  { id: 'ring', label: 'Ring', group: 'classic' },
  { id: 'pendant', label: 'Pendant', group: 'classic' },
  { id: 'earrings', label: 'Earrings', group: 'classic' },
  { id: 'bracelet', label: 'Bracelet', group: 'classic' },
  { id: 'bangle', label: 'Bangle', group: 'classic' },
  { id: 'chain', label: 'Chain', group: 'classic' },
  { id: 'cuban-chain', label: 'Cuban Chain', group: 'iced' },
  { id: 'grillz', label: 'Grillz', group: 'iced' },
  { id: 'nose-pin', label: 'Nose Pin', group: 'classic' },
].map(Object.freeze));

/** Casting metals. `short` is the lower-case phrase used in sentences. */
export const METALS = Object.freeze([
  { id: 'gold-24k', label: '24K Yellow Gold', short: '24k yellow gold', densityGcm3: 19.3, color: '#E5B53A', roughness: 0.16, metalness: 1 },
  { id: 'gold-22k', label: '22K Yellow Gold', short: '22k yellow gold', densityGcm3: 17.7, color: '#DDB141', roughness: 0.17, metalness: 1 },
  { id: 'gold-18k', label: '18K Yellow Gold', short: '18k yellow gold', densityGcm3: 15.6, color: '#D4AF37', roughness: 0.18, metalness: 1 },
  { id: 'gold-14k', label: '14K Yellow Gold', short: '14k yellow gold', densityGcm3: 13.5, color: '#CFB45F', roughness: 0.2, metalness: 1 },
  { id: 'rose-gold-18k', label: '18K Rose Gold', short: '18k rose gold', densityGcm3: 15.1, color: '#E0A98F', roughness: 0.18, metalness: 1 },
  { id: 'white-gold-18k', label: '18K White Gold', short: '18k white gold', densityGcm3: 15.9, color: '#E8E8E8', roughness: 0.14, metalness: 1 },
  { id: 'silver-925', label: '925 Sterling Silver', short: 'sterling silver', densityGcm3: 10.4, color: '#E8E8E8', roughness: 0.2, metalness: 1 },
  { id: 'platinum-950', label: 'Platinum 950', short: 'platinum', densityGcm3: 21.4, color: '#D8D8DC', roughness: 0.15, metalness: 1 },
].map(Object.freeze));

/**
 * Gemstones. Optical props map directly onto THREE.MeshPhysicalMaterial.
 * `densityGcm3` is used to estimate carat weight of round brilliants.
 */
export const STONES = Object.freeze([
  { id: 'none', label: 'No stone', short: 'no stone', color: null, ior: 1, transmission: 0, dispersion: 0, roughness: 0, thickness: 0, attenuationColor: '#ffffff', attenuationDistance: Infinity, densityGcm3: 0 },
  { id: 'diamond', label: 'Natural Diamond', short: 'diamond', color: '#FFFFFF', ior: 2.42, transmission: 1, dispersion: 5, roughness: 0, thickness: 1.5, attenuationColor: '#ffffff', attenuationDistance: Infinity, densityGcm3: 3.52 },
  { id: 'lab-diamond', label: 'Lab-grown Diamond', short: 'lab-grown diamond', color: '#FFFFFF', ior: 2.42, transmission: 1, dispersion: 5, roughness: 0, thickness: 1.5, attenuationColor: '#ffffff', attenuationDistance: Infinity, densityGcm3: 3.52 },
  { id: 'moissanite', label: 'Moissanite', short: 'moissanite', color: '#F8FBF4', ior: 2.65, transmission: 1, dispersion: 9, roughness: 0, thickness: 1.5, attenuationColor: '#F4FAEE', attenuationDistance: 12, densityGcm3: 3.21 },
  { id: 'ruby', label: 'Ruby', short: 'ruby', color: '#C3112F', ior: 1.77, transmission: 0.85, dispersion: 1, roughness: 0.02, thickness: 2, attenuationColor: '#9E0B25', attenuationDistance: 2, densityGcm3: 4.0 },
  { id: 'emerald', label: 'Emerald', short: 'emerald', color: '#1F9150', ior: 1.58, transmission: 0.85, dispersion: 0.5, roughness: 0.03, thickness: 2, attenuationColor: '#0F6E38', attenuationDistance: 2, densityGcm3: 2.76 },
  { id: 'sapphire', label: 'Blue Sapphire', short: 'sapphire', color: '#2244B0', ior: 1.77, transmission: 0.85, dispersion: 1, roughness: 0.02, thickness: 2, attenuationColor: '#132E8A', attenuationDistance: 2, densityGcm3: 4.0 },
  { id: 'cz', label: 'Cubic Zirconia', short: 'cubic zirconia', color: '#FFFFFF', ior: 2.15, transmission: 1, dispersion: 6, roughness: 0, thickness: 1.5, attenuationColor: '#ffffff', attenuationDistance: Infinity, densityGcm3: 5.7 },
].map(Object.freeze));

export function getMetal(id) {
  return METALS.find((m) => m.id === id) || METALS.find((m) => m.id === 'gold-18k');
}

export function getStone(id) {
  return STONES.find((s) => s.id === id) || STONES.find((s) => s.id === 'diamond');
}

export function getPieceType(id) {
  const t = PIECE_TYPES.find((p) => p.id === id);
  if (!t) throw new Error(`Unknown pieceType "${id}". Expected one of: ${PIECE_TYPES.map((p) => p.id).join(', ')}`);
  return t;
}
