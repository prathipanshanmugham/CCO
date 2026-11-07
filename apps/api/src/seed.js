// Demo accounts for a staging server. Do not run on production.
import bcrypt from 'bcryptjs';
import { query, pool } from './lib/db.js';
const pw = await bcrypt.hash('clelia123', 11);
for (const [email, name, role] of [['admin@cleliaandco.com', 'Studio Admin', 'ADMIN'], ['manager@cleliaandco.com', 'Arjun M', 'MANAGER'], ['staff@cleliaandco.com', 'Kavya R', 'STAFF']]) {
  await query('INSERT INTO users (email, name, role, password_hash, must_change_pw) VALUES ($1,$2,$3,$4,true) ON CONFLICT (email) DO NOTHING', [email, name, role, pw]);
}
console.log('Seeded demo accounts (password clelia123; change on first login).');
await pool.end();
