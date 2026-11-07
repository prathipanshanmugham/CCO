// Query helpers shared by routes.
import { one, query } from '../lib/db.js';

export const findDesign = (id) => one('SELECT * FROM designs WHERE id = $1', [id]);

// Quote + design + payments + staff names, as one object.
export async function loadQuote(where, params) {
  const q = await one(`SELECT q.*, row_to_json(d.*) AS design,
      json_build_object('id', a.id, 'name', a.name) AS assigned_to,
      json_build_object('id', p.id, 'name', p.name) AS prepared_by,
      json_build_object('id', ap.id, 'name', ap.name) AS approved_by
    FROM quotes q JOIN designs d ON d.id = q.design_id
    LEFT JOIN users a ON a.id = q.assigned_to_id LEFT JOIN users p ON p.id = q.prepared_by_id LEFT JOIN users ap ON ap.id = q.approved_by_id
    WHERE ${where}`, params);
  if (!q) return null;
  q.design = camelDeep(q.design);
  for (const k of ['assignedTo', 'preparedBy', 'approvedBy']) if (!q[k]?.id) q[k] = null;
  q.payments = await query('SELECT * FROM payments WHERE quote_id = $1 ORDER BY created_at DESC', [q.id]);
  return q;
}

export const camelDeep = (r) => { if (!r) return r; const o = {}; for (const k in r) o[k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())] = r[k]; return o; };
