// AI image generation. Keys live only here (encrypted in the database); the browser only ever
// receives finished image URLs. Supports OpenRouter (default), OpenAI and Google Gemini.
import { one, query, insert, update } from '../lib/db.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { saveBuffer, designDir } from './storage.js';
import { getSetting } from './settings.js';
import { badRequest, HttpError } from '../lib/errors.js';

export const PROVIDERS = {
  openrouter: {
    label: 'OpenRouter',
    help: 'One key, many image models. Get it at openrouter.ai/keys.',
    keyPrefix: 'sk-or-',
    models: [
      { id: 'google/gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (Nano Banana)', costUsd: 0.039 },
      { id: 'google/gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image', costUsd: 0.134 },
      { id: 'black-forest-labs/flux.2-pro', label: 'FLUX.2 Pro', costUsd: 0.03 },
      { id: 'bytedance-seed/seedream-4.0', label: 'Seedream 4.0', costUsd: 0.03 },
      { id: 'openai/gpt-5-image-mini', label: 'GPT-5 Image Mini', costUsd: 0.02 },
    ],
  },
  openai: {
    label: 'OpenAI',
    help: 'Direct OpenAI key (platform.openai.com). Billing on your OpenAI account.',
    keyPrefix: 'sk-',
    models: [
      { id: 'gpt-image-1-mini', label: 'GPT Image 1 Mini', costUsd: 0.011 },
      { id: 'gpt-image-1', label: 'GPT Image 1', costUsd: 0.042 },
    ],
  },
  gemini: {
    label: 'Google Gemini',
    help: 'Google AI Studio key (aistudio.google.com). Has a free tier.',
    keyPrefix: 'AIza',
    models: [
      { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image', costUsd: 0.039 },
    ],
  },
};

export function providerInfo(p) {
  if (!PROVIDERS[p]) throw badRequest('Unknown provider');
  return PROVIDERS[p];
}

export function costFor(provider, model) {
  return PROVIDERS[provider]?.models.find((m) => m.id === model)?.costUsd ?? 0.04;
}

// ---------- key management (admin only; called from routes/admin-ai.js) ----------

export async function listProviders() {
  const rows = await query('SELECT * FROM ai_providers ORDER BY created_at');
  return Object.entries(PROVIDERS).map(([id, meta]) => {
    const row = rows.find((r) => r.provider === id);
    return {
      provider: id, label: meta.label, help: meta.help, models: meta.models,
      configured: !!row, keyLast4: row?.keyLast4, model: row?.model || meta.models[0].id,
      enabled: row?.enabled ?? false, isDefault: row?.isDefault ?? false,
      monthlyBudgetUsd: row?.monthlyBudgetUsd, lastTestAt: row?.lastTestAt, lastTestOk: row?.lastTestOk, lastTestError: row?.lastTestError,
      updatedAt: row?.updatedAt,
    };
  });
}

export async function saveProviderKey({ provider, apiKey, model, userId }) {
  const meta = providerInfo(provider);
  const key = String(apiKey || '').trim();
  if (key.length < 20) throw badRequest('That does not look like a valid API key');
  if (!key.startsWith(meta.keyPrefix)) throw badRequest(`${meta.label} keys start with "${meta.keyPrefix}"`);
  const chosen = model && meta.models.some((m) => m.id === model) ? model : meta.models[0].id;
  const { n } = await one('SELECT count(*)::int AS n FROM ai_providers');
  return one(`INSERT INTO ai_providers (provider, key_ciphertext, key_last4, model, enabled, is_default, updated_by_id)
    VALUES ($1,$2,$3,$4,true,$5,$6)
    ON CONFLICT (provider) DO UPDATE SET key_ciphertext = EXCLUDED.key_ciphertext, key_last4 = EXCLUDED.key_last4, model = EXCLUDED.model,
      enabled = true, updated_by_id = EXCLUDED.updated_by_id, last_test_ok = NULL, last_test_error = NULL
    RETURNING *`, [provider, encrypt(key), key.slice(-4), chosen, n === 0, userId]);
}

export async function updateProvider(provider, patch, userId) {
  const meta = providerInfo(provider);
  const data = { updatedById: userId };
  if (patch.model !== undefined) {
    if (!meta.models.some((m) => m.id === patch.model)) throw badRequest('Unknown model for this provider');
    data.model = patch.model;
  }
  if (patch.enabled !== undefined) data.enabled = !!patch.enabled;
  if (patch.monthlyBudgetUsd !== undefined) data.monthlyBudgetUsd = patch.monthlyBudgetUsd === null ? null : Number(patch.monthlyBudgetUsd);
  if (patch.isDefault) {
    await query('UPDATE ai_providers SET is_default = false');
    data.isDefault = true;
  }
  const row = await one('SELECT id FROM ai_providers WHERE provider = $1', [provider]);
  if (!row) throw badRequest('Add a key first');
  return update('ai_providers', row.id, data);
}

export async function removeProvider(provider) {
  const row = await one('DELETE FROM ai_providers WHERE provider = $1 RETURNING *', [provider]);
  if (!row) return;
  if (row.isDefault) await query('UPDATE ai_providers SET is_default = true WHERE id = (SELECT id FROM ai_providers WHERE enabled ORDER BY created_at LIMIT 1)');
}

async function activeProvider() {
  const settings = await getSetting('ai');
  if (settings.mode === 'paused') return null;
  const row = await one('SELECT * FROM ai_providers WHERE enabled ORDER BY is_default DESC, created_at ASC LIMIT 1');
  if (!row) return null;
  if (row.monthlyBudgetUsd) {
    const agg = await one(`SELECT coalesce(sum(cost_usd),0) AS spent FROM ai_usage WHERE provider = $1 AND created_at >= date_trunc('month', now())`, [row.provider]);
    if (agg.spent >= row.monthlyBudgetUsd) return { ...row, overBudget: true };
  }
  return row;
}

// What the customer app may know: only whether live images are available.
export async function publicAiStatus() {
  const p = await activeProvider();
  const settings = await getSetting('ai');
  return { live: !!p && !p.overBudget, imagesPerDesign: settings.imagesPerDesign };
}

// ---------- prompt ----------

export function buildPrompt({ pieceType, metal, stone, prompt, styleTags = [], brand }, aiSettings) {
  const metalWords = metal.replace(/-/g, ' ').replace(/(\d+)k/, '$1 karat');
  const stoneWords = stone && stone !== 'none' ? `set with ${stone.replace('-', ' ')} stones` : 'no stones';
  const vibe = brand === 'SCORPLING' ? 'iced-out hip-hop style, densely pavé set, bold and heavy' : 'fine jewellery, elegant proportions';
  const tags = styleTags.length ? styleTags.join(', ') : '';
  return `A single ${pieceType} in ${metalWords}, ${stoneWords}. ${prompt}. ${tags}. ${vibe}. ${aiSettings.style}. Avoid: ${aiSettings.negative}.`;
}

// ---------- generation ----------

const fetchJson = async (url, init) => {
  const res = await fetch(url, init);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || json?.raw || res.statusText;
    throw new HttpError(502, `Image provider error: ${String(msg).slice(0, 300)}`);
  }
  return json;
};

