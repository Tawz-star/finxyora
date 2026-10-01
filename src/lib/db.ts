import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';

// Detect Vercel / serverless environment where root filesystem is read-only
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? '/tmp' : path.join(process.cwd(), 'data');

if (!isServerless && !fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    // Ignore in read-only environments
  }
}

const DB_PATH = path.join(DATA_DIR, 'finxyora.sqlite');

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!_db) {
    // On Vercel / serverless lambda, copy the bundled seed database to /tmp if it doesn't exist yet
    if (isServerless && !fs.existsSync(DB_PATH)) {
      try {
        const seedPath = path.join(process.cwd(), 'data', 'finxyora.sqlite');
        if (fs.existsSync(seedPath)) {
          fs.copyFileSync(seedPath, DB_PATH);
        }
      } catch (err) {
        console.warn('Could not copy seed database to /tmp, will initialize freshly:', err);
      }
    }

    _db = new DatabaseSync(DB_PATH);
    // Optimize performance and enforce foreign keys
    _db.exec('PRAGMA foreign_keys = ON;');
    _db.exec('PRAGMA journal_mode = WAL;');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: DatabaseSync) {
  // 1. Events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      rules TEXT NOT NULL,
      min_participants INTEGER NOT NULL DEFAULT 1,
      max_participants INTEGER NOT NULL DEFAULT 2,
      registration_fee REAL NOT NULL DEFAULT 50,
      fee_type TEXT NOT NULL DEFAULT 'per_team',
      is_open INTEGER NOT NULL DEFAULT 1,
      deadline TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 2. Event Registrations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS event_registrations (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      college_name TEXT NOT NULL,
      college_location TEXT NOT NULL,
      team_name TEXT,
      leader_name TEXT NOT NULL,
      leader_email TEXT NOT NULL,
      leader_phone TEXT NOT NULL,
      participant_count INTEGER NOT NULL,
      total_fee REAL NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_evt_reg_event ON event_registrations(event_id);
    CREATE INDEX IF NOT EXISTS idx_evt_reg_email ON event_registrations(leader_email);
    CREATE INDEX IF NOT EXISTS idx_evt_reg_phone ON event_registrations(leader_phone);
  `);

  // 3. Participants table
  db.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      registration_id TEXT NOT NULL REFERENCES event_registrations(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      roll_number TEXT NOT NULL,
      department TEXT NOT NULL,
      year_of_study TEXT NOT NULL,
      section TEXT NOT NULL,
      participant_order INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_parts_reg ON participants(registration_id);
  `);

  // 4. Stall Options table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stall_options (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      has_electricity INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      total_stalls INTEGER NOT NULL DEFAULT 20,
      is_active INTEGER NOT NULL DEFAULT 1
    );
  `);

  // 5. Stall Bookings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stall_bookings (
      id TEXT PRIMARY KEY,
      option_id TEXT NOT NULL REFERENCES stall_options(id),
      stall_category TEXT NOT NULL,
      applicant_type TEXT NOT NULL,
      entity_name TEXT NOT NULL,
      college_name TEXT,
      department_class TEXT,
      contact_name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      business_details TEXT,
      products_services TEXT NOT NULL,
      stalls_requested INTEGER NOT NULL DEFAULT 1,
      has_electricity INTEGER NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_stl_bk_opt ON stall_bookings(option_id);
    CREATE INDEX IF NOT EXISTS idx_stl_bk_email ON stall_bookings(contact_email);
    CREATE INDEX IF NOT EXISTS idx_stl_bk_phone ON stall_bookings(contact_phone);
  `);

  // 6. Payments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      reference_type TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      gateway_order_id TEXT,
      gateway_payment_id TEXT,
      gateway_signature TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'pending',
      payer_email TEXT,
      payer_phone TEXT,
      payment_method TEXT DEFAULT 'UPI / Gateway',
      idempotency_key TEXT UNIQUE,
      created_at TEXT NOT NULL,
      verified_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pay_ref ON payments(reference_type, reference_id);
    CREATE INDEX IF NOT EXISTS idx_pay_order ON payments(gateway_order_id);
  `);

  // 7. Admin Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );
  `);

  // 8. Audit Logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 9. Site Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  seedInitialData(db);
}

