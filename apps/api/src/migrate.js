import { migrate, pool } from './lib/db.js';
migrate().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