const dataUrlToBuffer = (u) => {
  const m = /^data:(image\/\w+);base64,(.+)$/.exec(u);
  if (!m) throw new Error('Unexpected image format');
  return { mime: m[1], buf: Buffer.from(m[2], 'base64') };
};

async function callOpenRouter(key, model, prompt) {
  const json = await fetchJson('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://cleliaandco.com', 'X-Title': 'Clelia & Co. Design Studio' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], modalities: ['image', 'text'] }),
  });
  const imgs = json.choices?.[0]?.message?.images || [];
  if (!imgs.length) throw new HttpError(502, 'The model returned no image. Try a different model in AI settings.');
  return imgs.map((i) => dataUrlToBuffer(i.image_url?.url || i.url));
}

async function callOpenAI(key, model, prompt) {
  const json = await fetchJson('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, n: 1, size: '1024x1024', quality: 'medium' }),
  });
  return (json.data || []).map((d) => ({ mime: 'image/png', buf: Buffer.from(d.b64_json, 'base64') }));
}

async function callGemini(key, model, prompt) {
  const json = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } }),
  });
  const parts = json.candidates?.[0]?.content?.parts || [];
  const out = parts.filter((p) => p.inlineData).map((p) => ({ mime: p.inlineData.mimeType, buf: Buffer.from(p.inlineData.data, 'base64') }));
  if (!out.length) throw new HttpError(502, 'Gemini returned no image.');
  return out;
}

