# @clelia/engine

Procedural, parametric jewellery geometry in **real millimetres** for Clelia & Co. (classic) and
Scorpling (iced). It builds three.js groups for the studio viewer, estimates metal volume and weight,
and exports print-ready STL / 3MF / OBJ / GLB files. It is plain ES modules with no build step, and it runs
the same in the browser (Vite) and in Node 20+ (no DOM, FileReader or Blob).

```js
import { buildPiece, interpretPrompt, defaultParams, exportSTL, printPack } from '@clelia/engine';
import { metalMaterial, stoneMaterial } from '@clelia/engine/materials';

const prompt = 'thin twisted rose gold ring with a 4mm halo emerald, size 14';
const hint = interpretPrompt(prompt, 'ring');            // { params, metal, stone, styleTags, summary, locked }
const params = { ...defaultParams('ring'), ...hint.params };
const options = [0, 1, 2].map((variant) =>
  buildPiece({ pieceType: 'ring', metal: hint.metal ?? 'gold-18k', stone: hint.stone ?? 'diamond', params, prompt, variant }));
scene.add(options[0].group);                              // mm units, +Y up, centred at the origin
options[0].summary; // "18k rose gold twisted band (size 14), 1.8 mm wide, with a 4 mm halo-set emerald. Approx. 2.4 g."
```

In the app, dedupe three (`resolve.dedupe: ['three']` in Vite) so the engine and the viewer share one copy.
The engine is tested against three 0.183.

## API (`src/index.js`)

| Export | Description |
| --- | --- |
| `PIECE_TYPES` | `{ id, label, group }` for ring, pendant, earrings, bracelet, bangle, chain, cuban-chain*, grillz*, nose-pin (* = `group: 'iced'`). |
| `METALS` | `{ id, label, short, densityGcm3, color, roughness, metalness }` for gold-24k/22k/18k/14k, rose-gold-18k, white-gold-18k, silver-925, platinum-950. |
| `STONES` | `{ id, label, short, color, ior, transmission, dispersion, roughness, thickness, attenuation*, densityGcm3 }` for none, diamond, lab-diamond, moissanite, ruby, emerald, sapphire, cz. |
| `paramSchema(type)` | Slider specs: `{ key, label, type: 'range'|'select', min, max, step, unit, options: [{value,label}], default }`. Each piece type has 3 to 6 params. |
| `defaultParams(type)` | Defaults from the schema. |
| `ringSizeToDiameterMm(size)` | Indian ring size (1 to 30, fractional sizes allowed) to inner diameter, from the standard chart (12 → 16.5 mm). |
| `interpretPrompt(prompt, type)` | Deterministic keyword rules → `{ params, styleTags, summary, metal, stone, suggestedPieceType, locked }`. `params` only holds keys the prompt mentioned. |
| `seedFromPrompt(prompt)` | FNV-1a hash (uint32) of the normalised prompt. Varies small details such as prong count, twist pitch, strand count, pavé size and facet count. |
| `buildPiece(spec)` | `spec = { pieceType, metal, stone, params, prompt, variant }` → `{ group, volumeMm3, weightG, dimensions:{widthMm,heightMm,depthMm}, summary, stoneCount, stones, parts:[{name,kind,mesh}], params, triangles, seed, variant, meta }`. |
| `computeVolumeMm3(object3D)` | Sum of signed tetrahedron volumes over all **metal** mesh triangles in world space. Stones are ignored. |
| `weightG(volumeMm3, metalId)` | `volume / 1000 × density`. |
| `exportSTL(group, {includeStones=false})` | Binary STL `ArrayBuffer` (mm), world-transformed, with face normals. Its byte length is `84 + 50·triangles`. |
| `exportOBJ(group, {includeStones=true})` | OBJ string with one `o` block per part. |
| `export3MF(group, {title, includeStones=true})` | 3MF zip (`Uint8Array`) with `unit="millimeter"` and one `<object>` per part. Vertices are welded so each object is edge-manifold. Only metal objects go in `<build>`; stones are included as `type="other"` objects. |
| `exportGLB(group, {units='m'})` | Hand-written glTF 2.0 binary with one mesh per part, POSITION/NORMAL (with min/max) and indices, and PBR metal/roughness. Stones use `alphaMode: BLEND`, alpha 0.85 and `KHR_materials_ior`/`transmission`. The vertex data is in mm. A root node scales it by 0.001 so viewers and AR show real size; pass `{units:'mm'}` to leave it unscaled. |
| `printPack(group, meta)` | Zip containing `model.stl`, `model.3mf`, `model.obj`, `model.glb`, `spec.json` and `README.txt`. `spec.json` holds `meta`, volume, weight, weight in every metal, dimensions, the stone list with approximate carats, and triangle counts. `README.txt` covers castable-resin printing, 2–3 % shrinkage and spruing. |
| `describePiece(spec, result)` | One-sentence summary for the UI and quotes. |

