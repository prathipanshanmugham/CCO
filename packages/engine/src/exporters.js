// Print/view exporters: binary STL, OBJ, 3MF (zip), GLB (hand-written glTF 2.0 binary), print pack.
// Pure JS: no DOM, FileReader or Blob — works in Node and the browser.
import { zipSync, strToU8 } from 'fflate';
import { collectMeshes, worldData, computeVolumeMm3, weightG, countTriangles } from './volume.js';
import { getMetal, getStone } from './catalog.js';

export { countTriangles };

const GENERATOR = '@clelia/engine';

// ---------------------------------------------------------------- STL ----

/** Binary STL (mm), world-transformed. Metal only unless { includeStones: true }. */
export function exportSTL(group, { includeStones = false } = {}) {
  const items = collectMeshes(group, { includeStones }).map((it) => worldData(it.mesh));
  const triCount = items.reduce((a, d) => a + d.index.length / 3, 0);
  const buf = new ArrayBuffer(84 + 50 * triCount);
  const dv = new DataView(buf);
  const header = `${GENERATOR} binary STL, units=mm`;
  for (let i = 0; i < 80; i++) dv.setUint8(i, i < header.length ? header.charCodeAt(i) : 0x20);
  dv.setUint32(80, triCount, true);
  let o = 84;
  for (const { positions: P, index: I } of items) {
    for (let i = 0; i < I.length; i += 3) {
      const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true);
      o += 12;
      for (const k of [a, b, c]) {
        dv.setFloat32(o, P[k], true); dv.setFloat32(o + 4, P[k + 1], true); dv.setFloat32(o + 8, P[k + 2], true);
        o += 12;
      }
      dv.setUint16(o, 0, true);
      o += 2;
    }
  }
  return buf;
}

// ---------------------------------------------------------------- OBJ ----

const num = (x) => {
  const s = x.toFixed(4);
  return s === '-0.0000' ? '0.0000' : s;
};

/** Wavefront OBJ (mm) with one `o` block per part. Stones included unless { includeStones: false }. */
export function exportOBJ(group, { includeStones = true } = {}) {
  const lines = [`# ${GENERATOR} — units: millimetres`];
  let base = 1;
  for (const it of collectMeshes(group, { includeStones })) {
    const { positions: P, index: I } = worldData(it.mesh);
    lines.push(`o ${safeName(it.name)}_${it.kind}`);
    for (let i = 0; i < P.length; i += 3) lines.push(`v ${num(P[i])} ${num(P[i + 1])} ${num(P[i + 2])}`);
    for (let i = 0; i < I.length; i += 3) lines.push(`f ${I[i] + base} ${I[i + 1] + base} ${I[i + 2] + base}`);
    base += P.length / 3;
  }
  return lines.join('\n') + '\n';
}

const safeName = (s) => String(s).replace(/[^A-Za-z0-9_-]+/g, '_');
const xmlEsc = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

/** Weld coincident vertices (1e-4 mm grid) and drop degenerate triangles → edge-shared mesh. */
function weld(positions, index) {
  const map = new Map();
  const verts = [];
  const remap = new Uint32Array(positions.length / 3);
  for (let i = 0; i < positions.length / 3; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    let id = map.get(key);
    if (id === undefined) {
      id = verts.length / 3;
      map.set(key, id);
      verts.push(x, y, z);
    }
    remap[i] = id;
  }
  const tris = [];
  for (let i = 0; i < index.length; i += 3) {
    const a = remap[index[i]], b = remap[index[i + 1]], c = remap[index[i + 2]];
    if (a !== b && b !== c && a !== c) tris.push(a, b, c);
  }
  return { verts, tris };
}

// ---------------------------------------------------------------- 3MF ----

/**
 * 3MF package (Uint8Array zip). One <object> per part; metal parts are placed in the <build>.
 * Stones are included as non-built objects (type="other") unless { includeStones: false }.
 */
