// Thin data layer over node-postgres. Rows come back camelCased; writes take camelCase objects.
import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool, types } = pg;
types.setTypeParser(20, (v) => Number(v)); // bigint → number
types.setTypeParser(1700, (v) => Number(v)); // numeric → number

export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
pool.on('error', (e) => console.error('pg pool error', e));

const camel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const snake = (s) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
export const rowOut = (r) => { if (!r) return r; const o = {}; for (const k in r) o[camel(k)] = r[k]; return o; };

export async function query(text, params = [], client = pool) {
  const res = await client.query(text, params);
  return res.rows.map(rowOut);
}
export const one = async (text, params, client) => (await query(text, params, client))[0] || null;

const jsonish = (v) => (v !== null && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v);

export async function insert(table, data, client = pool) {
  const keys = Object.keys(data);
  const cols = keys.map(snake).join(', ');
  const ph = keys.map((_, i) => `$${i + 1}`).join(', ');
  return one(`INSERT INTO ${table} (${cols}) VALUES (${ph}) RETURNING *`, keys.map((k) => jsonish(data[k])), client);
}

export async function update(table, id, data, client = pool) {
  const keys = Object.keys(data);
  if (!keys.length) return one(`SELECT * FROM ${table} WHERE id = $1`, [id], client);
  const sets = keys.map((k, i) => `${snake(k)} = $${i + 2}`).join(', ');
  return one(`UPDATE ${table} SET ${sets} WHERE id = $1 RETURNING *`, [id, ...keys.map((k) => jsonish(data[k]))], client);
}

export async function tx(fn) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const out = await fn(client); await client.query('COMMIT'); return out; }
  catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

// Runs any .sql file in /migrations that has not been applied yet, in name order.
export async function migrate(log = console) {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');
  await pool.query('CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const done = new Set((await query('SELECT name FROM _migrations')).map((r) => r.name));
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = await fs.readFile(path.join(dir, f), 'utf8');
    await tx(async (c) => { await c.query(sql); await c.query('INSERT INTO _migrations (name) VALUES ($1)', [f]); });
    (log.info || log.log).call(log, `applied migration ${f}`);
  }
}
