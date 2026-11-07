// @clelia/engine — procedural jewellery geometry in real millimetres.
export { PIECE_TYPES, METALS, STONES } from './catalog.js';
export { paramSchema, defaultParams, ringSizeToDiameterMm } from './params.js';
export { interpretPrompt, seedFromPrompt } from './prompt.js';
export { buildPiece, describePiece } from './build.js';
export { computeVolumeMm3, weightG } from './volume.js';
export { exportSTL, exportOBJ, export3MF, exportGLB, printPack } from './exporters.js';
