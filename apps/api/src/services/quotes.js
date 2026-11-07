import { one } from '../lib/db.js';
import { conflict } from '../lib/errors.js';

// Status machine. Keys: from-status → { action: to-status }. Permission for each action is in routes.
export const TRANSITIONS = {
  NEW:               { claim: 'IN_REVIEW', decline: 'DECLINED', cancel: 'CANCELLED' },
  IN_REVIEW:         { submit: 'PENDING_APPROVAL', decline: 'DECLINED', cancel: 'CANCELLED' },
  PENDING_APPROVAL:  { approve: 'QUOTED', sendBack: 'CHANGES_REQUESTED', cancel: 'CANCELLED' },
  CHANGES_REQUESTED: { submit: 'PENDING_APPROVAL', decline: 'DECLINED', cancel: 'CANCELLED' },
  QUOTED:            { accept: 'ACCEPTED', revise: 'IN_REVIEW', decline: 'DECLINED', cancel: 'CANCELLED', expire: 'DECLINED' },
  ACCEPTED:          { startProduction: 'IN_PRODUCTION', cancel: 'CANCELLED' },
  IN_PRODUCTION:     { ready: 'READY', cancel: 'CANCELLED' },
  READY:             { ship: 'SHIPPED', complete: 'COMPLETED' },
  SHIPPED:           { complete: 'COMPLETED' },
  COMPLETED:         {},
  DECLINED:          { reopen: 'IN_REVIEW' },
  CANCELLED:         {},
};

export const STATUS_LABELS = {
  NEW: 'New request', IN_REVIEW: 'Under review', PENDING_APPROVAL: 'Awaiting manager approval', CHANGES_REQUESTED: 'Changes requested',
  QUOTED: 'Quote sent', ACCEPTED: 'Accepted', IN_PRODUCTION: 'In production', READY: 'Ready', SHIPPED: 'Shipped',
  COMPLETED: 'Completed', DECLINED: 'Declined', CANCELLED: 'Cancelled',
};

export function nextStatus(current, action) {
  const to = TRANSITIONS[current]?.[action];
  if (!to) throw conflict(`Cannot "${action}" a quote that is ${STATUS_LABELS[current] || current}`);
  return to;
}

export function timelineEntry(quote, status, by, note) {
  return [...(quote.timeline || []), { status, at: new Date().toISOString(), by: by || 'customer', note: note || undefined }];
}

// CLC-YYMM-NNNN (Scorpling: SCP-). Sequence per month, race-safe via retry on unique violation.
export async function nextRef(brand = 'CLELIA') {
  const now = new Date();
  const ym = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `${brand === 'SCORPLING' ? 'SCP' : 'CLC'}-${ym}-`;
  const last = await one('SELECT ref FROM quotes WHERE ref LIKE $1 ORDER BY ref DESC LIMIT 1', [prefix + '%']);
  const n = last ? Number(last.ref.slice(prefix.length)) + 1 : 101;
  return `${prefix}${String(n).padStart(4, '0')}`;
}

// What the customer may see. Never leak staff notes, internal ids or cost overrides.
export function customerView(q) {
  return {
    ref: q.ref, status: q.status, statusLabel: STATUS_LABELS[q.status], brand: q.brand,
    customerName: q.customerName, city: q.city, state: q.state, pincode: q.pincode,
    createdAt: q.createdAt, quotedAt: q.quotedAt, acceptedAt: q.acceptedAt, validUntil: q.validUntil,
    total: q.total, advancePercent: q.advancePercent,
    priceBreakdown: q.status === 'QUOTED' || ['ACCEPTED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'COMPLETED'].includes(q.status)
      ? { lines: q.priceBreakdown?.lines, subtotal: q.priceBreakdown?.subtotal, gst: q.priceBreakdown?.gst, gstPercent: q.priceBreakdown?.gstPercent, total: q.priceBreakdown?.total, weightG: q.priceBreakdown?.weightG }
      : null,
    approvalNote: q.approvalNote, declineReason: q.declineReason,
    timeline: (q.timeline || []).map((t) => ({ status: t.status, label: STATUS_LABELS[t.status], at: t.at })),
    design: q.design && {
      id: q.design.id, pieceType: q.design.pieceType, metal: q.design.metal, stone: q.design.stone, prompt: q.design.prompt,
      summary: q.design.summary, weightG: q.design.weightG, dimensions: q.design.dimensions, params: q.design.params,
      aiImages: q.design.aiImages, previewPath: q.design.previewPath,
      modelFiles: (q.design.modelFiles || []).filter((f) => f.ext === '.glb').map((f) => ({ ext: f.ext, url: f.url })),
    },
    payments: (q.payments || []).filter((p) => p.status === 'PAID').map((p) => ({ kind: p.kind, amount: p.amount, paidAt: p.paidAt, method: p.method })),
  };
}
