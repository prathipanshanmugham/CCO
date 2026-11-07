import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../lib/config.js';

const root = config.storageDir;
export const storageRoot = root;

export async function ensureStorage() {
  for (const d of ['designs', 'tmp']) await fs.mkdir(path.join(root, d), { recursive: true });
}

// All paths are relative to the storage root and validated against traversal.
export function resolveSafe(rel) {
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep)) throw new Error('Bad path');
  return abs;
}

export async function saveBuffer(rel, buf) {
  const abs = resolveSafe(rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buf);
  return rel;
}

export const designDir = (designId) => `designs/${designId}`;

export const EXT_MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.stl': 'model/stl', '.3mf': 'model/3mf', '.obj': 'text/plain', '.glb': 'model/gltf-binary', '.zip': 'application/zip',
};
