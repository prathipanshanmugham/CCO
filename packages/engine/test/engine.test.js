import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { unzipSync, strFromU8 } from 'fflate';
import * as engine from '../src/index.js';
import { metalMaterial, stoneMaterial } from '../src/materials.js';
import { countTriangles } from '../src/exporters.js';

const {
  PIECE_TYPES, METALS, STONES, paramSchema, defaultParams, ringSizeToDiameterMm, interpretPrompt, seedFromPrompt,
  buildPiece, computeVolumeMm3, weightG, exportSTL, exportOBJ, export3MF, exportGLB, printPack, describePiece,
} = engine;

// Sane metal weight bounds (grams, 18k yellow gold, default params, any of the 3 variants).
const WEIGHT_BOUNDS = {
  ring: [1, 15],
  pendant: [0.5, 20],
  earrings: [0.2, 15],
  bracelet: [2, 60],
  bangle: [5, 60],
  chain: [2, 60],
  'cuban-chain': [30, 400],
  grillz: [3, 80],
  'nose-pin': [0.1, 1],
};
const CHAINS = new Set(['chain', 'cuban-chain', 'bracelet']);

function parseGLB(buf) {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(...new Uint8Array(buf, 0, 4));
  const jsonLen = dv.getUint32(12, true);
  assert.equal(dv.getUint32(16, true), 0x4e4f534a, 'first chunk is JSON');
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  return { magic, version: dv.getUint32(4, true), length: dv.getUint32(8, true), json };
}

test('public API exports exactly the documented names', () => {
  assert.deepEqual(Object.keys(engine).sort(), [
    'METALS', 'PIECE_TYPES', 'STONES', 'buildPiece', 'computeVolumeMm3', 'defaultParams', 'describePiece', 'export3MF',
    'exportGLB', 'exportOBJ', 'exportSTL', 'interpretPrompt', 'paramSchema', 'printPack', 'ringSizeToDiameterMm',
    'seedFromPrompt', 'weightG',
  ].sort());
});

test('catalogues', () => {
  assert.deepEqual(PIECE_TYPES.map((p) => p.id), ['ring', 'pendant', 'earrings', 'bracelet', 'bangle', 'chain', 'cuban-chain', 'grillz', 'nose-pin']);
  assert.deepEqual(PIECE_TYPES.filter((p) => p.group === 'iced').map((p) => p.id), ['cuban-chain', 'grillz']);
  assert.equal(METALS.find((m) => m.id === 'gold-18k').densityGcm3, 15.6);
  assert.equal(METALS.find((m) => m.id === 'platinum-950').densityGcm3, 21.4);
  assert.equal(METALS.length, 8);
  assert.deepEqual(STONES.map((s) => s.id), ['none', 'diamond', 'lab-diamond', 'moissanite', 'ruby', 'emerald', 'sapphire', 'cz']);
  for (const m of METALS) assert.ok(metalMaterial(m.id).isMeshPhysicalMaterial);
  const sm = stoneMaterial('emerald');
  assert.ok(sm.isMeshPhysicalMaterial && sm.transmission > 0 && sm.clearcoat > 0);
});

test('param schemas: 3–7 params, defaults within range', () => {
  for (const t of PIECE_TYPES) {
    const schema = paramSchema(t.id);
    assert.ok(schema.length >= 3 && schema.length <= 7, `${t.id} has ${schema.length} params`);
    const d = defaultParams(t.id);
    for (const s of schema) {
      if (s.type === 'range') assert.ok(d[s.key] >= s.min && d[s.key] <= s.max, `${t.id}.${s.key}`);
      else assert.ok(s.options.some((o) => o.value === d[s.key]), `${t.id}.${s.key}`);
    }
  }
});

test('ring sizes (Indian chart)', () => {
  assert.ok(Math.abs(ringSizeToDiameterMm(12) - 16.5) < 0.1);
  assert.ok(Math.abs(ringSizeToDiameterMm(1) - 13.0) < 0.1);
  assert.ok(Math.abs(ringSizeToDiameterMm(30) - 22.3) < 0.1);
  for (let n = 2; n <= 30; n++) assert.ok(ringSizeToDiameterMm(n) > ringSizeToDiameterMm(n - 1));
  for (let n = 1; n <= 30; n++) assert.ok(Math.abs(ringSizeToDiameterMm(n) - (12.7 + 0.32 * n)) < 0.25);
});

