export const inr = (paiseOrRupees, { paise = true } = {}) => {
  const v = paise ? paiseOrRupees / 100 : paiseOrRupees;
  return '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};
export const rupees = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
export const date = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
export const ago = (d) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
export const grams = (g) => (g == null ? '—' : `${Number(g).toFixed(2)} g`);
export const title = (s) => String(s || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const metalLabel = (m) => title(m).replace(/(\d+)k/i, '$1K');
export const usd = (v) => '$' + Number(v || 0).toFixed(2);

export const STATUS_TONE = {
  NEW: 'tone-new', IN_REVIEW: 'tone-review', PENDING_APPROVAL: 'tone-approval', CHANGES_REQUESTED: 'tone-review', QUOTED: 'tone-quoted',
  ACCEPTED: 'tone-ok', IN_PRODUCTION: 'tone-accent', READY: 'tone-ok', SHIPPED: 'tone-ok', COMPLETED: 'tone-ok', DECLINED: 'tone-bad', CANCELLED: 'tone-bad',
};
export const STATUS_LABELS = {
  NEW: 'New request', IN_REVIEW: 'Under review', PENDING_APPROVAL: 'Awaiting approval', CHANGES_REQUESTED: 'Changes requested', QUOTED: 'Quote sent',
  ACCEPTED: 'Accepted', IN_PRODUCTION: 'In production', READY: 'Ready', SHIPPED: 'Shipped', COMPLETED: 'Completed', DECLINED: 'Declined', CANCELLED: 'Cancelled',
};
