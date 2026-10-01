import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'finxyora.sqlite');

const db = new DatabaseSync(DB_PATH);

const updates = {
  college_name:             'Bishop Heber College',
  college_department:       'Department of Commerce & FinTech Association',
  college_address:          'Bishop Heber College, Puthur, Tiruchirappalli – 620 017, Tamil Nadu',
  college_logo_text:        'BHC FINTECH',
  event_dates:              'November 12 & 13, 2026',
  event_countdown_target:   '2026-11-12T09:00:00',
  event_venue:              'Golden Jubilee Building',
  contact_phone:            '9159911721 / 8682879906',
  contact_email:            'finxyora@bishopheber.edu.in',
};

const stmt = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
for (const [key, value] of Object.entries(updates)) {
  stmt.run(key, value);
  console.log(`✓  ${key} = ${value}`);
}

db.close();
console.log('\n✅ Site settings updated successfully! Refresh the browser to see changes.');