test('volume sanity: torus vs 2π²Rr²', () => {
  const R = 9, r = 1;
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(R, r, 32, 128), metalMaterial('gold-18k'));
  mesh.userData.kind = 'metal';
  const g = new THREE.Group().add(mesh);
  const v = computeVolumeMm3(g);
  const analytic = 2 * Math.PI ** 2 * R * r * r;
  assert.ok(Math.abs(v - analytic) / analytic < 0.05, `${v} vs ${analytic}`);
  assert.ok(Math.abs(weightG(1000, 'gold-18k') - 15.6) < 1e-9);
  // stones are ignored
  const st = new THREE.Mesh(new THREE.SphereGeometry(3), stoneMaterial('diamond'));
  st.userData.kind = 'stone';
  g.add(st);
  assert.ok(Math.abs(computeVolumeMm3(g) - v) < 1e-6);
});

test('interpretPrompt keyword rules', () => {
  let r = interpretPrompt('Thin twisted rose gold ring with a 4mm halo emerald, size 14', 'ring');
  assert.equal(r.params.profile, 'twisted');
  assert.equal(r.params.head, 'halo');
  assert.equal(r.params.stoneMm, 4);
  assert.equal(r.params.size, 14);
  assert.ok(r.params.bandWidth < 2.5);
  assert.equal(r.metal, 'rose-gold-18k');
  assert.equal(r.stone, 'emerald');
  assert.ok(r.styleTags.includes('twisted') && r.styleTags.includes('halo'));
  assert.equal(typeof r.summary, 'string');

  r = interpretPrompt('wide bold pavé band size 7', 'ring');
  assert.equal(r.params.profile, 'pave');
  assert.equal(r.params.size, 7);
  assert.ok(r.params.bandWidth >= 4);

  assert.equal(interpretPrompt('dainty heart pendant 6 mm diamond', 'pendant').params.shape, 'heart');
  assert.equal(interpretPrompt('dainty heart pendant 6 mm diamond', 'pendant').params.stoneMm, 6);
  assert.equal(interpretPrompt('gold hoop earrings 25mm', 'earrings').params.style, 'hoop');
  assert.equal(interpretPrompt('gold hoop earrings 25mm', 'earrings').params.sizeMm, 25);
  assert.equal(interpretPrompt('fully iced cuban 12mm 22 inch', 'cuban-chain').params.pave, 'full');
  assert.equal(interpretPrompt('fully iced cuban 12mm 22 inch', 'cuban-chain').params.width, 12);
  assert.ok(Math.abs(interpretPrompt('fully iced cuban 12mm 22 inch', 'cuban-chain').params.length - 560) <= 10);
  assert.equal(interpretPrompt('cuban link chain', 'chain').suggestedPieceType, 'cuban-chain');
  assert.equal(interpretPrompt('rope chain 3mm', 'chain').params.style, 'rope');
  assert.equal(interpretPrompt('rope chain 3mm', 'chain').params.gauge, 3);
  assert.equal(interpretPrompt('iced out grillz 8 teeth', 'grillz').params.style, 'pave');
  assert.equal(interpretPrompt('iced out grillz 8 teeth', 'grillz').params.teeth, 8);
  assert.equal(interpretPrompt('1 carat solitaire platinum', 'ring').params.stoneMm, 6.5);
  assert.equal(interpretPrompt('1 carat solitaire platinum', 'ring').metal, 'platinum-950');
  assert.equal(interpretPrompt('22k gold plain wedding band', 'ring').params.head, 'none');
  assert.equal(interpretPrompt('22k gold plain wedding band', 'ring').metal, 'gold-22k');
  assert.equal(interpretPrompt('faceted bangle 2.6 inch', 'bangle').params.pattern, 'faceted');
  assert.ok(Math.abs(interpretPrompt('faceted bangle 2.6 inch', 'bangle').params.innerDiameter - 66) < 0.6);
  assert.equal(interpretPrompt('L shaped nose pin', 'nose-pin').params.style, 'l-shape');
  assert.deepEqual(interpretPrompt('', 'ring').params, {});
});

test('seedFromPrompt is deterministic and prompt-sensitive', () => {
  assert.equal(seedFromPrompt('Twisted Halo  ring'), seedFromPrompt('twisted halo ring'));
  assert.notEqual(seedFromPrompt('twisted halo ring'), seedFromPrompt('twisted halo ring!'));
  assert.ok(Number.isInteger(seedFromPrompt('x')) && seedFromPrompt('x') >= 0);
});

