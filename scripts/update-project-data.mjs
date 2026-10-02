import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'finxyora.sqlite');

const db = new DatabaseSync(DB_PATH);

console.log('Running database updates...');

// 1. Update Admin User to 'fintech student' / 'finxyora26'
const salt = bcrypt.genSaltSync(10);
const passwordHash = bcrypt.hashSync('finxyora26', salt);

db.prepare(`
  DELETE FROM admin_users;
`).run();

db.prepare(`
  INSERT INTO admin_users (id, username, password_hash, display_name, role, created_at)
  VALUES ('admin-fintech', 'fintech student', ?, 'FinTech Student Admin', 'admin', ?)
`).run(passwordHash, new Date().toISOString());

console.log('✅ Admin credentials updated: username="fintech student", password="finxyora26"');

// 2. Update Event STAR QUAS to BEST CFO
// Check if star-quas exists, update it to best-cfo
const starQuas = db.prepare("SELECT * FROM events WHERE id = 'star-quas' OR id = 'best-cfo'").get();
if (starQuas) {
  db.prepare(`
    UPDATE events
    SET id = 'best-cfo',
        title = 'BEST CFO',
        category = 'Chief Financial Officer Strategy, Corporate Finance & Treasury',
        description = 'The ultimate corporate treasury and financial leadership trial. Step into the shoes of a Chief Financial Officer allocating capital, mitigating systemic risks, modeling liquidity, and presenting strategic valuations to the board.',
        updated_at = ?
    WHERE id = 'star-quas' OR id = 'best-cfo'
  `).run(new Date().toISOString());
  console.log('✅ Event renamed: STAR QUAS -> BEST CFO (id: best-cfo)');
}

// 3. Update Stall Options total_stalls to 25 pooled capacity
db.prepare(`
  UPDATE stall_options
  SET total_stalls = 25;
`).run();
console.log('✅ Stall options total_stalls updated to 25 pooled capacity');

// 4. Update Site Settings with finxyora@gmail.com and star_quas_title -> best_cfo_title
const settingsUpdates = {
  contact_email: 'finxyora@gmail.com',
  star_quas_title: 'BEST CFO',
  college_name: 'Bishop Heber College',
  event_venue: 'Golden Jubilee Building',
  event_dates: 'November 12 & 13, 2026',
};

const insertSetting = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(settingsUpdates)) {
  insertSetting.run(k, v);
}
console.log('✅ Site settings updated with finxyora@gmail.com and BEST CFO');

// Checkpoint WAL
db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
db.close();

console.log('\nAll database updates applied successfully!');
