// AES-256-GCM for secrets at rest (AI provider keys). Key derived from APP_SECRET.
import crypto from 'node:crypto';
import { config } from './config.js';

const key = crypto.scryptSync(config.appSecret, 'clelia-ai-keys-v1', 32);

export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`;
}

export function decrypt(blob) {
  const [v, iv, tag, data] = String(blob).split('.');
  if (v !== 'v1') throw new Error('Unknown ciphertext version');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const hmacSha256 = (secret, s) => crypto.createHmac('sha256', secret).update(s).digest('hex');
export const safeEqual = (a, b) => {
  const A = Buffer.from(String(a)); const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};