test('builds are deterministic', () => {
  const a = buildPiece({ pieceType: 'ring', prompt: 'twisted halo', variant: 1 });
  const b = buildPiece({ pieceType: 'ring', prompt: 'twisted halo', variant: 1 });
  assert.equal(a.volumeMm3, b.volumeMm3);
  assert.equal(a.triangles, b.triangles);
});

test('variants differ but respect prompt-locked params', () => {
  const vs = [0, 1, 2].map((variant) => buildPiece({ pieceType: 'ring', variant }));
  assert.equal(new Set(vs.map((v) => JSON.stringify(v.params))).size, 3);
  const prompt = 'halo ring';
  const locked = [0, 1, 2].map((variant) => buildPiece({ pieceType: 'ring', prompt, params: { ...defaultParams('ring'), ...interpretPrompt(prompt, 'ring').params }, variant }));
  for (const r of locked) assert.equal(r.params.head, 'halo');
  assert.equal(new Set(locked.map((v) => v.params.profile)).size, 3);
});

test('ring outer diameter for size 12 is 14–30 mm', () => {
  const r = buildPiece({ pieceType: 'ring', params: { size: 12, head: 'none' } });
  assert.ok(r.dimensions.widthMm >= 14 && r.dimensions.widthMm <= 30, JSON.stringify(r.dimensions));
  assert.ok(r.stoneCount === 0);
});

test('stone "none" yields metal-only pieces', () => {
  for (const t of PIECE_TYPES) {
    const r = buildPiece({ pieceType: t.id, stone: 'none' });
    assert.equal(r.parts.filter((p) => p.kind === 'stone').length, 0, t.id);
    assert.equal(r.stoneCount, 0, t.id);
  }
});

const triReport = {};
for (const t of PIECE_TYPES) {
  describe(`piece: ${t.id}`, () => {
    for (const variant of [0, 1, 2]) {
      test(`variant ${variant}`, async () => {
        const res = buildPiece({ pieceType: t.id, metal: 'gold-18k', stone: 'diamond', params: defaultParams(t.id), prompt: `classic ${t.id}`, variant });
        const { group } = res;
        assert.ok(group.isGroup);
        assert.ok(res.parts.length >= 1);
        for (const p of res.parts) {
          assert.ok(p.mesh.isMesh);
          assert.equal(p.mesh.material.userData.kind, p.kind);
        }
        // centred, +Y up, mm
        const box = new THREE.Box3().setFromObject(group);
        const c = box.getCenter(new THREE.Vector3());
        assert.ok(c.length() < 1e-3, `centre ${c.toArray()}`);

        assert.ok(res.volumeMm3 > 0);
        assert.ok(Math.abs(computeVolumeMm3(group) - res.volumeMm3) < 0.05);
        const [lo, hi] = WEIGHT_BOUNDS[t.id];
        assert.ok(res.weightG >= lo && res.weightG <= hi, `${t.id} v${variant} weight ${res.weightG} g not in [${lo}, ${hi}]`);
        const { widthMm, heightMm, depthMm } = res.dimensions;
        for (const d of [widthMm, heightMm, depthMm]) assert.ok(d > 0.5 && d < 300, `dims ${JSON.stringify(res.dimensions)}`);
        if (t.id === 'ring') assert.ok(widthMm >= 14 && widthMm <= 30);

        const tris = countTriangles(group);
        triReport[`${t.id} v${variant}`] = tris;
        assert.ok(tris < (CHAINS.has(t.id) ? 150000 : 60000), `${t.id} v${variant}: ${tris} triangles`);

        // STL
        const stl = exportSTL(group);
        const metalTris = countTriangles(group, { includeStones: false });
        assert.equal(stl.byteLength, 84 + 50 * metalTris);
        assert.equal(new DataView(stl).getUint32(80, true), metalTris);
        const stlAll = exportSTL(group, { includeStones: true });
        assert.equal(stlAll.byteLength, 84 + 50 * tris);

        // 3MF
        const files = unzipSync(export3MF(group, { title: res.summary }));
        assert.ok(files['[Content_Types].xml'] && files['_rels/.rels']);
        const model = strFromU8(files['3D/3dmodel.model']);
        assert.ok(model.includes('unit="millimeter"'));
        assert.ok(/<build>\s*<item objectid="\d+"\/>/.test(model));
        assert.ok(model.includes('<triangle v1='));

        // GLB
        const glb = exportGLB(group);
        const { magic, version, length, json } = parseGLB(glb);
        assert.equal(magic, 'glTF');
        assert.equal(version, 2);
        assert.equal(length, glb.byteLength);
        assert.ok(json.meshes.length >= 1);
        for (const m of json.meshes) {
          const acc = json.accessors[m.primitives[0].attributes.POSITION];
          assert.ok(Array.isArray(acc.min) && Array.isArray(acc.max));
        }
        if (res.stoneCount) assert.ok(json.materials.some((m) => m.alphaMode === 'BLEND' && m.pbrMetallicRoughness.baseColorFactor[3] === 0.85));
        // loads in three's GLTFLoader
        const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(glb, '', resolve, reject));
        let loadedMeshes = 0;
        gltf.scene.traverse((o) => { if (o.isMesh) loadedMeshes++; });
        assert.equal(loadedMeshes, res.parts.length);

        // OBJ
        const obj = exportOBJ(group);
        assert.ok(/^v /m.test(obj) && /^f /m.test(obj) && /^o /m.test(obj));

        // summary
        assert.equal(res.summary, describePiece({ pieceType: t.id, metal: 'gold-18k', stone: 'diamond', params: res.params }, res));
        assert.ok(/Approx\. [\d.]+ g/.test(res.summary));
      });
    }
  });
}