`@clelia/engine/materials` exports `metalMaterial(id)` and `stoneMaterial(id)`, both `MeshPhysicalMaterial` with no textures.
`stoneMaterial` uses transmission, IOR, dispersion and clearcoat, and stones are flat-shaded so the facets show.

### Variants

`variant` 0 builds the params as given. Variants 1 and 2 step one "style" select param each through a
cycle: ring head then profile, pendant setting then shape, earring style, bracelet style, bangle pattern,
chain style, cuban pavé, grillz style and nose-pin style. A param the prompt mentions explicitly (`interpretPrompt().locked`) is never changed. If every style key is locked, the variant nudges one dimension by ±12 % instead.
The effective params are returned in `result.params`, so the app can adopt them when the customer
picks a variant. The seed mixes in the variant number.

### Geometry conventions

* Units are mm and +Y is up. The group's bounding box is centred on the origin. Each part is one merged mesh
  (`band`, `head`, `stones`, `links`, …), and metal and stone parts are always separate meshes (`mesh.userData.kind`).
* Rings and bangles stand upright with the finger axis along Z and the head at +Y. Pendants, earrings and nose pins face +Z.
  Chains, bracelets and cuban chains lie flat on an oval loop in the XZ plane. Grillz caps follow a
  dental arch in XZ, with the front toward +Z, hanging down.
* Every sub-solid is a closed, outward-oriented manifold built without CSG: Lathe (D/comfort/knife band profiles,
  bezel cups), Tube along rounded-rect, stadium or twist curves (links, twisted bands), Extrude (pendant
  outlines, cuffs, hollow grillz shells), and Torus, Cylinder, Sphere and Capsule. `gemGeometry(d)` (in
  `src/geometry/gem.js`) is a 6·n-triangle round brilliant: table, crown kites and stars, girdle, pavilion.
* Low-poly tubes, cylinders and spheres use an area-compensated radius, so their volume matches the true
  round section. Without it an 8-sided wire under-reports by about 10 %.

### Volume accuracy

Overlapping solids (prongs sunk into a band, beads, domes, link overlaps in a chain) are each closed
and summed separately. This means overlaps are counted twice, a deliberate slight **overestimate**
(usually 1–3 %; up to about 8 % for rope chains, whose links overlap a lot). Grillz are modelled as 0.7 mm shells, not solid
blocks.

## Triangle counts (default params)

Each piece is built with its default params, `classic <type>` as the prompt, and variants 0, 1 and 2.

| Piece | v0 | v1 | v2 |
| --- | --- | --- | --- |
| ring | 10.6k | 13.4k | 13.3k |
| pendant | 3.9k | 6.3k | 3.9k |
| earrings (pair) | 3.6k | 8.6k | 6.2k |
| bracelet | 23.0k | 38.4k | 11.0k |
| bangle | 12.8k | 12.8k | 12.8k |
| chain | 119k | 120k | 15.1k |
| cuban-chain | 120k | 140k | 93.2k |
| grillz | 9.7k | 4.3k | 4.5k |
| nose-pin | 0.6k | 0.7k | 1.7k |

Chains adapt their tube resolution to stay under 150k triangles. Every other piece stays under 60k.

## Tests

```
npm test -w packages/engine      # node --test
```

The tests cover every piece × 3 variants, every select option, extreme params, weight bounds, ring
dimensions, the STL size formula, 3MF and GLB structure (and GLTFLoader round-trip), OBJ, prompt rules,
the ring-size chart and the torus volume check against 2π²Rr².

## Known limitations

* Chains and bracelets lie flat in a static oval; there is no physics drape. Clasps (lobster, box) and earring backs are not modelled.
* Links in curb, rope and cuban chains interpenetrate to suggest interlocking; they are not separable, real-world interlocked loops.
  Staff should print chains as trees or source machine-made chain.
* Stone seats are approximations: pavilions sit inside the metal without a cut seat. Setters must bur the seats.
* There are no initial or letter pendants, so "initial-less" means only the listed shapes are offered.
* The prompt parser uses keyword rules only (English). Unmatched words are ignored.
