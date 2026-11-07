// Materials for metal and stone parts. No textures/images, so they work in Node,
// in the browser, and translate cleanly into glTF PBR values.
import { MeshPhysicalMaterial, Color } from 'three';
import { getMetal, getStone, METALS, STONES } from './catalog.js';

export { METALS, STONES };

/** Polished casting metal → MeshPhysicalMaterial. */
export function metalMaterial(metalId) {
  const m = getMetal(metalId);
  const mat = new MeshPhysicalMaterial({
    name: `metal:${m.id}`,
    color: new Color(m.color),
    metalness: m.metalness,
    roughness: m.roughness,
    clearcoat: 0.25,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.2,
  });
  mat.userData = { kind: 'metal', metalId: m.id };
  return mat;
}

/** Gemstone → transmissive MeshPhysicalMaterial (refraction, dispersion, clearcoat). */
export function stoneMaterial(stoneId) {
  const s = getStone(stoneId === 'none' ? 'diamond' : stoneId);
  const mat = new MeshPhysicalMaterial({
    name: `stone:${s.id}`,
    color: new Color(s.color),
    metalness: 0,
    roughness: s.roughness,
    transmission: s.transmission,
    ior: s.ior,
    thickness: s.thickness,
    attenuationColor: new Color(s.attenuationColor),
    attenuationDistance: s.attenuationDistance,
    specularIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0,
    envMapIntensity: 2,
    flatShading: true,
  });
  mat.dispersion = s.dispersion; // r163+
  mat.userData = { kind: 'stone', stoneId: s.id };
  return mat;
}