const CALLERS = { openrouter: callOpenRouter, openai: callOpenAI, gemini: callGemini };

async function generateOne(row, prompt) {
  const key = decrypt(row.keyCiphertext);
  return CALLERS[row.provider](key, row.model, prompt);
}

// Generates N images for a design, saves them, logs usage, returns public URLs.
export async function generateDesignImages(design, { count } = {}) {
  const row = await activeProvider();
  if (!row) throw new HttpError(503, 'AI images are paused right now. Your 3D design still works.');
  if (row.overBudget) throw new HttpError(503, 'This month\'s AI image budget is used up. Your 3D design still works.');
  const aiSettings = await getSetting('ai');
  const n = Math.min(Number(count || aiSettings.imagesPerDesign), 4);
  const prompt = buildPrompt(design, aiSettings);
  const urls = [];
  const started = Date.now();
  let error;
  // Sequential requests keep provider rate limits happy; images are small.
  for (let i = 0; i < n; i++) {
    try {
      const imgs = await generateOne(row, prompt + (i ? ` Variation ${i + 1}: a different angle and composition.` : ''));
      for (const img of imgs.slice(0, 1)) {
        const ext = img.mime === 'image/jpeg' ? '.jpg' : img.mime === 'image/webp' ? '.webp' : '.png';
        const rel = `${designDir(design.id)}/ai-${Date.now()}-${i}${ext}`;
        await saveBuffer(rel, img.buf);
        urls.push(`/api/files/${rel}`);
      }
    } catch (e) {
      error = e.message;
      if (!urls.length && i === 0) break; // first call failed: surface the error
    }
  }
  await insert('ai_usage', {
    provider: row.provider, model: row.model, designId: design.id, images: urls.length,
    costUsd: urls.length * costFor(row.provider, row.model), ms: Date.now() - started, ok: urls.length > 0, error: error?.slice(0, 500) ?? null,
  });
  if (!urls.length) throw new HttpError(502, error || 'No images were generated');
  return { urls, prompt, provider: row.provider, model: row.model, warning: error };
}

export async function testProvider(provider) {
  const row = await one('SELECT * FROM ai_providers WHERE provider = $1', [provider]);
  if (!row) throw badRequest('Add a key first');
  const started = Date.now();
  try {
    const imgs = await generateOne(row, 'A small plain gold band ring on a white background, product photo.');
    const img = imgs[0];
    const rel = `tmp/test-${provider}-${Date.now()}.png`;
    await saveBuffer(rel, img.buf);
    await update('ai_providers', row.id, { lastTestAt: new Date(), lastTestOk: true, lastTestError: null });
    await insert('ai_usage', { provider, model: row.model, images: 1, costUsd: costFor(provider, row.model), ms: Date.now() - started, ok: true });
    return { ok: true, url: `/api/files/${rel}`, ms: Date.now() - started };
  } catch (e) {
    await update('ai_providers', row.id, { lastTestAt: new Date(), lastTestOk: false, lastTestError: e.message.slice(0, 500) });
    await insert('ai_usage', { provider, model: row.model, images: 0, costUsd: 0, ms: Date.now() - started, ok: false, error: e.message.slice(0, 500) });
    return { ok: false, error: e.message, ms: Date.now() - started };
  }
}

export async function usageSummary() {
  const agg = (where) => one(`SELECT coalesce(sum(cost_usd),0) AS cost_usd, coalesce(sum(images),0)::int AS images, count(*)::int AS calls, count(*) FILTER (WHERE NOT ok)::int AS failures FROM ai_usage WHERE ${where}`);
  const [month, last30, byProvider, recent] = await Promise.all([
    agg(`created_at >= date_trunc('month', now())`),
    agg(`created_at >= now() - interval '30 days'`),
    query(`SELECT provider, model, coalesce(sum(cost_usd),0) AS cost_usd, coalesce(sum(images),0)::int AS images, count(*)::int AS calls FROM ai_usage WHERE created_at >= now() - interval '30 days' GROUP BY provider, model ORDER BY cost_usd DESC`),
    query('SELECT * FROM ai_usage ORDER BY created_at DESC LIMIT 25'),
  ]);
  return { month, last30, byProvider, recent };
}