function seedInitialData(db: DatabaseSync) {
  // Check if events are seeded
  const eventCountRow = db.prepare('SELECT COUNT(*) as count FROM events').get() as { count: number };
  if (eventCountRow.count === 0) {
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const insertEvent = db.prepare(`
      INSERT INTO events (id, title, category, description, rules, min_participants, max_participants, registration_fee, fee_type, is_open, deadline, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 1. Prompt Perfect
    insertEvent.run(
      'prompt-perfect',
      'PROMPT PERFECT',
      'Artificial Intelligence & Prompt Engineering',
      'Test your mastery of generative AI, prompt engineering architectures, and algorithmic financial modeling. Formulate context-engineered instructions to generate solutions for real-world FinTech problem statements.',
      JSON.stringify([
        'Maximum team size is strictly 2 participants.',
        'Participants will be evaluated on prompt precision, token efficiency, few-shot prompting, and financial accuracy.',
        'Use of external pre-built automation agents or undisclosed APIs is forbidden.',
        'All prompts and reasoning traces will be reviewed by the evaluation panel.',
        'Rounds include: Rapid Prompt Prototyping, Hallucination Hunting, and FinTech Logic Synthesis.'
      ]),
      2,
      2,
      50,
      'per_team',
      1,
      deadline,
      now,
      now
    );

    // 2. Best Manager
    insertEvent.run(
      'best-manager',
      'BEST MANAGER',
      'Management, Leadership & Decision-Making',
      'The quintessential leadership crucible. Step into the shoes of a corporate executive navigating market volatility, liquidity crunches, board revolts, and hostile takeovers.',
      JSON.stringify([
        'Individual event only: Exactly 1 participant.',
        'Participants must undergo stress interviews, crisis simulation, PR defense, and psychometric evaluation.',
        'Strict formal business attire is mandatory throughout the competition.',
        'Decision-making speed, financial acumen, emotional quotient, and ethical fortitude are heavily weighted.',
        'Finalists will face a grand corporate tribunal in the final round.'
      ]),
      1,
      1,
      50,
      'per_team',
      1,
      deadline,
      now,
      now
    );

    // 3. Corporate Walk
    insertEvent.run(
      'corporate-walk',
      'CORPORATE WALK',
      'Corporate Presentation, Professional Appearance & Business Communication',
      'A synthesis of boardroom poise, sartorial distinction, and thematic stage presence. Portray futuristic corporate governance, sustainable finance, and executive leadership on the grand runway.',
      JSON.stringify([
        'Team size must be between 6 and 8 participants (strictly enforced).',
        'Performance duration: 8 minutes stage time + 2 minutes judge Q&A.',
        'Theme: Futuristic Corporate Governance & FinTech Leadership.',
        'Audio tracks and lighting cues must be submitted to the technical desk 1 hour prior.',
        'Vulgarity, derogatory slogans, or hazardous props will lead to instant disqualification.'
      ]),
      6,
      8,
      50,
      'per_team',
      1,
      deadline,
      now,
      now
    );

    // 4. Star Quas
    insertEvent.run(
      'star-quas',
      'STAR QUAS',
      'Commercial Strategy & FinTech Innovation',
      'A multi-tier corporate challenge deciphering stellar market dynamics, cross-border M&A strategies, and decentralized commerce. Title and rules are fully customizable by organizers.',
      JSON.stringify([
        'Teams must consist of exactly 2 participants.',
        'Round 1: Financial Detective - Uncovering balance sheet irregularities and tax arbitrage.',
        'Round 2: FinTech Venture Pitch - Propose a scalable neo-banking or Web3 micro-lending solution.',
        'Judges will evaluate based on feasibility, regulatory compliance, and unit economics.'
      ]),
      2,
      2,
      50,
      'per_team',
      1,
      deadline,
      now,
      now
    );

    // 5. B Quiz
    insertEvent.run(
      'b-quiz',
      'B QUIZ',
      'FinTech, Blockchain, AI & Emerging Financial Technologies',
      'The battle of intellect spanning digital banking rails, blockchain consensus algorithms, cryptocurrency tokenomics, AI in quantitative trading, and global macroeconomics.',
      JSON.stringify([
        'Team size: Strictly 2 participants.',
        'Preliminary written round of 30 rapid-fire questions covering global finance and technology.',
        'Top 6 teams advance to the live onstage buzzer round.',
        'Negative marking applies in advanced buzzer rounds (+10 / -5).',
        'Electronic gadgets must be switched off during all quiz rounds.'
      ]),
      2,
      2,
      50,
      'per_team',
      1,
      deadline,
      now,
      now
    );

    // 6. Football Auction
    insertEvent.run(
      'football-auction',
      'FOOTBALL AUCTION',
      'Football Strategy, Team Building, Player Auction & Budget Management',
      'Step into the transfer war-room as a football club sporting director. Manage a virtual purse of ₹100 Crores, navigate dynamic bidding wars, enforce salary caps, and craft an elite winning squad.',
      JSON.stringify([
        'Team size: Maximum 3 participants (2 to 3 members).',
        'Every team starts with an identical virtual bank balance of ₹100 Crores.',
        'Mandatory squad criteria: Exactly 15 players with balanced positional requirements (2 GK, 5 DEF, 5 MID, 3 FWD).',
        'Exceeding budget caps or failing position minimums incurs severe penalty points.',
        'Tactical chemistry, base-price bid timing, and squad depth determine the champion.'
      ]),
      2,
      3,
      50,
      'per_team',
      1,
      deadline,
      now,
      now
    );
  }

  // Seed Stall Options
  const stallCountRow = db.prepare('SELECT COUNT(*) as count FROM stall_options').get() as { count: number };
  if (stallCountRow.count === 0) {
    const insertStall = db.prepare(`
      INSERT INTO stall_options (id, category, name, price, has_electricity, description, total_stalls, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStall.run(
      'student-electric',
      'STUDENT',
      'Student Stall (With Electricity)',
      500,
      1,
      'Dedicated booth for student entrepreneurs with power socket access (up to 15A), table, 2 chairs, and promotional banner space.',
      15,
      1
    );

    insertStall.run(
      'student-no-electric',
      'STUDENT',
      'Student Stall (Without Electricity)',
      300,
      0,
      'Standard student exhibition booth with table and 2 chairs. Ideal for dry crafts, stationery, non-electrical products, or games.',
      25,
      1
    );

    insertStall.run(
      'vendor-electric',
      'OUTSIDE_VENDOR',
      'Outside Commercial Vendor Stall',
      3000,
      1,
      'Prime commercial pavilion booth with high-capacity electricity access (up to 30A), 2 tables, 4 chairs, prominent walkway frontage, and festival directory listing.',
      12,
      1
    );
  }

  // Seed Admin User
  const adminCountRow = db.prepare('SELECT COUNT(*) as count FROM admin_users').get() as { count: number };
  if (adminCountRow.count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('Finxyora@Admin2026', salt);
    db.prepare(`
      INSERT INTO admin_users (id, username, password_hash, display_name, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('admin-1', 'admin', hash, 'FinTech Association Convener', 'admin', new Date().toISOString());
  }

  // Seed Site Settings
  const settingsCountRow = db.prepare('SELECT COUNT(*) as count FROM site_settings').get() as { count: number };
  if (settingsCountRow.count === 0) {
    const defaultSettings: Record<string, string> = {
      college_name: 'Bishop Heber College',
      college_department: 'Department of Commerce & FinTech Association',
      college_address: 'Bishop Heber College, Puthur, Tiruchirappalli – 620 017, Tamil Nadu',
      college_logo_text: 'BHC FINTECH',
      event_dates: 'November 12 & 13, 2026',
      event_countdown_target: '2026-11-12T09:00:00',
      event_venue: 'Golden Jubilee Hall',
      contact_email: 'finxyora@bishopheber.edu.in',
      contact_phone: '9159911721 / 8682879906',
      upi_id: 'finxyora@okaxis',
      razorpay_key_id: '',
      razorpay_key_secret: '',
      razorpay_mode: 'sandbox',
      default_event_fee: '50',
      default_fee_rule: 'per_team',
      star_quas_title: 'STAR QUAS',
      registration_deadline: '2026-10-23T23:59:59',
      allow_registrations: '1',
      allow_stalls: '1'
    };

    const insertSetting = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(defaultSettings)) {
      insertSetting.run(key, value);
    }
  }
}

// -------------------------------------------------------------
// HELPER QUERY FUNCTIONS
// -------------------------------------------------------------

export interface EventRecord {
  id: string;
  title: string;
  category: string;
  description: string;
  rules: string;
  min_participants: number;
  max_participants: number;
  registration_fee: number;
  fee_type: 'per_team' | 'per_participant';
  is_open: number;
  deadline: string;
  created_at: string;
  updated_at: string;
}

export interface ParticipantRecord {
  id: string;
  registration_id: string;
  full_name: string;
  roll_number: string;
  department: string;
  year_of_study: string;
  section: string;
  participant_order: number;
}

export interface EventRegistrationRecord {
  id: string;
  event_id: string;
  college_name: string;
  college_location: string;
  team_name?: string;
  leader_name: string;
  leader_email: string;
  leader_phone: string;
  participant_count: number;
  total_fee: number;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  created_at: string;
  updated_at: string;
  participants?: ParticipantRecord[];
  event?: EventRecord;
}

export interface StallOptionRecord {
  id: string;
  category: 'STUDENT' | 'OUTSIDE_VENDOR';
  name: string;
  price: number;
  has_electricity: number;
  description: string;
  total_stalls: number;
  is_active: number;
  booked_count?: number;
  available_stalls?: number;
}

export interface StallBookingRecord {
  id: string;
  option_id: string;
  stall_category: string;
  applicant_type: string;
  entity_name: string;
  college_name?: string;
  department_class?: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  business_details?: string;
  products_services: string;
  stalls_requested: number;
  has_electricity: number;
  total_amount: number;
  status: 'pending' | 'paid' | 'approved' | 'rejected' | 'refunded';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  option_name?: string;
}

export interface PaymentRecord {
  id: string;
  reference_type: 'event' | 'stall';
  reference_id: string;
  gateway_order_id?: string;
  gateway_payment_id?: string;
  gateway_signature?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'successful' | 'failed' | 'refunded';
  payer_email?: string;
  payer_phone?: string;
  payment_method: string;
  idempotency_key?: string;
  created_at: string;
  verified_at?: string;
}

// -------------------------------------------------------------
// EVENTS API
// -------------------------------------------------------------

export function getAllEvents(): EventRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM events ORDER BY created_at ASC').all() as unknown as EventRecord[];
}

export function getEventBySlug(slug: string): EventRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(slug);
  return (row as unknown as EventRecord) || null;
}

export function updateEvent(slug: string, data: Partial<EventRecord>): void {
  const db = getDb();
  const existing = getEventBySlug(slug);
  if (!existing) throw new Error(`Event ${slug} not found`);

  const title = data.title ?? existing.title;
  const category = data.category ?? existing.category;
  const description = data.description ?? existing.description;
  const rules = data.rules ?? existing.rules;
  const min_participants = data.min_participants ?? existing.min_participants;
  const max_participants = data.max_participants ?? existing.max_participants;
  const registration_fee = data.registration_fee ?? existing.registration_fee;
  const fee_type = data.fee_type ?? existing.fee_type;
  const is_open = data.is_open ?? existing.is_open;
  const deadline = data.deadline ?? existing.deadline;
  const updated_at = new Date().toISOString();

  db.prepare(`
    UPDATE events
    SET title = ?, category = ?, description = ?, rules = ?, min_participants = ?, max_participants = ?, registration_fee = ?, fee_type = ?, is_open = ?, deadline = ?, updated_at = ?
    WHERE id = ?
  `).run(title, category, description, rules, min_participants, max_participants, registration_fee, fee_type, is_open, deadline, updated_at, slug);
}

// -------------------------------------------------------------
// EVENT REGISTRATIONS API
// -------------------------------------------------------------

export function createEventRegistration(data: {
  eventId: string;
  collegeName: string;
  collegeLocation: string;
  teamName?: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  participants: Array<{
    fullName: string;
    rollNumber: string;
    department: string;
    yearOfStudy: string;
    section: string;
  }>;
}): { registrationId: string; totalFee: number } {
  const db = getDb();
  const event = getEventBySlug(data.eventId);
  if (!event) throw new Error('Event not found');

  if (!event.is_open) {
    throw new Error('Registration for this event is currently closed.');
  }

  if (event.deadline && new Date() > new Date(event.deadline)) {
    throw new Error('Registration deadline has passed for this event.');
  }

  const participantCount = data.participants.length;
  if (participantCount < event.min_participants || participantCount > event.max_participants) {
    throw new Error(`Participant limit error: ${event.title} requires between ${event.min_participants} and ${event.max_participants} participant(s). Provided: ${participantCount}.`);
  }

  // Calculate Fee
  let totalFee = event.registration_fee;
  if (event.fee_type === 'per_participant') {
    totalFee = event.registration_fee * participantCount;
  }

  // Generate Unique ID
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const registrationId = `FX-EVT-${randomSuffix}`;
  const now = new Date().toISOString();

  // Atomically insert registration and participants
  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare(`
      INSERT INTO event_registrations (id, event_id, college_name, college_location, team_name, leader_name, leader_email, leader_phone, participant_count, total_fee, payment_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      registrationId,
      data.eventId,
      data.collegeName.trim(),
      data.collegeLocation.trim(),
      data.teamName?.trim() || null,
      data.leaderName.trim(),
      data.leaderEmail.trim().toLowerCase(),
      data.leaderPhone.trim(),
      participantCount,
      totalFee,
      now,
      now
    );

    const insertPart = db.prepare(`
      INSERT INTO participants (id, registration_id, full_name, roll_number, department, year_of_study, section, participant_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    data.participants.forEach((p, index) => {
      const partId = `PART-${registrationId}-${index + 1}`;
      insertPart.run(
        partId,
        registrationId,
        p.fullName.trim(),
        p.rollNumber.trim(),
        p.department.trim(),
        p.yearOfStudy.trim(),
        p.section.trim(),
        index + 1
      );
    });

    db.exec('COMMIT;');
    return { registrationId, totalFee };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function getEventRegistration(id: string): EventRegistrationRecord | null {
  const db = getDb();
  const reg = db.prepare('SELECT * FROM event_registrations WHERE id = ?').get(id) as unknown as EventRegistrationRecord;
  if (!reg) return null;

  const participants = db.prepare('SELECT * FROM participants WHERE registration_id = ? ORDER BY participant_order ASC').all(id) as unknown as ParticipantRecord[];
  const event = getEventBySlug(reg.event_id);

  return {
    ...reg,
    participants,
    event: event || undefined
  };
}

export function getAllEventRegistrations(filter?: { eventId?: string; status?: string; search?: string }): EventRegistrationRecord[] {
  const db = getDb();
  let query = `
    SELECT r.*, e.title as event_title, e.category as event_category
    FROM event_registrations r
    JOIN events e ON r.event_id = e.id
    WHERE 1=1
  `;
  const params: string[] = [];

  if (filter?.eventId) {
    query += ' AND r.event_id = ?';
    params.push(filter.eventId);
  }
  if (filter?.status) {
    query += ' AND r.payment_status = ?';
    params.push(filter.status);
  }
  if (filter?.search) {
    query += ' AND (r.id LIKE ? OR r.college_name LIKE ? OR r.leader_name LIKE ? OR r.leader_email LIKE ? OR r.leader_phone LIKE ?)';
    const term = `%${filter.search}%`;
    params.push(term, term, term, term, term);
  }

  query += ' ORDER BY r.created_at DESC';

  const rows = db.prepare(query).all(...params) as unknown as EventRegistrationRecord[];
  return rows;
}

// -------------------------------------------------------------
// STALL INVENTORY & BOOKINGS API
// -------------------------------------------------------------

export function getAllStallOptions(): StallOptionRecord[] {
  const db = getDb();
  const options = db.prepare('SELECT * FROM stall_options ORDER BY price ASC').all() as unknown as StallOptionRecord[];

  // Attach live booked and available counts
  return options.map(opt => {
    const bookedRow = db.prepare(`
      SELECT COALESCE(SUM(stalls_requested), 0) as booked
      FROM stall_bookings
      WHERE option_id = ? AND status IN ('paid', 'approved', 'pending')
    `).get(opt.id) as { booked: number };

    const booked = Number(bookedRow?.booked || 0);
    const available = Math.max(0, opt.total_stalls - booked);
    return {
      ...opt,
      booked_count: booked,
      available_stalls: available
    };
  });
}

export function getStallOption(id: string): StallOptionRecord | null {
  const db = getDb();
  const opt = db.prepare('SELECT * FROM stall_options WHERE id = ?').get(id) as unknown as StallOptionRecord;
  if (!opt) return null;

  const bookedRow = db.prepare(`
    SELECT COALESCE(SUM(stalls_requested), 0) as booked
    FROM stall_bookings
    WHERE option_id = ? AND status IN ('paid', 'approved', 'pending')
  `).get(id) as { booked: number };

  const booked = Number(bookedRow?.booked || 0);
  return {
    ...opt,
    booked_count: booked,
    available_stalls: Math.max(0, opt.total_stalls - booked)
  };
}

export function updateStallOption(id: string, data: Partial<StallOptionRecord>): void {
  const db = getDb();
  const existing = getStallOption(id);
  if (!existing) throw new Error('Stall option not found');

  const name = data.name ?? existing.name;
  const price = data.price ?? existing.price;
  const has_electricity = data.has_electricity ?? existing.has_electricity;
  const description = data.description ?? existing.description;
  const total_stalls = data.total_stalls ?? existing.total_stalls;
  const is_active = data.is_active ?? existing.is_active;

  db.prepare(`
    UPDATE stall_options
    SET name = ?, price = ?, has_electricity = ?, description = ?, total_stalls = ?, is_active = ?
    WHERE id = ?
  `).run(name, price, has_electricity, description, total_stalls, is_active, id);
}

export function createStallBooking(data: {
  optionId: string;
  applicantType: 'student' | 'vendor';
  entityName: string;
  collegeName?: string;
  departmentClass?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessDetails?: string;
  productsServices: string;
  stallsRequested: number;
}): { bookingId: string; totalAmount: number } {
  const db = getDb();

  if (data.stallsRequested < 1) {
    throw new Error('You must request at least 1 stall.');
  }

  // Atomically check inventory and reserve inside a transaction
  db.exec('BEGIN IMMEDIATE;');
  try {
    const opt = db.prepare('SELECT * FROM stall_options WHERE id = ?').get(data.optionId) as unknown as StallOptionRecord;
    if (!opt) throw new Error('Stall category not found');
    if (!opt.is_active) throw new Error('This stall category is currently unavailable for booking.');

    const bookedRow = db.prepare(`
      SELECT COALESCE(SUM(stalls_requested), 0) as booked
      FROM stall_bookings
      WHERE option_id = ? AND status IN ('paid', 'approved', 'pending')
    `).get(data.optionId) as { booked: number };

    const currentBooked = Number(bookedRow?.booked || 0);
    const available = opt.total_stalls - currentBooked;

    if (data.stallsRequested > available) {
      throw new Error(`Inventory limit exceeded: Only ${available} stall(s) remaining for ${opt.name}. You requested ${data.stallsRequested}.`);
    }

    const totalAmount = opt.price * data.stallsRequested;
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const bookingId = `FX-STL-${randomSuffix}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO stall_bookings (
        id, option_id, stall_category, applicant_type, entity_name, college_name,
        department_class, contact_name, contact_email, contact_phone, business_details,
        products_services, stalls_requested, has_electricity, total_amount, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      bookingId,
      data.optionId,
      opt.category,
      data.applicantType,
      data.entityName.trim(),
      data.collegeName?.trim() || null,
      data.departmentClass?.trim() || null,
      data.contactName.trim(),
      data.contactEmail.trim().toLowerCase(),
      data.contactPhone.trim(),
      data.businessDetails?.trim() || null,
      data.productsServices.trim(),
      data.stallsRequested,
      opt.has_electricity,
      totalAmount,
      now,
      now
    );

    db.exec('COMMIT;');
    return { bookingId, totalAmount };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function getStallBooking(id: string): StallBookingRecord | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT b.*, o.name as option_name
    FROM stall_bookings b
    JOIN stall_options o ON b.option_id = o.id
    WHERE b.id = ?
  `).get(id) as unknown as StallBookingRecord;
  return row || null;
}

export function getAllStallBookings(filter?: { status?: string; category?: string; search?: string }): StallBookingRecord[] {
  const db = getDb();
  let query = `
    SELECT b.*, o.name as option_name
    FROM stall_bookings b
    JOIN stall_options o ON b.option_id = o.id
    WHERE 1=1
  `;
  const params: string[] = [];

  if (filter?.status) {
    query += ' AND b.status = ?';
    params.push(filter.status);
  }
  if (filter?.category) {
    query += ' AND b.stall_category = ?';
    params.push(filter.category);
  }
  if (filter?.search) {
    query += ' AND (b.id LIKE ? OR b.entity_name LIKE ? OR b.contact_name LIKE ? OR b.contact_email LIKE ? OR b.contact_phone LIKE ?)';
    const term = `%${filter.search}%`;
    params.push(term, term, term, term, term);
  }

  query += ' ORDER BY b.created_at DESC';
  return db.prepare(query).all(...params) as unknown as StallBookingRecord[];
}

export function updateStallBookingStatus(id: string, status: string, notes?: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE stall_bookings
    SET status = ?, admin_notes = COALESCE(?, admin_notes), updated_at = ?
    WHERE id = ?
  `).run(status, notes || null, now, id);
}

// -------------------------------------------------------------
// PAYMENTS API & RECONCILIATION
// -------------------------------------------------------------

export function createPaymentIntent(data: {
  referenceType: 'event' | 'stall';
  referenceId: string;
  payerEmail?: string;
  payerPhone?: string;
  idempotencyKey?: string;
}): PaymentRecord {
  const db = getDb();

  let amount = 0;
  if (data.referenceType === 'event') {
    const reg = getEventRegistration(data.referenceId);
    if (!reg) throw new Error('Registration reference not found');
    amount = reg.total_fee;
  } else {
    const stl = getStallBooking(data.referenceId);
    if (!stl) throw new Error('Stall booking reference not found');
    amount = stl.total_amount;
  }

  const existing = db.prepare('SELECT * FROM payments WHERE reference_type = ? AND reference_id = ? AND status = ?').get(data.referenceType, data.referenceId, 'successful') as unknown as PaymentRecord;
  if (existing) {
    throw new Error('This reference has already been paid and verified.');
  }

  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const paymentId = `FX-PAY-${randomSuffix}`;
  const now = new Date().toISOString();

  // Razorpay or Sandbox Simulated Order ID
  const gatewayOrderId = `order_${Math.random().toString(36).substring(2, 12)}`;

  db.prepare(`
    INSERT INTO payments (id, reference_type, reference_id, gateway_order_id, amount, currency, status, payer_email, payer_phone, payment_method, idempotency_key, created_at)
    VALUES (?, ?, ?, ?, ?, 'INR', 'pending', ?, ?, 'Razorpay / UPI Gateway', ?, ?)
  `).run(
    paymentId,
    data.referenceType,
    data.referenceId,
    gatewayOrderId,
    amount,
    data.payerEmail || null,
    data.payerPhone || null,
    data.idempotencyKey || paymentId,
    now
  );

  return db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as unknown as PaymentRecord;
}

export function confirmPayment(data: {
  paymentId: string;
  gatewayPaymentId: string;
  gatewayOrderId?: string;
  gatewaySignature?: string;
  verifiedAmount: number;
}): { success: boolean; message: string; record: PaymentRecord } {
  const db = getDb();

  db.exec('BEGIN IMMEDIATE;');
  try {
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(data.paymentId) as unknown as PaymentRecord;
    if (!payment) throw new Error('Payment record not found');

    if (payment.status === 'successful') {
      db.exec('COMMIT;');
      return { success: true, message: 'Payment was already verified and confirmed.', record: payment };
    }

    if (Math.abs(payment.amount - data.verifiedAmount) > 0.01) {
      throw new Error(`Amount mismatch: expected ₹${payment.amount}, received ₹${data.verifiedAmount}`);
    }

    const now = new Date().toISOString();

    // 1. Update Payment Record
    db.prepare(`
      UPDATE payments
      SET status = 'successful', gateway_payment_id = ?, gateway_order_id = COALESCE(?, gateway_order_id), gateway_signature = ?, verified_at = ?
      WHERE id = ?
    `).run(data.gatewayPaymentId, data.gatewayOrderId || null, data.gatewaySignature || 'VERIFIED_SANDBOX', now, data.paymentId);

    // 2. Update Corresponding Event Registration or Stall Booking
    if (payment.reference_type === 'event') {
      db.prepare(`
        UPDATE event_registrations
        SET payment_status = 'paid', updated_at = ?
        WHERE id = ?
      `).run(now, payment.reference_id);
    } else if (payment.reference_type === 'stall') {
      db.prepare(`
        UPDATE stall_bookings
        SET status = 'paid', updated_at = ?
        WHERE id = ?
      `).run(now, payment.reference_id);
    }

    // 3. Log Audit Record
    const auditId = `AUD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    db.prepare(`
      INSERT INTO audit_logs (id, actor, action, target_type, target_id, details, created_at)
      VALUES (?, 'SYSTEM_PAYMENT_GATEWAY', 'PAYMENT_CONFIRMED', ?, ?, ?, ?)
    `).run(
      auditId,
      payment.reference_type.toUpperCase(),
      payment.reference_id,
      JSON.stringify({ amount: payment.amount, paymentId: data.paymentId, gatewayPaymentId: data.gatewayPaymentId }),
      now
    );

    db.exec('COMMIT;');

    const updatedPayment = db.prepare('SELECT * FROM payments WHERE id = ?').get(data.paymentId) as unknown as PaymentRecord;
    return { success: true, message: 'Payment successfully verified and registration confirmed!', record: updatedPayment };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function getAllPayments(filter?: { status?: string; search?: string }): PaymentRecord[] {
  const db = getDb();
  let query = 'SELECT * FROM payments WHERE 1=1';
  const params: string[] = [];

  if (filter?.status) {
    query += ' AND status = ?';
    params.push(filter.status);
  }
  if (filter?.search) {
    query += ' AND (id LIKE ? OR reference_id LIKE ? OR gateway_payment_id LIKE ? OR payer_email LIKE ?)';
    const term = `%${filter.search}%`;
    params.push(term, term, term, term);
  }

  query += ' ORDER BY created_at DESC';
  return db.prepare(query).all(...params) as unknown as PaymentRecord[];
}

export function refundPayment(paymentId: string, actor: string, reason: string): void {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE;');
  try {
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as unknown as PaymentRecord;
    if (!payment) throw new Error('Payment not found');
    if (payment.status !== 'successful') throw new Error('Only successful payments can be refunded');

    const now = new Date().toISOString();
    db.prepare("UPDATE payments SET status = 'refunded' WHERE id = ?").run(paymentId);

    if (payment.reference_type === 'event') {
      db.prepare("UPDATE event_registrations SET payment_status = 'refunded', updated_at = ? WHERE id = ?").run(now, payment.reference_id);
    } else {
      db.prepare("UPDATE stall_bookings SET status = 'refunded', updated_at = ? WHERE id = ?").run(now, payment.reference_id);
    }

    const auditId = `AUD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    db.prepare(`
      INSERT INTO audit_logs (id, actor, action, target_type, target_id, details, created_at)
      VALUES (?, ?, 'PAYMENT_REFUNDED', ?, ?, ?, ?)
    `).run(auditId, actor, payment.reference_type.toUpperCase(), payment.reference_id, JSON.stringify({ amount: payment.amount, reason }), now);

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

// -------------------------------------------------------------
// DASHBOARD METRICS & AUDIT LOGS
// -------------------------------------------------------------

export function getDashboardMetrics() {
  const db = getDb();

  const totalEventRegs = (db.prepare('SELECT COUNT(*) as count FROM event_registrations').get() as { count: number }).count;
  const confirmedEventRegs = (db.prepare("SELECT COUNT(*) as count FROM event_registrations WHERE payment_status = 'paid'").get() as { count: number }).count;

  const totalConfirmedParticipants = (db.prepare(`
    SELECT COALESCE(SUM(r.participant_count), 0) as count
    FROM event_registrations r
    WHERE r.payment_status = 'paid'
  `).get() as { count: number }).count;

  const totalStallBookings = (db.prepare('SELECT COUNT(*) as count FROM stall_bookings').get() as { count: number }).count;
  const studentStallBookings = (db.prepare("SELECT COUNT(*) as count FROM stall_bookings WHERE stall_category = 'STUDENT'").get() as { count: number }).count;
  const vendorStallBookings = (db.prepare("SELECT COUNT(*) as count FROM stall_bookings WHERE stall_category = 'OUTSIDE_VENDOR'").get() as { count: number }).count;

  const verifiedCollections = (db.prepare("SELECT COALESCE(SUM(amount), 0) as sum FROM payments WHERE status = 'successful'").get() as { sum: number }).sum;
  const refundedCollections = (db.prepare("SELECT COALESCE(SUM(amount), 0) as sum FROM payments WHERE status = 'refunded'").get() as { sum: number }).sum;

  const pendingPayments = (db.prepare("SELECT COUNT(*) as count FROM payments WHERE status = 'pending'").get() as { count: number }).count;
  const successfulPayments = (db.prepare("SELECT COUNT(*) as count FROM payments WHERE status = 'successful'").get() as { count: number }).count;
  const failedPayments = (db.prepare("SELECT COUNT(*) as count FROM payments WHERE status = 'failed'").get() as { count: number }).count;

  const eventsBreakdown = db.prepare(`
    SELECT e.id, e.title,
      COUNT(r.id) as total_registrations,
      SUM(CASE WHEN r.payment_status = 'paid' THEN 1 ELSE 0 END) as paid_registrations,
      SUM(CASE WHEN r.payment_status = 'paid' THEN r.participant_count ELSE 0 END) as total_participants
    FROM events e
    LEFT JOIN event_registrations r ON e.id = r.event_id
    GROUP BY e.id, e.title
    ORDER BY total_registrations DESC
  `).all();

  const stallInventorySummary = getAllStallOptions();

  return {
    totalEventRegs,
    confirmedEventRegs,
    totalConfirmedParticipants,
    totalStallBookings,
    studentStallBookings,
    vendorStallBookings,
    verifiedCollections,
    refundedCollections,
    pendingPayments,
    successfulPayments,
    failedPayments,
    eventsBreakdown,
    stallInventorySummary
  };
}

export function getAuditLogs(limit = 100): unknown[] {
  const db = getDb();
  return db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?').all(limit);
}

export function logAuditEvent(actor: string, action: string, targetType: string, targetId: string, details?: string, ipAddress?: string): void {
  const db = getDb();
  const id = `AUD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  db.prepare(`
    INSERT INTO audit_logs (id, actor, action, target_type, target_id, details, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, actor, action, targetType, targetId, details || null, ipAddress || null, new Date().toISOString());
}

// -------------------------------------------------------------
// SITE SETTINGS API
// -------------------------------------------------------------

export function getSiteSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM site_settings').all() as Array<{ key: string; value: string }>;
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return map;
}

export function updateSiteSettings(settings: Record<string, string>): void {
  const db = getDb();
  const stmt = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
  for (const [key, val] of Object.entries(settings)) {
    stmt.run(key, val);
  }
}