test('every select option builds a sane, watertight-volume piece', () => {
  for (const t of PIECE_TYPES) {
    for (const s of paramSchema(t.id).filter((x) => x.type === 'select')) {
      for (const o of s.options) {
        const r = buildPiece({ pieceType: t.id, params: { [s.key]: o.value } });
        assert.ok(r.volumeMm3 > 0 && r.weightG > 0, `${t.id} ${s.key}=${o.value}`);
        assert.ok(r.triangles < (CHAINS.has(t.id) ? 150000 : 60000), `${t.id} ${s.key}=${o.value}: ${r.triangles}`);
      }
    }
  }
});

test('extreme params stay within triangle budgets', () => {
  const cases = [
    ['chain', { style: 'rope', length: 600, gauge: 1.5 }],
    ['chain', { style: 'curb', length: 600, gauge: 1.5 }],
    ['cuban-chain', { width: 6, length: 760, pave: 'full' }],
    ['cuban-chain', { width: 20, length: 760, pave: 'full' }],
    ['bangle', { width: 20, pattern: 'stone-set' }],
    ['ring', { size: 30, bandWidth: 8, profile: 'twisted', head: 'halo', stoneMm: 8 }],
    ['grillz', { teeth: 8, style: 'pave', height: 12 }],
  ];
  for (const [type, params] of cases) {
    const r = buildPiece({ pieceType: type, params });
    assert.ok(r.triangles < (CHAINS.has(type) ? 150000 : 60000), `${type} ${JSON.stringify(params)}: ${r.triangles}`);
    assert.ok(r.weightG > 0);
  }
});

test('printPack contains all files and a consistent spec', () => {
  const res = buildPiece({ pieceType: 'ring', metal: 'platinum-950', stone: 'sapphire', prompt: 'halo sapphire ring' });
  const zip = unzipSync(printPack(res.group, { orderId: 'TEST-1' }));
  for (const f of ['model.stl', 'model.3mf', 'model.obj', 'model.glb', 'spec.json', 'README.txt']) assert.ok(zip[f], f);
  const spec = JSON.parse(strFromU8(zip['spec.json']));
  assert.equal(spec.orderId, 'TEST-1');
  assert.equal(spec.metal.id, 'platinum-950');
  assert.ok(Math.abs(spec.volumeMm3 - res.volumeMm3) < 0.05);
  assert.ok(Math.abs(spec.weightG - res.weightG) < 0.01);
  assert.ok(spec.stones.length >= 1 && spec.stoneCount === res.stoneCount);
  assert.ok(/shrinkage/i.test(strFromU8(zip['README.txt'])));
  assert.ok(unzipSync(zip['model.3mf'])['3D/3dmodel.model']);
});

test('describePiece sample', () => {
  const s = describePiece(
    { pieceType: 'ring', metal: 'gold-18k', stone: 'emerald', params: { profile: 'twisted', bandWidth: 2.4, head: 'halo', stoneMm: 4, size: 12 } },
    { weightG: 3.1 },
  );
  assert.equal(s, '18k yellow gold twisted band (size 12), 2.4 mm wide, with a 4 mm halo-set emerald. Approx. 3.1 g.');
});

test('triangle report', () => {
  console.log('\nTriangles per piece (default params):');
  for (const [k, v] of Object.entries(triReport)) console.log(`  ${k.padEnd(16)} ${String(v).padStart(7)}`);
});