export function export3MF(group, { title = 'Clelia & Co. piece', includeStones = true } = {}) {
  const items = collectMeshes(group, { includeStones });
  const metalId = group.userData?.metal;
  const stoneId = group.userData?.stone;
  const metalColor = (metalId ? getMetal(metalId).color : '#D4AF37') + 'FF';
  const stoneColor = (stoneId && stoneId !== 'none' ? getStone(stoneId).color : '#FFFFFF') + 'D9';
  const x = [];
  x.push('<?xml version="1.0" encoding="UTF-8"?>');
  x.push('<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">');
  x.push(` <metadata name="Title">${xmlEsc(title)}</metadata>`);
  x.push(` <metadata name="Application">${GENERATOR}</metadata>`);
  x.push(' <resources>');
  x.push(`  <basematerials id="1"><base name="metal" displaycolor="${metalColor}"/><base name="stone" displaycolor="${stoneColor}"/></basematerials>`);
  const build = [];
  let id = 2;
  for (const it of items) {
    const { positions, index } = worldData(it.mesh);
    const { verts, tris } = weld(positions, index);
    if (!tris.length) continue;
    const isMetal = it.kind === 'metal';
    x.push(`  <object id="${id}" type="${isMetal ? 'model' : 'other'}" name="${xmlEsc(it.name)}" pid="1" pindex="${isMetal ? 0 : 1}">`);
    x.push('   <mesh>');
    x.push('    <vertices>');
    const vs = [];
    for (let i = 0; i < verts.length; i += 3) vs.push(`<vertex x="${num(verts[i])}" y="${num(verts[i + 1])}" z="${num(verts[i + 2])}"/>`);
    x.push(vs.join('\n'));
    x.push('    </vertices>');
    x.push('    <triangles>');
    const ts = [];
    for (let i = 0; i < tris.length; i += 3) ts.push(`<triangle v1="${tris[i]}" v2="${tris[i + 1]}" v3="${tris[i + 2]}"/>`);
    x.push(ts.join('\n'));
    x.push('    </triangles>');
    x.push('   </mesh>');
    x.push('  </object>');
    if (isMetal) build.push(id);
    id++;
  }
  x.push(' </resources>');
  x.push(' <build>');
  for (const b of build) x.push(`  <item objectid="${b}"/>`);
  x.push(' </build>');
  x.push('</model>');

  const contentTypes = '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
  return zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rels),
    '3D/3dmodel.model': strToU8(x.join('\n')),
  }, { level: 6, mtime: new Date('2024-01-01T00:00:00Z') });
}

// ---------------------------------------------------------------- GLB ----

/**
 * glTF 2.0 binary. One mesh/primitive per part with POSITION + NORMAL (+ min/max) and indices.
 * Vertex data stays in millimetres; by default a root node scales by 0.001 so viewers/AR see
 * real size in metres ({ units: 'mm' } leaves it unscaled).
 */
