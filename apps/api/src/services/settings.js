import { one, query } from '../lib/db.js';

// Defaults are seeded once and then edited by admins in Pricing & content.
export const DEFAULT_SETTINGS = {
  pricing: {
    currency: 'INR',
    // Rate per gram in rupees for each metal/purity. Admin updates these with the day's rate.
    metalRates: {
      'gold-24k': 7850, 'gold-22k': 7200, 'gold-18k': 5890, 'gold-14k': 4600,
      'rose-gold-18k': 5890, 'white-gold-18k': 5990,
      'silver-925': 98, 'platinum-950': 3300,
    },
    wastagePercent: 8,
    makingPerGram: 650,
    makingMinimum: 2500,
    designFee: 1500,
    printAndCasting: 1200,
    gstPercent: 3,
    stoneRates: {        // per stone, rupees, by stone id and size bucket
      diamond: { small: 4500, medium: 14000, large: 42000 },
      'lab-diamond': { small: 1200, medium: 3800, large: 11000 },
      moissanite: { small: 600, medium: 1800, large: 5200 },
      ruby: { small: 900, medium: 3200, large: 9800 },
      emerald: { small: 1100, medium: 3600, large: 11000 },
      sapphire: { small: 900, medium: 3100, large: 9400 },
      cz: { small: 60, medium: 140, large: 320 },
      none: { small: 0, medium: 0, large: 0 },
    },
    advancePercent: 50,
    quoteValidDays: 7,
    scorplingSurchargePercent: 0,
  },
  content: {
    studioTitle: 'Design your own piece',
    studioIntro: 'Describe the jewellery you have in mind. We turn it into a 3D design you can see, size and price before anything is made.',
    scorplingIntro: 'Iced-out, stone-set and bold. Design it, see it in 3D, wear it.',
    leadTimeDays: '14–21',
    supportPhone: '',
    supportEmail: 'hello@cleliaandco.com',
    whatsapp: '',
    termsNote: 'Prices depend on the live metal rate on the day of confirmation. The advance is adjusted in the final invoice.',
  },
  ai: {
    mode: 'live',          // live | paused
    imagesPerDesign: 3,
    maxPromptChars: 600,
    style: 'studio product photograph, soft light, neutral background, high detail, photorealistic jewellery render',
    negative: 'text, watermark, hands, model, person, blurry',
  },
};

const cache = new Map();

export async function getSetting(key) {
  if (cache.has(key)) return cache.get(key);
  const row = await one('SELECT * FROM settings WHERE key = $1', [key]);
  const value = row ? { ...DEFAULT_SETTINGS[key], ...row.value } : DEFAULT_SETTINGS[key];
  cache.set(key, value);
  return value;
}

export async function setSetting(key, value) {
  const merged = { ...DEFAULT_SETTINGS[key], ...value };
  await query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, JSON.stringify(merged)]);
  cache.set(key, merged);
  return merged;
}

export async function ensureDefaults() {
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    await query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, JSON.stringify(DEFAULT_SETTINGS[key])]);
  }
}

export function publicContent(content, pricing) {
  return { ...content, gstPercent: pricing.gstPercent, advancePercent: pricing.advancePercent, metals: Object.keys(pricing.metalRates) };
}
