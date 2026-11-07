import path from 'node:path';

const env = process.env;
const required = (k) => {
  if (!env[k]) throw new Error(`Missing required environment variable ${k}`);
  return env[k];
};

export const config = {
  env: env.NODE_ENV || 'development',
  isProd: env.NODE_ENV === 'production',
  port: Number(env.PORT || 4000),
  appSecret: required('APP_SECRET'),
  publicUrl: (env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, ''),
  storageDir: path.resolve(env.STORAGE_DIR || './storage'),
  razorpay: {
    keyId: env.RAZORPAY_KEY_ID || '',
    keySecret: env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  admin: {
    email: env.ADMIN_EMAIL || 'admin@cleliaandco.com',
    password: env.ADMIN_PASSWORD || '',
    name: env.ADMIN_NAME || 'Studio Admin',
  },
  aiImagesPerIpPerDay: Number(env.AI_IMAGES_PER_IP_PER_DAY || 30),
  sessionHours: 12,
  cookieName: 'clelia_session',
};

if (config.appSecret.length < 24) throw new Error('APP_SECRET must be at least 24 characters');