export function exportGLB(group, { units = 'm' } = {}) {
  const items = collectMeshes(group);
  const chunks = [];
  let byteLength = 0;
  const bufferViews = [], accessors = [], meshes = [], materials = [], nodes = [];
  const pushView = (typed, target) => {
    const pad = (4 - (byteLength % 4)) % 4;
    if (pad) { chunks.push(new Uint8Array(pad)); byteLength += pad; }
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    chunks.push(bytes);
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.byteLength, target });
    byteLength += bytes.byteLength;
    return bufferViews.length - 1;
  };
  const minmax = (arr) => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < arr.length; i += 3) for (let k = 0; k < 3; k++) {
      if (arr[i + k] < min[k]) min[k] = arr[i + k];
      if (arr[i + k] > max[k]) max[k] = arr[i + k];
    }
    return { min, max };
  };
  const extensionsUsed = new Set();

  for (const it of items) {
    const { positions, normals, index } = worldData(it.mesh);
    const vCount = positions.length / 3;
    const pv = pushView(positions, 34962);
    accessors.push({ bufferView: pv, componentType: 5126, count: vCount, type: 'VEC3', ...minmax(positions) });
    const posAcc = accessors.length - 1;
    const nrm = normals || new Float32Array(positions.length);
    const nv = pushView(nrm, 34962);
    accessors.push({ bufferView: nv, componentType: 5126, count: vCount, type: 'VEC3', ...minmax(nrm) });
    const nrmAcc = accessors.length - 1;
    const small = vCount <= 65535;
    const idx = small ? Uint16Array.from(index) : index;
    const iv = pushView(idx, 34963);
    accessors.push({ bufferView: iv, componentType: small ? 5123 : 5125, count: idx.length, type: 'SCALAR' });
    const idxAcc = accessors.length - 1;

    const m = it.mesh.material || {};
    const c = m.color || { r: 0.8, g: 0.8, b: 0.8 };
    const isStone = it.kind === 'stone';
    const mat = {
      name: m.name || it.kind,
      pbrMetallicRoughness: {
        baseColorFactor: [c.r, c.g, c.b, isStone ? 0.85 : 1],
        metallicFactor: m.metalness ?? (isStone ? 0 : 1),
        roughnessFactor: m.roughness ?? 0.2,
      },
    };
    if (isStone) {
      mat.alphaMode = 'BLEND';
      mat.doubleSided = false;
      mat.extensions = {
        KHR_materials_ior: { ior: m.ior ?? 2.42 },
        KHR_materials_transmission: { transmissionFactor: m.transmission ?? 1 },
      };
      extensionsUsed.add('KHR_materials_ior').add('KHR_materials_transmission');
    }
    materials.push(mat);
    meshes.push({ name: it.name, primitives: [{ attributes: { POSITION: posAcc, NORMAL: nrmAcc }, indices: idxAcc, material: materials.length - 1, mode: 4 }] });
    nodes.push({ name: it.name, mesh: meshes.length - 1, extras: { kind: it.kind } });
  }
  const children = nodes.map((_, i) => i);
  const root = { name: group.name || 'piece', children, extras: { units: 'mm', ...(group.userData?.pieceType ? { pieceType: group.userData.pieceType } : {}) } };
  if (units !== 'mm') root.scale = [0.001, 0.001, 0.001];
  nodes.push(root);

  const json = {
    asset: { version: '2.0', generator: GENERATOR },
    scene: 0,
    scenes: [{ nodes: [nodes.length - 1] }],
    nodes, meshes, materials, accessors, bufferViews,
    buffers: [{ byteLength: Math.ceil(byteLength / 4) * 4 }],
  };
  if (extensionsUsed.size) json.extensionsUsed = [...extensionsUsed];
  if (!meshes.length) { delete json.meshes; delete json.accessors; delete json.bufferViews; delete json.materials; json.buffers = []; }

  let jsonBytes = strToU8(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  const binLen = Math.ceil(byteLength / 4) * 4;
  const total = 12 + 8 + jsonBytes.length + jsonPad + (binLen ? 8 + binLen : 0);
  const out = new ArrayBuffer(total);
  const dv = new DataView(out);
  const u8 = new Uint8Array(out);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length + jsonPad, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  u8.set(jsonBytes, 20);
  for (let i = 0; i < jsonPad; i++) u8[20 + jsonBytes.length + i] = 0x20;
  if (binLen) {
    let o = 20 + jsonBytes.length + jsonPad;
    dv.setUint32(o, binLen, true);
    dv.setUint32(o + 4, 0x004e4942, true); // 'BIN\0'
    o += 8;
    for (const c of chunks) { u8.set(c, o); o += c.byteLength; }
  }
  return out;
}

// ---------------------------------------------------------- print pack ----

const README = (spec) => `CLELIA & CO. / SCORPLING — PRINT & CAST PACK
=============================================
${spec.summary || ''}

Files
-----
model.stl   Metal only, binary STL, millimetres. Use this for slicing.
model.3mf   Same metal parts as build items (mm); stones included as non-printed reference objects.
model.obj   All parts incl. stones (reference / rendering), millimetres.
model.glb   Preview model for viewers / AR (real size, metres scale node).
spec.json   Piece parameters, metal volume, estimated weight, dimensions and stone list.

Printing (castable resin / wax)
-------------------------------
* Use a castable resin or wax printer (25–50 µm layers). Print at 100 % plus shrinkage allowance.
* SHRINKAGE: scale the model up by 2–3 % (1.02–1.03) to compensate for investment + metal
  shrinkage. Confirm the factor with your caster for this alloy (${spec.metal?.label || 'see spec.json'}).
* Ring sizes are modelled on the inner diameter (${spec.meta?.innerDiameterMm ? spec.meta.innerDiameterMm.toFixed(2) + ' mm' : 'see spec.json'});
  verify with a ring gauge after printing — sizing up/down after casting is possible but costly.
* Orient so stone seats and the visible top face up and supports land on the inner / back surfaces.
* Wash and cure per resin maker's instructions; castable resins need a slow burnout cycle.

Spruing
-------
* Attach the main sprue to the THICKEST section, away from detail: ring → bottom of the shank
  opposite the head; pendant → back of the body near the bail; chains → cast links in short
  trees or cast the loop as a whole only if your caster agrees.
* Use a 2.5–3.5 mm wax sprue for pieces over ~5 g, add feeder sprues to isolated thick areas
  (heads, halo frames, cuban domes) so they don't shrink-porosity.
* Keep sprue joints smooth and flared; avoid sprues on pavé faces.

Stones
------
* Stones are NOT cast. Seats/prongs are approximations — check each seat against the actual stone
  and cut seats with a bur before setting. Pavé beads are modelled for raising over stones.
* Stone list with sizes and approximate carat weights is in spec.json.

Weight
------
Estimated metal weight ${spec.weightG?.toFixed?.(2) ?? '?'} g (${spec.volumeMm3?.toFixed?.(1) ?? '?'} mm³), excluding sprues and
finishing loss (allow ~5–8 % extra metal for casting, 2–4 % finishing loss).
Overlapping sub-parts are summed separately, so the estimate errs slightly high.
`;

/** Zip with model.stl/3mf/obj/glb + spec.json + README.txt. */
export function printPack(group, meta = {}) {
  const u = group.userData || {};
  const metalId = meta.metal || u.metal || 'gold-18k';
  const metal = getMetal(metalId);
  const volumeMm3 = computeVolumeMm3(group);
  const weight = weightG(volumeMm3, metalId);
  group.updateMatrixWorld(true);
  const spec = {
    ...meta,
    generator: GENERATOR,
    units: 'mm',
    pieceType: meta.pieceType || u.pieceType,
    metal: { id: metal.id, label: metal.label, densityGcm3: metal.densityGcm3 },
    stone: (meta.stone || u.stone) ?? null,
    params: meta.params || u.params,
    summary: meta.summary || u.summary,
    volumeMm3: +volumeMm3.toFixed(2),
    weightG: +weight.toFixed(3),
    weightsByMetalG: Object.fromEntries(['gold-24k', 'gold-22k', 'gold-18k', 'gold-14k', 'rose-gold-18k', 'white-gold-18k', 'silver-925', 'platinum-950'].map((id) => [id, +weightG(volumeMm3, id).toFixed(2)])),
    dimensions: u.dimensions || null,
    stones: u.stones || [],
    stoneCount: (u.stones || []).reduce((a, s) => a + s.count, 0),
    triangles: { metal: countTriangles(group, { includeStones: false }), total: countTriangles(group) },
    casting: { shrinkageAllowancePct: [2, 3], suggestedScale: 1.025 },
  };
  const title = meta.title || spec.summary || 'Clelia & Co. piece';
  return zipSync({
    'model.stl': new Uint8Array(exportSTL(group)),
    'model.3mf': [export3MF(group, { title }), { level: 0 }],
    'model.obj': strToU8(exportOBJ(group)),
    'model.glb': new Uint8Array(exportGLB(group)),
    'spec.json': strToU8(JSON.stringify(spec, null, 2)),
    'README.txt': strToU8(README({ ...spec, metal, meta: u.meta || {} })),
  }, { level: 6 });
}
