import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import pg from 'pg';

// =============================================================
// DATABASE ENGINE CONFIGURATION
// =============================================================

// Priority: PostgreSQL via DATABASE_URL or POSTGRES_URL (Single Source of Truth)
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.FINXYORA_DATABASE_URL || '';

// Persistent directory for local development SQLite fallback
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    // Read-only filesystem fallback
  }
}
const DB_PATH = path.join(DATA_DIR, 'finxyora.sqlite');

let _sqliteDb: DatabaseSync | null = null;
let _pgPool: pg.Pool | null = null;

export function getDatabaseEngineInfo(): {
  isPostgres: boolean;
  engine: 'PostgreSQL' | 'SQLite (Local Fallback)';
  isCentralized: boolean;
  databaseUrlConfigured: boolean;
  dbPath?: string;
} {
  return {
    isPostgres: Boolean(DATABASE_URL),
    engine: DATABASE_URL ? 'PostgreSQL' : 'SQLite (Local Fallback)',
    isCentralized: Boolean(DATABASE_URL),
    databaseUrlConfigured: Boolean(DATABASE_URL),
    dbPath: DATABASE_URL ? 'Cloud PostgreSQL Central Server' : DB_PATH
  };
}

function getPgPool(): pg.Pool {
  if (!_pgPool) {
    _pgPool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    _pgPool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client pool:', err);
    });
  }
  return _pgPool;
}

export function getSqliteDb(): DatabaseSync {
  if (!_sqliteDb) {
    _sqliteDb = new DatabaseSync(DB_PATH);
    _sqliteDb.exec('PRAGMA foreign_keys = ON;');
    _sqliteDb.exec('PRAGMA journal_mode = WAL;');
  }
  return _sqliteDb;
}

// Backwards compatibility export
export function getDb(): DatabaseSync {
  return getSqliteDb();
}

// =============================================================
// UNIFIED QUERY HELPERS (PARAMETRIZED & SAFE)
// =============================================================

let _schemaInitialized = false;
let _schemaInitPromise: Promise<void> | null = null;

async function ensureSchema(): Promise<void> {
  if (_schemaInitialized) return;
  if (!_schemaInitPromise) {
    _schemaInitPromise = initAllSchemas().then(() => {
      _schemaInitialized = true;
    }).catch((err) => {
      _schemaInitPromise = null;
      console.error('Database schema initialization error:', err);
      throw err;
    });
  }
  return _schemaInitPromise;
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  await ensureSchema();
  if (DATABASE_URL) {
    const pool = getPgPool();
    let idx = 1;
    const pgSql = sql.replace(/\?/g, () => `$${idx++}`);
    const res = await pool.query(pgSql, params);
    return res.rows as T[];
  } else {
    const db = getSqliteDb();
    const stmt = db.prepare(sql);
    return stmt.all(...params) as T[];
  }
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] || null;
}

export async function execute(sql: string, params: any[] = []): Promise<{ rowCount: number }> {
  await ensureSchema();
  if (DATABASE_URL) {
    const pool = getPgPool();
    let idx = 1;
    const pgSql = sql.replace(/\?/g, () => `$${idx++}`);
    const res = await pool.query(pgSql, params);
    return { rowCount: res.rowCount || 0 };
  } else {
    const db = getSqliteDb();
    const stmt = db.prepare(sql);
    const res = stmt.run(...params);
    return { rowCount: Number(res.changes || 0) };
  }
}

// =============================================================
// DATA INTERFACES
// =============================================================

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
  payment_status: 'pending' | 'submitted' | 'verified' | 'rejected' | 'paid' | 'failed' | 'refunded';
  registration_status: 'registered' | 'confirmed' | 'cancelled';
  registration_type: 'REAL' | 'TEST';
  transaction_id?: string;
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
  duration_days: number;
  has_electricity: number;
  total_amount: number;
  payment_status: 'pending' | 'submitted' | 'verified' | 'rejected' | 'paid';
  status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'refunded' | 'paid';
  registration_type: 'REAL' | 'TEST';
  transaction_id?: string;
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
  status: 'pending' | 'submitted' | 'verified' | 'rejected' | 'successful' | 'failed' | 'refunded';
  payer_email?: string;
  payer_phone?: string;
  payment_method: string;
  idempotency_key?: string;
  registration_type: 'REAL' | 'TEST';
  created_at: string;
  verified_at?: string;
  verified_by?: string;
  rejection_reason?: string;
  item_title?: string;
  participant_count?: number;
}

export interface AuditLogRecord {
  id: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export interface EnquiryRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'new' | 'in-progress' | 'resolved';
  email_status?: 'sent' | 'failed' | 'pending';
  email_dispatched?: number;
  email_error?: string;
  created_at: string;
}

// =============================================================
// SCHEMA CREATION & IDEMPOTENT MIGRATIONS
// =============================================================

async function initAllSchemas(): Promise<void> {
  if (DATABASE_URL) {
    const pool = getPgPool();
    // PostgreSQL Tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        rules TEXT NOT NULL,
        min_participants INTEGER NOT NULL DEFAULT 1,
        max_participants INTEGER NOT NULL DEFAULT 2,
        registration_fee NUMERIC(10,2) NOT NULL DEFAULT 50,
        fee_type VARCHAR(50) NOT NULL DEFAULT 'per_participant',
        is_open INTEGER NOT NULL DEFAULT 1,
        deadline VARCHAR(100),
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS event_registrations (
        id VARCHAR(100) PRIMARY KEY,
        event_id VARCHAR(100) NOT NULL,
        college_name VARCHAR(255) NOT NULL,
        college_location VARCHAR(255) NOT NULL,
        team_name VARCHAR(255),
        leader_name VARCHAR(255) NOT NULL,
        leader_email VARCHAR(255) NOT NULL,
        leader_phone VARCHAR(50) NOT NULL,
        participant_count INTEGER NOT NULL,
        total_fee NUMERIC(10,2) NOT NULL,
        payment_status VARCHAR(50) NOT NULL DEFAULT 'submitted',
        registration_status VARCHAR(50) NOT NULL DEFAULT 'registered',
        registration_type VARCHAR(20) NOT NULL DEFAULT 'REAL',
        transaction_id VARCHAR(100),
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS participants (
        id VARCHAR(100) PRIMARY KEY,
        registration_id VARCHAR(100) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        roll_number VARCHAR(100) NOT NULL,
        department VARCHAR(255) NOT NULL,
        year_of_study VARCHAR(100) NOT NULL,
        section VARCHAR(50) NOT NULL,
        participant_order INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS stall_options (
        id VARCHAR(100) PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        has_electricity INTEGER NOT NULL DEFAULT 0,
        description TEXT NOT NULL,
        total_stalls INTEGER NOT NULL DEFAULT 25,
        is_active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS stall_bookings (
        id VARCHAR(100) PRIMARY KEY,
        option_id VARCHAR(100) NOT NULL,
        stall_category VARCHAR(100) NOT NULL,
        applicant_type VARCHAR(50) NOT NULL,
        entity_name VARCHAR(255) NOT NULL,
        college_name VARCHAR(255),
        department_class VARCHAR(255),
        contact_name VARCHAR(255) NOT NULL,
        contact_email VARCHAR(255) NOT NULL,
        contact_phone VARCHAR(50) NOT NULL,
        business_details TEXT,
        products_services TEXT NOT NULL,
        stalls_requested INTEGER NOT NULL DEFAULT 1,
        duration_days INTEGER NOT NULL DEFAULT 1,
        has_electricity INTEGER NOT NULL DEFAULT 0,
        total_amount NUMERIC(10,2) NOT NULL,
        payment_status VARCHAR(50) NOT NULL DEFAULT 'submitted',
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        registration_type VARCHAR(20) NOT NULL DEFAULT 'REAL',
        transaction_id VARCHAR(100),
        admin_notes TEXT,
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(100) PRIMARY KEY,
        reference_type VARCHAR(50) NOT NULL,
        reference_id VARCHAR(100) NOT NULL,
        gateway_order_id VARCHAR(100),
        gateway_payment_id VARCHAR(100),
        gateway_signature VARCHAR(255),
        amount NUMERIC(10,2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        status VARCHAR(50) NOT NULL DEFAULT 'submitted',
        payer_email VARCHAR(255),
        payer_phone VARCHAR(50),
        payment_method VARCHAR(100) DEFAULT 'UPI - GPay',
        idempotency_key VARCHAR(150),
        registration_type VARCHAR(20) NOT NULL DEFAULT 'REAL',
        created_at VARCHAR(100) NOT NULL,
        verified_at VARCHAR(100),
        verified_by VARCHAR(100),
        rejection_reason TEXT
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id VARCHAR(100) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'admin',
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100)
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(100) PRIMARY KEY,
        actor VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(100) NOT NULL,
        target_id VARCHAR(100) NOT NULL,
        details TEXT,
        ip_address VARCHAR(100),
        created_at VARCHAR(100) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS enquiries (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'new',
        created_at VARCHAR(100) NOT NULL
      );
    `);

    // Non-destructive Column Migrations (PostgreSQL)
    const safeAddPgCol = async (tbl: string, col: string, typeDef: string) => {
      try {
        await pool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS ${col} ${typeDef};`);
      } catch {
        // Ignored
      }
    };
    await safeAddPgCol('event_registrations', 'registration_type', 'VARCHAR(20) DEFAULT \'REAL\'');
    await safeAddPgCol('event_registrations', 'transaction_id', 'VARCHAR(100)');
    await safeAddPgCol('event_registrations', 'registration_status', 'VARCHAR(50) DEFAULT \'registered\'');
    await safeAddPgCol('stall_bookings', 'registration_type', 'VARCHAR(20) DEFAULT \'REAL\'');
    await safeAddPgCol('stall_bookings', 'transaction_id', 'VARCHAR(100)');
    await safeAddPgCol('stall_bookings', 'payment_status', 'VARCHAR(50) DEFAULT \'submitted\'');
    await safeAddPgCol('stall_bookings', 'duration_days', 'INTEGER DEFAULT 1');
    await safeAddPgCol('payments', 'registration_type', 'VARCHAR(20) DEFAULT \'REAL\'');
    await safeAddPgCol('payments', 'verified_by', 'VARCHAR(100)');
    await safeAddPgCol('payments', 'verified_at', 'VARCHAR(100)');
    await safeAddPgCol('payments', 'rejection_reason', 'TEXT');
    await safeAddPgCol('enquiries', 'phone', 'VARCHAR(50)');
    await safeAddPgCol('enquiries', 'email_status', "VARCHAR(50) DEFAULT 'pending'");
    await safeAddPgCol('enquiries', 'email_dispatched', 'INTEGER DEFAULT 0');
    await safeAddPgCol('enquiries', 'email_error', 'TEXT');

    // Create Indexes after columns are verified to exist
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_pg_evt_reg_type ON event_registrations(registration_type);
        CREATE INDEX IF NOT EXISTS idx_pg_evt_reg_event ON event_registrations(event_id);
        CREATE INDEX IF NOT EXISTS idx_pg_parts_reg ON participants(registration_id);
        CREATE INDEX IF NOT EXISTS idx_pg_pay_ref ON payments(reference_id);
        CREATE INDEX IF NOT EXISTS idx_pg_pay_utr ON payments(gateway_payment_id);
      `);
    } catch {
      // Ignored
    }

    await seedInitialDataPostgres(pool);
  } else {
    // SQLite Tables (Local Fallback)
    const db = getSqliteDb();
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
        fee_type TEXT NOT NULL DEFAULT 'per_participant',
        is_open INTEGER NOT NULL DEFAULT 1,
        deadline TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS event_registrations (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        college_name TEXT NOT NULL,
        college_location TEXT NOT NULL,
        team_name TEXT,
        leader_name TEXT NOT NULL,
        leader_email TEXT NOT NULL,
        leader_phone TEXT NOT NULL,
        participant_count INTEGER NOT NULL,
        total_fee REAL NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'submitted',
        registration_status TEXT NOT NULL DEFAULT 'registered',
        registration_type TEXT NOT NULL DEFAULT 'REAL',
        transaction_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY,
        registration_id TEXT NOT NULL,
        full_name TEXT NOT NULL,
        roll_number TEXT NOT NULL,
        department TEXT NOT NULL,
        year_of_study TEXT NOT NULL,
        section TEXT NOT NULL,
        participant_order INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS stall_options (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        has_electricity INTEGER NOT NULL DEFAULT 0,
        description TEXT NOT NULL,
        total_stalls INTEGER NOT NULL DEFAULT 25,
        is_active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS stall_bookings (
        id TEXT PRIMARY KEY,
        option_id TEXT NOT NULL,
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
        duration_days INTEGER NOT NULL DEFAULT 1,
        has_electricity INTEGER NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'submitted',
        status TEXT NOT NULL DEFAULT 'pending',
        registration_type TEXT NOT NULL DEFAULT 'REAL',
        transaction_id TEXT,
        admin_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        reference_type TEXT NOT NULL,
        reference_id TEXT NOT NULL,
        gateway_order_id TEXT,
        gateway_payment_id TEXT,
        gateway_signature TEXT,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'INR',
        status TEXT NOT NULL DEFAULT 'submitted',
        payer_email TEXT,
        payer_phone TEXT,
        payment_method TEXT DEFAULT 'UPI - GPay',
        idempotency_key TEXT,
        registration_type TEXT NOT NULL DEFAULT 'REAL',
        created_at TEXT NOT NULL,
        verified_at TEXT,
        verified_by TEXT,
        rejection_reason TEXT
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at TEXT NOT NULL,
        updated_at TEXT
      );

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

      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS enquiries (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TEXT NOT NULL
      );
    `);

    // Non-destructive Column Migrations (SQLite)
    const safeAddSqCol = (tbl: string, col: string, def: string) => {
      try {
        db.exec(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${def};`);
      } catch {
        // Ignored
      }
    };
    safeAddSqCol('event_registrations', 'registration_type', "TEXT NOT NULL DEFAULT 'REAL'");
    safeAddSqCol('event_registrations', 'transaction_id', 'TEXT');
    safeAddSqCol('event_registrations', 'registration_status', "TEXT NOT NULL DEFAULT 'registered'");
    safeAddSqCol('stall_bookings', 'registration_type', "TEXT NOT NULL DEFAULT 'REAL'");
    safeAddSqCol('stall_bookings', 'transaction_id', 'TEXT');
    safeAddSqCol('stall_bookings', 'payment_status', "TEXT NOT NULL DEFAULT 'submitted'");
    safeAddSqCol('stall_bookings', 'duration_days', 'INTEGER NOT NULL DEFAULT 1');
    safeAddSqCol('payments', 'registration_type', "TEXT NOT NULL DEFAULT 'REAL'");
    safeAddSqCol('payments', 'verified_by', 'TEXT');
    safeAddSqCol('payments', 'verified_at', 'TEXT');
    safeAddSqCol('payments', 'rejection_reason', 'TEXT');
    safeAddSqCol('enquiries', 'phone', 'TEXT');
    safeAddSqCol('enquiries', 'email_status', "TEXT NOT NULL DEFAULT 'pending'");
    safeAddSqCol('enquiries', 'email_dispatched', 'INTEGER NOT NULL DEFAULT 0');
    safeAddSqCol('enquiries', 'email_error', 'TEXT');

    // Create Indexes after columns are verified to exist
    try {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sq_evt_reg_type ON event_registrations(registration_type);
        CREATE INDEX IF NOT EXISTS idx_sq_evt_reg_event ON event_registrations(event_id);
        CREATE INDEX IF NOT EXISTS idx_sq_parts_reg ON participants(registration_id);
        CREATE INDEX IF NOT EXISTS idx_sq_pay_ref ON payments(reference_id);
        CREATE INDEX IF NOT EXISTS idx_sq_pay_utr ON payments(gateway_payment_id);
      `);
    } catch {
      // Ignored
    }

    // Mark known prototype/test records as TEST so they don't pollute real statistics
    try {
      db.exec(`
        UPDATE event_registrations SET registration_type = 'TEST'
        WHERE leader_name IN ('tawz', 'fintechuu') OR leader_email LIKE '%tawfeek%';

        UPDATE payments SET registration_type = 'TEST'
        WHERE reference_id IN (SELECT id FROM event_registrations WHERE registration_type = 'TEST');
      `);
    } catch {
      // Ignored
    }

    seedInitialDataSqlite(db);
  }
}

// =============================================================
// SEEDING
// =============================================================

const INITIAL_EVENTS = [
  {
    id: 'prompt-perfect',
    title: 'PROMPT PERFECT',
    category: 'Artificial Intelligence & Prompt Engineering',
    description: 'Test your mastery of generative AI, prompt engineering architectures, and algorithmic financial modeling. Formulate context-engineered instructions to generate solutions for real-world FinTech problem statements.',
    rules: JSON.stringify([
      'Maximum team size is strictly 2 participants.',
      'Participants will be evaluated on prompt precision, token efficiency, few-shot prompting, and financial accuracy.',
      'Use of external pre-built automation agents or undisclosed APIs is forbidden.',
      'All prompts and reasoning traces will be reviewed by the evaluation panel.',
      'Rounds include: Rapid Prompt Prototyping, Hallucination Hunting, and FinTech Logic Synthesis.'
    ]),
    min: 2,
    max: 2,
    fee: 50
  },
  {
    id: 'best-manager',
    title: 'BUSINESS PLAN',
    category: 'Entrepreneurship, Strategy & Business Modelling',
    description: 'Craft a compelling, investor-ready business plan that solves a real-world problem. Pitch your venture to a panel of seasoned entrepreneurs, investors, and industry experts who will scrutinize every element — from market research to financial projections.',
    rules: JSON.stringify([
      'Teams must consist of exactly 2 participants.',
      'Round 1: Written Business Plan Submission — Executive summary, market analysis, revenue model, and financial forecasts.',
      'Round 2: Live Investor Pitch — 7-minute presentation followed by a rigorous 5-minute Q&A with the judging panel.',
      'Evaluation criteria: Innovation, feasibility, market potential, financial viability, and presentation quality.',
      'Business formal attire is mandatory. All presentation materials must be submitted to the organizers 30 minutes before the session.'
    ]),
    min: 2,
    max: 2,
    fee: 50
  },
  {
    id: 'corporate-walk',
    title: 'STOCK WAR',
    category: 'Stock Market Simulation, Trading Strategy & Financial Analysis',
    description: 'Enter the trading floor and battle it out in a high-stakes virtual stock market simulation. Teams will analyze live market scenarios, execute timed trades, and manage a dynamic portfolio under real-world constraints — with leaderboards shifting every round.',
    rules: JSON.stringify([
      'Teams must consist of exactly 2 participants.',
      'Round 1: Market Analysis — Interpret financial data, identify trends, and predict stock movements within a time limit.',
      'Round 2: Live Trading Simulation — Manage a virtual portfolio of ₹1,00,000 across multiple asset classes under volatile market conditions.',
      'Round 3: Strategy Presentation — Justify your trades and present your portfolio performance to the judging panel.',
      'Judges will evaluate based on return on investment (ROI), risk management, decision rationale, and analytical depth.'
    ]),
    min: 2,
    max: 2,
    fee: 50
  },
  {
    id: 'best-cfo',
    title: 'BEST CFO',
    category: 'Chief Financial Officer Strategy, Corporate Finance & Treasury',
    description: 'The ultimate corporate treasury and financial leadership trial. Step into the shoes of a Chief Financial Officer allocating capital, mitigating systemic risks, modeling liquidity, and presenting strategic valuations to the board.',
    rules: JSON.stringify([
      'Teams must consist of exactly 2 participants.',
      'Round 1: Financial Statement Forensics & Liquidity Crisis Simulation.',
      'Round 2: Capital Budgeting & M&A Valuation Defense.',
      'Round 3: Press Conference & Hostile Takeover Crisis Management.',
      'Calculators and standard financial modeling spreadsheets provided.',
      'Evaluations will heavily weigh strategic rationale, capital efficiency, and presentation poise.'
    ]),
    min: 2,
    max: 2,
    fee: 50
  },
  {
    id: 'b-quiz',
    title: 'B QUIZ',
    category: 'FinTech, Blockchain, AI & Emerging Financial Technologies',
    description: 'The battle of intellect spanning digital banking rails, blockchain consensus algorithms, cryptocurrency tokenomics, AI in quantitative trading, and global macroeconomics.',
    rules: JSON.stringify([
      'Teams must consist of strictly 2 participants.',
      'Round 1: Rapid-Fire Written FinTech Prelims (30 questions, 20 minutes).',
      'Top 6 teams advance to the Live Stage Finals.',
      'Final rounds include: Audio-Visual Puzzles, Cryptic Connects, Negative Marking Bidding Grid, and Sudden Death.',
      'No electronic gadgets or smartphones allowed during the quiz.',
      'Quizmaster\'s decision is final and binding in all disputes.'
    ]),
    min: 2,
    max: 2,
    fee: 50
  },
  {
    id: 'football-auction',
    title: 'FOOTBALL AUCTION',
    category: 'Football Strategy, Team Building, Player Auction & Budget Management',
    description: 'Step into the transfer war-room as a football club sporting director. Manage a virtual purse of ₹100 Crores, navigate dynamic bidding wars, enforce salary caps, and craft an elite winning squad.',
    rules: JSON.stringify([
      'Teams can have 2 or 3 participants.',
      'Virtual Purse: Exactly ₹100 Crores per team.',
      'Each team must buy exactly 11 players including minimum 1 Goalkeeper, 3 Defenders, 3 Midfielders, and 2 Forwards.',
      'Max 4 foreign / marquee players per squad.',
      'Exceeding budget or failing positional squad quota results in immediate forfeiture.',
      'Final squads evaluated on cumulative FIFA/tactical ratings, tactical chemistry, and wage efficiency.'
    ]),
    min: 2,
    max: 3,
    fee: 50
  }
];

const INITIAL_STALLS = [
  {
    id: 'student-no-electric',
    category: 'STUDENT',
    name: 'Student Stall (Without Electricity)',
    price: 300,
    has_electricity: 0,
    description: 'Standard student exhibition booth with table and 2 chairs. Ideal for dry crafts, stationery, non-electrical products, or games.',
    total_stalls: 15
  },
  {
    id: 'student-electric',
    category: 'STUDENT',
    name: 'Student Stall (With Electricity)',
    price: 500,
    has_electricity: 1,
    description: 'Student exhibition booth with a dedicated electrical connection (15A socket), table, and 2 chairs. Perfect for electronic demos, lighting displays, powered appliances, or charging stations.',
    total_stalls: 10
  },
  {
    id: 'vendor-standard',
    category: 'OUTSIDE_VENDOR',
    name: 'Commercial Food & Corporate Stall',
    price: 1500,
    has_electricity: 1,
    description: 'Premium exhibition pavilion with guaranteed electricity connection, canopy, 2 tables, and 4 chairs. Recommended for hot food, apparel, brand activations, or electronics.',
    total_stalls: 10
  }
];

async function seedInitialDataPostgres(pool: pg.Pool) {
  const countRes = await pool.query('SELECT COUNT(*) as count FROM events;');
  if (parseInt(countRes.rows[0].count, 10) === 0) {
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    for (const ev of INITIAL_EVENTS) {
      await pool.query(`
        INSERT INTO events (id, title, category, description, rules, min_participants, max_participants, registration_fee, fee_type, is_open, deadline, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'per_participant', 1, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING;
      `, [ev.id, ev.title, ev.category, ev.description, ev.rules, ev.min, ev.max, ev.fee, deadline, now, now]);
    }
  }

  // Always upsert stalls — ensures new categories added in future deploys are inserted
  for (const st of INITIAL_STALLS) {
    await pool.query(`
      INSERT INTO stall_options (id, category, name, price, has_electricity, description, total_stalls, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
      ON CONFLICT (id) DO NOTHING;
    `, [st.id, st.category, st.name, st.price, st.has_electricity, st.description, st.total_stalls]);
  }

  const adminCount = await pool.query('SELECT COUNT(*) as count FROM admin_users;');
  if (parseInt(adminCount.rows[0].count, 10) === 0) {
    const now = new Date().toISOString();
    const hash = bcrypt.hashSync('Finxyora@Admin2026', 10);
    await pool.query(`
      INSERT INTO admin_users (id, username, password_hash, display_name, role, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (username) DO NOTHING;
    `, ['admin-root', 'admin', hash, 'System Administrator', 'admin', now]);
  }

  // Ensure default site settings exist
  const defaultSettings: Record<string, string> = {
    college_name: 'Bishop Heber College',
    event_dates: 'November 12 & 13, 2026',
    event_venue: 'Golden Jubilee Building',
    default_event_fee: '50',
    default_fee_rule: 'per_participant',
    upi_merchant_id: 's.venkatesanraja@okaxis',
    upi_merchant_name: 'S.venkatesan',
    contact_email: 'finxyora@gmail.com',
    contact_phone: '+91 94892 24908'
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    await pool.query(`
      INSERT INTO site_settings (key, value)
      VALUES ($1, $2)
      ON CONFLICT (key) DO NOTHING;
    `, [key, value]);
  }
}

function seedInitialDataSqlite(db: DatabaseSync) {
  const evCountRow = db.prepare('SELECT COUNT(*) as count FROM events').get() as { count: number };
  if (evCountRow.count === 0) {
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const insertEvent = db.prepare(`
      INSERT OR IGNORE INTO events (id, title, category, description, rules, min_participants, max_participants, registration_fee, fee_type, is_open, deadline, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'per_participant', 1, ?, ?, ?)
    `);
    for (const ev of INITIAL_EVENTS) {
      insertEvent.run(ev.id, ev.title, ev.category, ev.description, ev.rules, ev.min, ev.max, ev.fee, deadline, now, now);
    }
  }

  // Always upsert stalls — ensures new categories are inserted in existing databases
  const insertStall = db.prepare(`
    INSERT OR IGNORE INTO stall_options (id, category, name, price, has_electricity, description, total_stalls, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);
  for (const st of INITIAL_STALLS) {
    insertStall.run(st.id, st.category, st.name, st.price, st.has_electricity, st.description, st.total_stalls);
  }

  const adminCountRow = db.prepare('SELECT COUNT(*) as count FROM admin_users').get() as { count: number };
  if (adminCountRow.count === 0) {
    const now = new Date().toISOString();
    const hash = bcrypt.hashSync('Finxyora@Admin2026', 10);
    db.prepare(`
      INSERT OR IGNORE INTO admin_users (id, username, password_hash, display_name, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('admin-root', 'admin', hash, 'System Administrator', 'admin', now);
  }

  const defaultSettings: Record<string, string> = {
    college_name: 'Bishop Heber College',
    event_dates: 'November 12 & 13, 2026',
    event_venue: 'Golden Jubilee Building',
    default_event_fee: '50',
    default_fee_rule: 'per_participant',
    upi_merchant_id: 's.venkatesanraja@okaxis',
    upi_merchant_name: 'S.venkatesan',
    contact_email: 'finxyora@gmail.com',
    contact_phone: '+91 94892 24908'
  };

  const insertSetting = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value);
  }
}

// =============================================================
// ID GENERATORS (REAL vs TEST IDENTIFIERS)
// =============================================================

async function generateRegistrationId(isTest: boolean): Promise<string> {
  const prefix = isTest ? 'FIN-TEST' : 'FIN-2026';
  const row = await queryOne<{ total: string | number }>(
    'SELECT COUNT(*) as total FROM event_registrations WHERE registration_type = ?',
    [isTest ? 'TEST' : 'REAL']
  );
  const nextNum = Number(row?.total || 0) + 1;
  const seq = String(nextNum).padStart(4, '0');
  let candidate = `${prefix}-${seq}`;

  // Ensure collision safety
  const exists = await queryOne('SELECT id FROM event_registrations WHERE id = ?', [candidate]);
  if (exists) {
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    candidate = `${prefix}-${seq}-${rand}`;
  }
  return candidate;
}

async function generateStallBookingId(isTest: boolean): Promise<string> {
  const prefix = isTest ? 'FIN-STL-TEST' : 'FIN-STL-2026';
  const row = await queryOne<{ total: string | number }>(
    'SELECT COUNT(*) as total FROM stall_bookings WHERE registration_type = ?',
    [isTest ? 'TEST' : 'REAL']
  );
  const nextNum = Number(row?.total || 0) + 1;
  const seq = String(nextNum).padStart(4, '0');
  let candidate = `${prefix}-${seq}`;

  const exists = await queryOne('SELECT id FROM stall_bookings WHERE id = ?', [candidate]);
  if (exists) {
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    candidate = `${prefix}-${seq}-${rand}`;
  }
  return candidate;
}

// =============================================================
// IN-MEMORY QUERY CACHING (TTL FOR ZERO NAVIGATION LATENCY)
// =============================================================

let _cachedEvents: { data: EventRecord[]; timestamp: number } | null = null;
let _cachedStallOptions: { data: StallOptionRecord[]; timestamp: number } | null = null;
let _cachedSiteSettings: { data: Record<string, string>; timestamp: number } | null = null;
const CACHE_TTL_MS = 30000; // 30 seconds

export function invalidateCache(type?: 'events' | 'stalls' | 'settings') {
  if (!type || type === 'events') _cachedEvents = null;
  if (!type || type === 'stalls') _cachedStallOptions = null;
  if (!type || type === 'settings') _cachedSiteSettings = null;
}

// =============================================================
// EVENTS API
// =============================================================

export async function getAllEvents(): Promise<EventRecord[]> {
  const now = Date.now();
  if (_cachedEvents && now - _cachedEvents.timestamp < CACHE_TTL_MS) {
    return _cachedEvents.data;
  }
  const events = await query<EventRecord>('SELECT * FROM events ORDER BY title ASC');
  _cachedEvents = { data: events, timestamp: now };
  return events;
}

export async function getEventById(id: string): Promise<EventRecord | null> {
  return queryOne<EventRecord>('SELECT * FROM events WHERE id = ?', [id]);
}

export async function getEventBySlug(slug: string): Promise<EventRecord | null> {
  return getEventById(slug);
}

export async function updateEvent(
  id: string,
  data: Partial<Omit<EventRecord, 'id' | 'created_at'>>,
  adminUsername: string
): Promise<EventRecord | null> {
  const existing = await getEventById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
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

  await execute(`
    UPDATE events SET
      title = ?, category = ?, description = ?, rules = ?,
      min_participants = ?, max_participants = ?, registration_fee = ?,
      fee_type = ?, is_open = ?, deadline = ?, updated_at = ?
    WHERE id = ?
  `, [
    title, category, description, rules,
    min_participants, max_participants, registration_fee,
    fee_type, is_open, deadline, now, id
  ]);

  await logAuditEvent(
    adminUsername,
    'UPDATE_EVENT',
    'EVENT',
    id,
    `Updated parameters for competition: ${title}`
  );

  invalidateCache('events');
  return getEventById(id);
}

// =============================================================
// CLIENT PAYMENT & REGISTRATION CONFIRMATION PIPELINE
// (₹50 PER PERSON, DYNAMIC VERIFICATION, MANUAL REVIEW WORKFLOW)
// =============================================================

export interface ClientRegistrationPayload {
  referenceType: 'event' | 'stall';
  paymentId?: string;
  registrationId?: string;
  expectedAmount: number;
  utrNumber: string;
  timestamp?: number;
  isTest?: boolean;
  eventData?: {
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
  };
  stallData?: {
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
    durationDays: number;
  };
}

export async function confirmClientSideRegistration(payload: ClientRegistrationPayload): Promise<{
  success: boolean;
  registrationId: string;
  referenceType: 'event' | 'stall';
  amount: number;
  utrNumber: string;
  registrationType: 'REAL' | 'TEST';
  paymentStatus: string;
  ticketDetails: any;
}> {
  await ensureSchema();

  const cleanUtr = String(payload.utrNumber || '').trim();
  if (!cleanUtr || cleanUtr.length < 6) {
    throw new Error('Invalid UPI Reference / UTR Number. Must be at least 6 digits/characters from your payment receipt.');
  }

  // Prevent duplicate transaction references for REAL registrations
  const isTest = Boolean(payload.isTest);
  const regType: 'REAL' | 'TEST' = isTest ? 'TEST' : 'REAL';

  if (!isTest) {
    const existingTx = await queryOne<PaymentRecord>(
      'SELECT id, reference_id FROM payments WHERE gateway_payment_id = ? AND registration_type = \'REAL\'',
      [cleanUtr]
    );
    if (existingTx) {
      throw new Error(`This UPI Reference / UTR Number (${cleanUtr}) has already been submitted for registration ${existingTx.reference_id}. If you believe this is an error, contact festival support.`);
    }
  }

  const now = new Date().toISOString();

  if (payload.referenceType === 'event') {
    if (!payload.eventData) throw new Error('Missing event registration details');
    const { eventId, collegeName, collegeLocation, teamName, leaderName, leaderEmail, leaderPhone, participants } = payload.eventData;

    const event = await getEventBySlug(eventId);
    if (!event) throw new Error(`Competition not found: ${eventId}`);

    const participantCount = participants?.length || 0;
    if (participantCount < event.min_participants || participantCount > event.max_participants) {
      throw new Error(`Participant limit error: ${event.title} requires between ${event.min_participants} and ${event.max_participants} participant(s). Provided: ${participantCount}.`);
    }

    // MANDATORY BACKEND ENFORCEMENT: ₹50 PER PARTICIPANT
    const calculatedFee = 50 * participantCount;
    if (Math.abs(calculatedFee - payload.expectedAmount) > 0.01) {
      throw new Error(`Fee calculation mismatch: expected ₹${calculatedFee} (₹50 × ${participantCount} participants), but received ₹${payload.expectedAmount}.`);
    }

    const regId = payload.registrationId && payload.registrationId.startsWith('FIN-')
      ? payload.registrationId
      : await generateRegistrationId(isTest);

    const payId = payload.paymentId || `PAY-${regId}-${Date.now().toString().slice(-6)}`;

    // Initial payment status is 'submitted' (Pending Verification)
    // NEVER claim automatic success; requires administrative verification!
    const paymentStatus = 'submitted';
    const regStatus = 'registered';

    await execute(`
      INSERT INTO event_registrations (
        id, event_id, college_name, college_location, team_name,
        leader_name, leader_email, leader_phone, participant_count,
        total_fee, payment_status, registration_status, registration_type,
        transaction_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      regId,
      event.id,
      collegeName.trim(),
      collegeLocation.trim(),
      teamName?.trim() || null,
      leaderName.trim(),
      leaderEmail.trim().toLowerCase(),
      leaderPhone.trim(),
      participantCount,
      calculatedFee,
      paymentStatus,
      regStatus,
      regType,
      cleanUtr,
      now,
      now
    ]);

    // Insert participants
    for (let idx = 0; idx < participants.length; idx++) {
      const p = participants[idx];
      const partId = `PART-${regId}-${idx + 1}`;
      await execute(`
        INSERT INTO participants (
          id, registration_id, full_name, roll_number, department, year_of_study, section, participant_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        partId,
        regId,
        p.fullName.trim(),
        p.rollNumber.trim(),
        p.department.trim(),
        p.yearOfStudy.trim(),
        p.section.trim(),
        idx + 1
      ]);
    }

    // Insert payment record
    await execute(`
      INSERT INTO payments (
        id, reference_type, reference_id, gateway_order_id, gateway_payment_id,
        gateway_signature, amount, currency, status, payer_email, payer_phone,
        payment_method, idempotency_key, registration_type, created_at
      ) VALUES (?, 'event', ?, ?, ?, 'CLIENT_CONFIRMED', ?, 'INR', ?, ?, ?, 'UPI - GPay', ?, ?, ?)
    `, [
      payId,
      regId,
      `ORD-${regId}`,
      cleanUtr,
      calculatedFee,
      paymentStatus,
      leaderEmail.trim().toLowerCase(),
      leaderPhone.trim(),
      payId,
      regType,
      now
    ]);

    await logAuditEvent(
      'CLIENT_REGISTRATION_PIPELINE',
      'EVENT_REGISTRATION_SUBMITTED',
      'EVENT',
      regId,
      JSON.stringify({
        amount: calculatedFee,
        utrNumber: cleanUtr,
        paymentStatus,
        registrationType: regType,
        event: event.title
      })
    );

    return {
      success: true,
      registrationId: regId,
      referenceType: 'event',
      amount: calculatedFee,
      utrNumber: cleanUtr,
      registrationType: regType,
      paymentStatus,
      ticketDetails: {
        eventName: event.title,
        collegeName,
        leaderName,
        leaderEmail,
        leaderPhone,
        participantCount,
        totalFee: calculatedFee,
        transactionId: cleanUtr
      }
    };
  } else {
    // STALL REGISTRATION
    if (!payload.stallData) throw new Error('Missing stall booking details');
    const { optionId, applicantType, entityName, collegeName, departmentClass, contactName, contactEmail, contactPhone, businessDetails, productsServices, stallsRequested, durationDays } = payload.stallData;
    const validDays = (durationDays === 2) ? 2 : 1;

    const opt = await queryOne<StallOptionRecord>('SELECT * FROM stall_options WHERE id = ?', [optionId]);
    if (!opt) throw new Error('Stall option not found');

    const totalAmount = opt.price * stallsRequested * validDays;
    if (Math.abs(totalAmount - payload.expectedAmount) > 0.01) {
      throw new Error(`Fee calculation mismatch: expected ₹${totalAmount} (₹${opt.price} × ${stallsRequested} stall(s) × ${validDays} day(s)), received ₹${payload.expectedAmount}.`);
    }

    const bookingId = payload.registrationId && payload.registrationId.startsWith('FIN-')
      ? payload.registrationId
      : await generateStallBookingId(isTest);

    const payId = payload.paymentId || `PAY-${bookingId}-${Date.now().toString().slice(-6)}`;
    const paymentStatus = 'submitted';

    await execute(`
      INSERT INTO stall_bookings (
        id, option_id, stall_category, applicant_type, entity_name, college_name,
        department_class, contact_name, contact_email, contact_phone, business_details,
        products_services, stalls_requested, duration_days, has_electricity, total_amount, payment_status,
        status, registration_type, transaction_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `, [
      bookingId,
      opt.id,
      opt.category,
      applicantType,
      entityName.trim(),
      collegeName?.trim() || null,
      departmentClass?.trim() || null,
      contactName.trim(),
      contactEmail.trim().toLowerCase(),
      contactPhone.trim(),
      businessDetails?.trim() || null,
      productsServices.trim(),
      stallsRequested,
      validDays,
      opt.has_electricity,
      totalAmount,
      paymentStatus,
      regType,
      cleanUtr,
      now,
      now
    ]);

    await execute(`
      INSERT INTO payments (
        id, reference_type, reference_id, gateway_order_id, gateway_payment_id,
        gateway_signature, amount, currency, status, payer_email, payer_phone,
        payment_method, idempotency_key, registration_type, created_at
      ) VALUES (?, 'stall', ?, ?, ?, 'CLIENT_CONFIRMED', ?, 'INR', ?, ?, ?, 'UPI - GPay', ?, ?, ?)
    `, [
      payId,
      bookingId,
      `ORD-${bookingId}`,
      cleanUtr,
      totalAmount,
      paymentStatus,
      contactEmail.trim().toLowerCase(),
      contactPhone.trim(),
      payId,
      regType,
      now
    ]);

    await logAuditEvent(
      'CLIENT_REGISTRATION_PIPELINE',
      'STALL_BOOKING_SUBMITTED',
      'STALL',
      bookingId,
      JSON.stringify({
        amount: totalAmount,
        utrNumber: cleanUtr,
        category: opt.name,
        registrationType: regType
      })
    );

    return {
      success: true,
      registrationId: bookingId,
      referenceType: 'stall',
      amount: totalAmount,
      utrNumber: cleanUtr,
      registrationType: regType,
      paymentStatus,
      ticketDetails: {
        categoryName: opt.name,
        entityName,
        contactName,
        contactEmail,
        contactPhone,
        stallsRequested,
        durationDays: validDays,
        pricePerDay: opt.price,
        totalAmount,
        transactionId: cleanUtr
      }
    };
  }
}

// Fallback method for API routes that call createEventRegistration
export async function createEventRegistration(data: {
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
  isTest?: boolean;
}): Promise<{ registrationId: string; totalFee: number; participantCount: number; event: EventRecord }> {
  const event = await getEventBySlug(data.eventId);
  if (!event) throw new Error('Event not found');

  const participantCount = data.participants.length;
  const calculatedFee = 50 * participantCount;
  const isTest = Boolean(data.isTest);
  const regId = await generateRegistrationId(isTest);
  const now = new Date().toISOString();

  await execute(`
    INSERT INTO event_registrations (
      id, event_id, college_name, college_location, team_name,
      leader_name, leader_email, leader_phone, participant_count,
      total_fee, payment_status, registration_status, registration_type,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'registered', ?, ?, ?)
  `, [
    regId,
    event.id,
    data.collegeName.trim(),
    data.collegeLocation.trim(),
    data.teamName?.trim() || null,
    data.leaderName.trim(),
    data.leaderEmail.trim().toLowerCase(),
    data.leaderPhone.trim(),
    participantCount,
    calculatedFee,
    isTest ? 'TEST' : 'REAL',
    now,
    now
  ]);

  for (let idx = 0; idx < data.participants.length; idx++) {
    const p = data.participants[idx];
    await execute(`
      INSERT INTO participants (
        id, registration_id, full_name, roll_number, department, year_of_study, section, participant_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `PART-${regId}-${idx + 1}`,
      regId,
      p.fullName.trim(),
      p.rollNumber.trim(),
      p.department.trim(),
      p.yearOfStudy.trim(),
      p.section.trim(),
      idx + 1
    ]);
  }

  return {
    registrationId: regId,
    totalFee: calculatedFee,
    participantCount,
    event
  };
}

// =============================================================
// REGISTRATION RETRIEVAL & FILTERING
// =============================================================

export async function getEventRegistration(id: string): Promise<EventRegistrationRecord | null> {
  const reg = await queryOne<EventRegistrationRecord>('SELECT * FROM event_registrations WHERE id = ?', [id]);
  if (!reg) return null;

  const participants = await query<ParticipantRecord>(
    'SELECT * FROM participants WHERE registration_id = ? ORDER BY participant_order ASC',
    [id]
  );
  const event = await queryOne<EventRecord>('SELECT * FROM events WHERE id = ?', [reg.event_id]);

  return {
    ...reg,
    total_fee: Number(reg.total_fee || 0),
    participant_count: Number(reg.participant_count || 1),
    participants,
    event: event || undefined
  };
}

export async function getAllEventRegistrations(filter?: {
  eventId?: string;
  status?: string;
  registrationType?: 'REAL' | 'TEST' | 'ALL';
  search?: string;
}): Promise<EventRegistrationRecord[]> {
  let sql = 'SELECT * FROM event_registrations WHERE 1=1';
  const params: any[] = [];

  if (filter?.registrationType && filter.registrationType !== 'ALL') {
    sql += ' AND registration_type = ?';
    params.push(filter.registrationType);
  }

  if (filter?.eventId) {
    sql += ' AND event_id = ?';
    params.push(filter.eventId);
  }

  if (filter?.status) {
    sql += ' AND payment_status = ?';
    params.push(filter.status);
  }

  if (filter?.search) {
    sql += ' AND (id LIKE ? OR leader_name LIKE ? OR leader_email LIKE ? OR college_name LIKE ? OR transaction_id LIKE ?)';
    const term = `%${filter.search}%`;
    params.push(term, term, term, term, term);
  }

  sql += ' ORDER BY created_at DESC';
  const rows = await query<EventRegistrationRecord>(sql, params);

  // Enrich with event titles
  const events = await getAllEvents();
  const eventMap = new Map(events.map(e => [e.id, e]));

  return rows.map(r => ({
    ...r,
    event: eventMap.get(r.event_id)
  }));
}

// =============================================================
// TEST DATA MANAGEMENT & DELETION
// =============================================================

export async function deleteTestRegistrations(ids?: string[]): Promise<{
  deletedCount: number;
  deletedRegistrations: string[];
}> {
  let targetIds: string[] = [];

  if (ids && ids.length > 0) {
    // Only allow deletion of records that are strictly marked TEST
    const placeholders = ids.map(() => '?').join(',');
    const rows = await query<{ id: string }>(
      `SELECT id FROM event_registrations WHERE id IN (${placeholders}) AND registration_type = 'TEST'`,
      ids
    );
    targetIds = rows.map(r => r.id);
  } else {
    // Delete all test registrations
    const rows = await query<{ id: string }>(
      "SELECT id FROM event_registrations WHERE registration_type = 'TEST'"
    );
    targetIds = rows.map(r => r.id);
  }

  if (targetIds.length === 0) {
    return { deletedCount: 0, deletedRegistrations: [] };
  }

  for (const regId of targetIds) {
    await execute('DELETE FROM participants WHERE registration_id = ?', [regId]);
    await execute('DELETE FROM payments WHERE reference_id = ?', [regId]);
    await execute('DELETE FROM event_registrations WHERE id = ?', [regId]);
  }

  // Also purge any test stall bookings
  await execute("DELETE FROM payments WHERE reference_id IN (SELECT id FROM stall_bookings WHERE registration_type = 'TEST')");
  await execute("DELETE FROM stall_bookings WHERE registration_type = 'TEST'");

  await logAuditEvent(
    'ADMIN_USER',
    'DELETE_TEST_DATA',
    'TEST_REGISTRATIONS',
    targetIds.join(','),
    `Deleted ${targetIds.length} test registration(s) and related records.`
  );

  return {
    deletedCount: targetIds.length,
    deletedRegistrations: targetIds
  };
}

export async function deleteRegistration(id: string, adminUsername: string, confirmReal: boolean = false): Promise<boolean> {
  const reg = await getEventRegistration(id);
  if (!reg) return false;

  if (reg.registration_type === 'REAL' && !confirmReal) {
    throw new Error('Safety check: Deleting a REAL genuine student registration requires explicit high-level confirmation.');
  }

  await execute('DELETE FROM participants WHERE registration_id = ?', [id]);
  await execute('DELETE FROM payments WHERE reference_id = ?', [id]);
  await execute('DELETE FROM event_registrations WHERE id = ?', [id]);

  await logAuditEvent(
    adminUsername,
    'DELETE_REGISTRATION',
    'EVENT_REGISTRATION',
    id,
    `Deleted registration (${reg.registration_type}): ${reg.leader_name} (${reg.college_name})`
  );

  return true;
}

// =============================================================
// STALLS API
// =============================================================

export async function getAllStallOptions(): Promise<StallOptionRecord[]> {
  const now = Date.now();
  if (_cachedStallOptions && now - _cachedStallOptions.timestamp < CACHE_TTL_MS) {
    return _cachedStallOptions.data;
  }
  const options = await query<StallOptionRecord>('SELECT * FROM stall_options WHERE is_active = 1 ORDER BY price ASC');

  // Compute booked counts
  const bookedCounts = await query<{ option_id: string; total_booked: string | number }>(`
    SELECT option_id, COALESCE(SUM(stalls_requested), 0) as total_booked
    FROM stall_bookings
    WHERE status IN ('paid', 'approved', 'submitted', 'pending')
    GROUP BY option_id
  `);

  const bookedMap = new Map(bookedCounts.map(b => [b.option_id, Number(b.total_booked)]));

  const enriched = options.map(opt => {
    const booked = bookedMap.get(opt.id) || 0;
    return {
      ...opt,
      booked_count: booked,
      available_stalls: Math.max(0, opt.total_stalls - booked)
    };
  });
  _cachedStallOptions = { data: enriched, timestamp: now };
  return enriched;
}

export async function createStallBooking(data: {
  optionId: string;
  applicantType: string;
  entityName: string;
  collegeName?: string;
  departmentClass?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessDetails?: string;
  productsServices: string;
  stallsRequested: number;
  durationDays?: number;
  isTest?: boolean;
}): Promise<{ bookingId: string; totalAmount: number; stallOption: StallOptionRecord }> {
  const opt = await queryOne<StallOptionRecord>('SELECT * FROM stall_options WHERE id = ?', [data.optionId]);
  if (!opt) throw new Error('Stall option not found');

  const durationDays = (data.durationDays === 2) ? 2 : 1;
  const totalAmount = opt.price * data.stallsRequested * durationDays;
  const isTest = Boolean(data.isTest);
  const bookingId = await generateStallBookingId(isTest);
  const now = new Date().toISOString();

  await execute(`
    INSERT INTO stall_bookings (
      id, option_id, stall_category, applicant_type, entity_name, college_name,
      department_class, contact_name, contact_email, contact_phone, business_details,
      products_services, stalls_requested, duration_days, has_electricity, total_amount, status,
      payment_status, registration_type, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?)
  `, [
    bookingId,
    opt.id,
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
    durationDays,
    opt.has_electricity,
    totalAmount,
    isTest ? 'TEST' : 'REAL',
    now,
    now
  ]);

  return {
    bookingId,
    totalAmount,
    stallOption: opt
  };
}

export async function getStallBooking(id: string): Promise<StallBookingRecord | null> {
  const booking = await queryOne<StallBookingRecord>('SELECT * FROM stall_bookings WHERE id = ?', [id]);
  if (!booking) return null;
  const opt = await queryOne<StallOptionRecord>('SELECT name FROM stall_options WHERE id = ?', [booking.option_id]);
  return {
    ...booking,
    total_amount: Number(booking.total_amount || 0),
    stalls_requested: Number(booking.stalls_requested || 1),
    option_name: opt?.name
  };
}

export async function getAllStallBookings(filter?: {
  status?: string;
  registrationType?: 'REAL' | 'TEST' | 'ALL';
  search?: string;
}): Promise<StallBookingRecord[]> {
  let sql = 'SELECT * FROM stall_bookings WHERE 1=1';
  const params: any[] = [];

  if (filter?.registrationType && filter.registrationType !== 'ALL') {
    sql += ' AND registration_type = ?';
    params.push(filter.registrationType);
  }

  if (filter?.status) {
    sql += ' AND status = ?';
    params.push(filter.status);
  }

  if (filter?.search) {
    sql += ' AND (id LIKE ? OR entity_name LIKE ? OR contact_name LIKE ? OR contact_email LIKE ? OR transaction_id LIKE ?)';
    const term = `%${filter.search}%`;
    params.push(term, term, term, term, term);
  }

  sql += ' ORDER BY created_at DESC';
  const rows = await query<StallBookingRecord>(sql, params);

  const options = await query<StallOptionRecord>('SELECT id, name FROM stall_options');
  const optMap = new Map(options.map(o => [o.id, o.name]));

  return rows.map(r => ({
    ...r,
    option_name: optMap.get(r.option_id)
  }));
}

export async function updateStallBookingStatus(
  id: string,
  status: string,
  adminUsername: string,
  notes?: string
): Promise<boolean> {
  const now = new Date().toISOString();
  await execute(`
    UPDATE stall_bookings SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?
  `, [status, notes || null, now, id]);

  await logAuditEvent(
    adminUsername,
    'UPDATE_STALL_STATUS',
    'STALL_BOOKING',
    id,
    `Status updated to: ${status}`
  );
  return true;
}

export async function updateStallOption(
  id: string,
  data: Partial<StallOptionRecord>,
  adminUsername: string
): Promise<boolean> {
  const existing = await queryOne<StallOptionRecord>('SELECT * FROM stall_options WHERE id = ?', [id]);
  if (!existing) return false;

  await execute(`
    UPDATE stall_options SET
      name = ?, price = ?, has_electricity = ?, description = ?,
      total_stalls = ?, is_active = ?
    WHERE id = ?
  `, [
    data.name ?? existing.name,
    data.price ?? existing.price,
    data.has_electricity ?? existing.has_electricity,
    data.description ?? existing.description,
    data.total_stalls ?? existing.total_stalls,
    data.is_active ?? existing.is_active,
    id
  ]);

  await logAuditEvent(
    adminUsername,
    'UPDATE_STALL_OPTION',
    'STALL_OPTION',
    id,
    `Updated pricing / configuration for stall: ${existing.name}`
  );
  return true;
}

// =============================================================
// PAYMENTS & RECONCILIATIONS API
// (MANUAL VERIFICATION WORKFLOW)
// =============================================================

export async function getAllPayments(filter?: {
  status?: string;
  registrationType?: 'REAL' | 'TEST' | 'ALL';
  search?: string;
}): Promise<PaymentRecord[]> {
  let sql = 'SELECT * FROM payments WHERE 1=1';
  const params: any[] = [];

  if (filter?.registrationType && filter.registrationType !== 'ALL') {
    sql += ' AND registration_type = ?';
    params.push(filter.registrationType);
  }

  if (filter?.status) {
    sql += ' AND status = ?';
    params.push(filter.status);
  }

  if (filter?.search) {
    sql += ' AND (id LIKE ? OR reference_id LIKE ? OR gateway_payment_id LIKE ? OR payer_email LIKE ?)';
    const term = `%${filter.search}%`;
    params.push(term, term, term, term);
  }

  sql += ' ORDER BY created_at DESC';
  const payments = await query<PaymentRecord>(sql, params);

  // Attach reference details for quick display
  const events = await getAllEvents();
  const eventMap = new Map(events.map(e => [e.id, e]));

  const regs = await query<{ id: string; event_id: string; participant_count: number }>(
    'SELECT id, event_id, participant_count FROM event_registrations'
  );
  const regMap = new Map(regs.map(r => [r.id, r]));

  return payments.map(p => {
    let itemTitle = p.reference_type === 'event' ? 'Competition Registration' : 'Festival Stall';
    let participantCount = 1;

    if (p.reference_type === 'event') {
      const reg = regMap.get(p.reference_id);
      if (reg) {
        participantCount = reg.participant_count;
        const ev = eventMap.get(reg.event_id);
        if (ev) itemTitle = ev.title;
      }
    }

    return {
      ...p,
      item_title: itemTitle,
      participant_count: participantCount
    };
  });
}

export async function verifyPayment(paymentId: string, adminUsername: string): Promise<boolean> {
  const pay = await queryOne<PaymentRecord>('SELECT * FROM payments WHERE id = ?', [paymentId]);
  if (!pay) throw new Error('Payment not found');

  const now = new Date().toISOString();
  await execute(`
    UPDATE payments SET
      status = 'verified', verified_at = ?, verified_by = ?
    WHERE id = ?
  `, [now, adminUsername, paymentId]);

  // Update associated registration
  if (pay.reference_type === 'event') {
    await execute(`
      UPDATE event_registrations SET
        payment_status = 'verified', registration_status = 'confirmed', updated_at = ?
      WHERE id = ?
    `, [now, pay.reference_id]);
  } else {
    await execute(`
      UPDATE stall_bookings SET
        payment_status = 'verified', status = 'approved', updated_at = ?
      WHERE id = ?
    `, [now, pay.reference_id]);
  }

  await logAuditEvent(
    adminUsername,
    'PAYMENT_VERIFIED',
    'PAYMENT',
    paymentId,
    `Admin manually verified payment of ₹${pay.amount} (Ref: ${pay.reference_id}, UTR: ${pay.gateway_payment_id || 'N/A'})`
  );

  return true;
}

export async function rejectPayment(paymentId: string, adminUsername: string, reason: string): Promise<boolean> {
  const pay = await queryOne<PaymentRecord>('SELECT * FROM payments WHERE id = ?', [paymentId]);
  if (!pay) throw new Error('Payment not found');

  const now = new Date().toISOString();
  await execute(`
    UPDATE payments SET
      status = 'rejected', rejection_reason = ?, verified_at = ?, verified_by = ?
    WHERE id = ?
  `, [reason, now, adminUsername, paymentId]);

  if (pay.reference_type === 'event') {
    await execute(`
      UPDATE event_registrations SET
        payment_status = 'rejected', updated_at = ?
      WHERE id = ?
    `, [now, pay.reference_id]);
  } else {
    await execute(`
      UPDATE stall_bookings SET
        payment_status = 'rejected', status = 'rejected', updated_at = ?
      WHERE id = ?
    `, [now, pay.reference_id]);
  }

  await logAuditEvent(
    adminUsername,
    'PAYMENT_REJECTED',
    'PAYMENT',
    paymentId,
    `Admin rejected payment: ${reason}`
  );

  return true;
}

export async function refundPayment(paymentId: string, adminUsername: string, reason: string): Promise<boolean> {
  const pay = await queryOne<PaymentRecord>('SELECT * FROM payments WHERE id = ?', [paymentId]);
  if (!pay) throw new Error('Payment not found');

  const now = new Date().toISOString();
  await execute(`
    UPDATE payments SET
      status = 'refunded', rejection_reason = ?, verified_at = ?, verified_by = ?
    WHERE id = ?
  `, [reason, now, adminUsername, paymentId]);

  if (pay.reference_type === 'event') {
    await execute(`
      UPDATE event_registrations SET
        payment_status = 'refunded', registration_status = 'cancelled', updated_at = ?
      WHERE id = ?
    `, [now, pay.reference_id]);
  }

  await logAuditEvent(
    adminUsername,
    'PAYMENT_REFUNDED',
    'PAYMENT',
    paymentId,
    `Refund logged: ${reason}`
  );

  return true;
}

// =============================================================
// ADMIN USERS & CREDENTIALS MANAGEMENT
// =============================================================

export async function getAdminUserByUsername(username: string): Promise<{
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  role: string;
} | null> {
  return queryOne('SELECT * FROM admin_users WHERE LOWER(username) = LOWER(?)', [username.trim()]);
}

export async function changeAdminCredentials(
  currentUsername: string,
  newUsername: string,
  newPasswordPlain: string,
  actorAdmin: string
): Promise<{ success: boolean; message: string }> {
  if (!newUsername || newUsername.trim().length < 3) {
    throw new Error('New username must be at least 3 characters long.');
  }

  if (!newPasswordPlain || newPasswordPlain.trim().length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }

  const cleanNewUser = newUsername.trim().toLowerCase();
  const cleanCurrent = currentUsername.trim().toLowerCase();
  const passwordHash = bcrypt.hashSync(newPasswordPlain.trim(), 10);
  const now = new Date().toISOString();

  // Check if target username is already taken by another admin
  if (cleanNewUser !== cleanCurrent) {
    const existing = await queryOne('SELECT id FROM admin_users WHERE LOWER(username) = ?', [cleanNewUser]);
    if (existing) {
      throw new Error(`Username '${newUsername}' is already taken.`);
    }
  }

  const user = await queryOne<{ id: string }>('SELECT id FROM admin_users WHERE LOWER(username) = ?', [cleanCurrent]);

  if (user) {
    await execute(`
      UPDATE admin_users SET
        username = ?, password_hash = ?, updated_at = ?
      WHERE id = ?
    `, [cleanNewUser, passwordHash, now, user.id]);
  } else {
    // Insert if root admin not yet in database
    await execute(`
      INSERT INTO admin_users (id, username, password_hash, display_name, role, created_at, updated_at)
      VALUES (?, ?, ?, 'System Administrator', 'admin', ?, ?)
    `, [`admin-${Date.now()}`, cleanNewUser, passwordHash, now, now]);
  }

  await logAuditEvent(
    actorAdmin,
    'CHANGE_ADMIN_CREDENTIALS',
    'ADMIN_USER',
    cleanNewUser,
    `Admin username/password updated successfully across central SQL database.`
  );

  return {
    success: true,
    message: `Admin credentials updated. New username: ${cleanNewUser}. Works immediately on all devices.`
  };
}

// =============================================================
// AUDIT LOGS
// =============================================================

export async function logAuditEvent(
  actor: string,
  action: string,
  target_type: string,
  target_id: string,
  details?: string,
  ip_address?: string
): Promise<void> {
  const id = `AUD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const now = new Date().toISOString();
  try {
    await execute(`
      INSERT INTO audit_logs (id, actor, action, target_type, target_id, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, actor, action, target_type, target_id, details || null, ip_address || null, now]);
  } catch (err) {
    console.warn('Audit log write error:', err);
  }
}

export async function getAuditLogs(limit: number = 50): Promise<AuditLogRecord[]> {
  return query<AuditLogRecord>(
    `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ${Math.min(limit, 200)}`
  );
}

// =============================================================
// DASHBOARD METRICS (SEPARATING REAL & TEST REGISTRATIONS)
// =============================================================

export async function getDashboardMetrics(filterType: 'REAL' | 'ALL' | 'TEST' = 'REAL'): Promise<{
  totalRealRegistrations: number;
  totalTestRegistrations: number;
  totalEventRegs: number;
  confirmedEventRegs: number;
  totalConfirmedParticipants: number;
  totalStallBookings: number;
  studentStallBookings: number;
  vendorStallBookings: number;
  verifiedCollections: number;
  submittedCollections: number;
  pendingCollections: number;
  refundedCollections: number;
  pendingPayments: number;
  successfulPayments: number;
  verifiedPayments: number;
  submittedPayments: number;
  failedPayments: number;
  activeFilter: 'REAL' | 'ALL' | 'TEST';
  isCentralizedDatabase: boolean;
  databaseEngine: string;
  eventsBreakdown: Array<{
    id: string;
    title: string;
    total_registrations: number;
    real_registrations: number;
    test_registrations: number;
    paid_registrations: number;
    total_participants: number;
  }>;
  stallInventorySummary: Array<{
    id: string;
    name: string;
    price: number;
    total_stalls: number;
    booked_count: number;
    available_stalls: number;
  }>;
}> {
  await ensureSchema();

  // 1. Separate real vs test registration counts
  const realRegsRow = await queryOne<{ count: string | number }>(
    "SELECT COUNT(*) as count FROM event_registrations WHERE registration_type = 'REAL'"
  );
  const testRegsRow = await queryOne<{ count: string | number }>(
    "SELECT COUNT(*) as count FROM event_registrations WHERE registration_type = 'TEST'"
  );

  const totalRealRegistrations = Number(realRegsRow?.count || 0);
  const totalTestRegistrations = Number(testRegsRow?.count || 0);

  // 2. Filter query clause
  const regTypeClause = filterType === 'ALL'
    ? '1=1'
    : filterType === 'TEST'
    ? "registration_type = 'TEST'"
    : "registration_type = 'REAL'";

  const filteredRegsRow = await queryOne<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM event_registrations WHERE ${regTypeClause}`
  );
  const totalEventRegs = Number(filteredRegsRow?.count || 0);

  const confirmedRegsRow = await queryOne<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM event_registrations WHERE ${regTypeClause} AND payment_status IN ('verified', 'paid', 'submitted')`
  );
  const confirmedEventRegs = Number(confirmedRegsRow?.count || 0);

  const participantsRow = await queryOne<{ total: string | number }>(
    `SELECT COALESCE(SUM(participant_count), 0) as total FROM event_registrations WHERE ${regTypeClause}`
  );
  const totalConfirmedParticipants = Number(participantsRow?.total || 0);

  // 3. Stalls counts
  const stallTypeClause = filterType === 'ALL'
    ? '1=1'
    : filterType === 'TEST'
    ? "registration_type = 'TEST'"
    : "registration_type = 'REAL'";

  const stallRows = await queryOne<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM stall_bookings WHERE ${stallTypeClause}`
  );
  const totalStallBookings = Number(stallRows?.count || 0);

  const studentStalls = await queryOne<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM stall_bookings WHERE ${stallTypeClause} AND applicant_type = 'student'`
  );
  const vendorStalls = await queryOne<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM stall_bookings WHERE ${stallTypeClause} AND applicant_type = 'vendor'`
  );

  // 4. Financial breakdown (Test data must NOT distort genuine collections!)
  const payTypeClause = filterType === 'ALL'
    ? '1=1'
    : filterType === 'TEST'
    ? "registration_type = 'TEST'"
    : "registration_type = 'REAL'";

  const verifiedSumRow = await queryOne<{ total: string | number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE ${payTypeClause} AND status IN ('verified', 'successful', 'paid')`
  );
  const submittedSumRow = await queryOne<{ total: string | number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE ${payTypeClause} AND status = 'submitted'`
  );
  const pendingSumRow = await queryOne<{ total: string | number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE ${payTypeClause} AND status = 'pending'`
  );
  const refundedSumRow = await queryOne<{ total: string | number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE ${payTypeClause} AND status = 'refunded'`
  );

  const verifiedCollections = Number(verifiedSumRow?.total || 0);
  const submittedCollections = Number(submittedSumRow?.total || 0);
  const pendingCollections = Number(pendingSumRow?.total || 0);
  const refundedCollections = Number(refundedSumRow?.total || 0);

  // 5. Payment status tallies
  const pendingPayRow = await queryOne<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM payments WHERE ${payTypeClause} AND status = 'pending'`
  );
  const submittedPayRow = await queryOne<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM payments WHERE ${payTypeClause} AND status = 'submitted'`
  );
  const verifiedPayRow = await queryOne<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM payments WHERE ${payTypeClause} AND status IN ('verified', 'successful')`
  );
  const rejectedPayRow = await queryOne<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM payments WHERE ${payTypeClause} AND status IN ('rejected', 'failed')`
  );

  // 6. Events breakdown
  const events = await getAllEvents();
  const eventsBreakdown = [];

  for (const ev of events) {
    const totalRow = await queryOne<{ count: string | number }>(
      'SELECT COUNT(*) as count FROM event_registrations WHERE event_id = ?',
      [ev.id]
    );
    const realRow = await queryOne<{ count: string | number }>(
      "SELECT COUNT(*) as count FROM event_registrations WHERE event_id = ? AND registration_type = 'REAL'",
      [ev.id]
    );
    const testRow = await queryOne<{ count: string | number }>(
      "SELECT COUNT(*) as count FROM event_registrations WHERE event_id = ? AND registration_type = 'TEST'",
      [ev.id]
    );
    const paidRow = await queryOne<{ count: string | number }>(
      "SELECT COUNT(*) as count FROM event_registrations WHERE event_id = ? AND payment_status IN ('verified', 'paid', 'submitted')",
      [ev.id]
    );
    const partRow = await queryOne<{ total: string | number }>(
      `SELECT COALESCE(SUM(participant_count), 0) as total FROM event_registrations WHERE event_id = ? AND ${regTypeClause}`,
      [ev.id]
    );

    eventsBreakdown.push({
      id: ev.id,
      title: ev.title,
      total_registrations: Number(totalRow?.count || 0),
      real_registrations: Number(realRow?.count || 0),
      test_registrations: Number(testRow?.count || 0),
      paid_registrations: Number(paidRow?.count || 0),
      total_participants: Number(partRow?.total || 0)
    });
  }

  // 7. Stalls summary
  const stallOptions = await getAllStallOptions();
  const stallInventorySummary = stallOptions.map(st => ({
    id: st.id,
    name: st.name,
    price: st.price,
    total_stalls: st.total_stalls,
    booked_count: st.booked_count || 0,
    available_stalls: st.available_stalls ?? st.total_stalls
  }));

  const engineInfo = getDatabaseEngineInfo();

  return {
    totalRealRegistrations,
    totalTestRegistrations,
    totalEventRegs,
    confirmedEventRegs,
    totalConfirmedParticipants,
    totalStallBookings,
    studentStallBookings: Number(studentStalls?.count || 0),
    vendorStallBookings: Number(vendorStalls?.count || 0),
    verifiedCollections,
    submittedCollections,
    pendingCollections,
    refundedCollections,
    pendingPayments: Number(pendingPayRow?.count || 0),
    successfulPayments: Number(verifiedPayRow?.count || 0),
    verifiedPayments: Number(verifiedPayRow?.count || 0),
    submittedPayments: Number(submittedPayRow?.count || 0),
    failedPayments: Number(rejectedPayRow?.count || 0),
    activeFilter: filterType,
    isCentralizedDatabase: engineInfo.isCentralized,
    databaseEngine: engineInfo.engine,
    eventsBreakdown,
    stallInventorySummary
  };
}

// =============================================================
// SITE SETTINGS API
// =============================================================

export async function getSiteSettings(): Promise<Record<string, string>> {
  await ensureSchema();
  const now = Date.now();
  if (_cachedSiteSettings && now - _cachedSiteSettings.timestamp < CACHE_TTL_MS) {
    return _cachedSiteSettings.data;
  }
  const rows = await query<{ key: string; value: string }>('SELECT key, value FROM site_settings');
  const out: Record<string, string> = {};
  for (const r of rows) {
    out[r.key] = r.value;
  }
  _cachedSiteSettings = { data: out, timestamp: now };
  return out;
}

export async function updateSiteSettings(settings: Record<string, string>): Promise<void> {
  await ensureSchema();
  for (const [k, v] of Object.entries(settings)) {
    if (DATABASE_URL) {
      await getPgPool().query(`
        INSERT INTO site_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = $2
      `, [k, String(v)]);
    } else {
      getSqliteDb().prepare(`
        INSERT INTO site_settings (key, value)
        VALUES (?, ?)
        ON CONFLICT (key) DO UPDATE SET value = excluded.value
      `).run(k, String(v));
    }
  }
  invalidateCache('settings');
}

// =============================================================
// ENQUIRIES API (CONTACT & USER FEEDBACK)
// =============================================================

export async function createEnquiry(data: {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  email_status?: 'sent' | 'failed' | 'pending';
  email_dispatched?: number;
  email_error?: string;
}): Promise<EnquiryRecord> {
  await ensureSchema();
  const id = `FX-ENQ-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const now = new Date().toISOString();
  const emailStatus = data.email_status || (data.email_dispatched === 1 ? 'sent' : 'failed');
  await execute(`
    INSERT INTO enquiries (id, name, email, phone, subject, message, status, email_status, email_dispatched, email_error, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)
  `, [
    id,
    data.name.trim(),
    data.email.trim().toLowerCase(),
    data.phone ? data.phone.trim() : null,
    data.subject.trim(),
    data.message.trim(),
    emailStatus,
    emailStatus === 'sent' ? 1 : 0,
    data.email_error || null,
    now
  ]);
  return {
    id,
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone ? data.phone.trim() : undefined,
    subject: data.subject.trim(),
    message: data.message.trim(),
    status: 'new',
    email_status: emailStatus,
    email_dispatched: emailStatus === 'sent' ? 1 : 0,
    email_error: data.email_error,
    created_at: now
  };
}

export async function updateEnquiryEmailStatus(
  id: string,
  dispatched: boolean,
  error?: string
): Promise<boolean> {
  await ensureSchema();
  const res = await execute(
    'UPDATE enquiries SET email_dispatched = ?, email_error = ? WHERE id = ?',
    [dispatched ? 1 : 0, error || null, id]
  );
  return res.rowCount > 0;
}

export async function getAllEnquiries(status?: string): Promise<EnquiryRecord[]> {
  await ensureSchema();
  if (status && status !== 'ALL' && status !== 'all') {
    return query<EnquiryRecord>('SELECT * FROM enquiries WHERE status = ? ORDER BY created_at DESC', [status]);
  }
  return query<EnquiryRecord>('SELECT * FROM enquiries ORDER BY created_at DESC');
}

export async function updateEnquiryStatus(id: string, status: 'new' | 'in-progress' | 'resolved'): Promise<boolean> {
  await ensureSchema();
  const res = await execute('UPDATE enquiries SET status = ? WHERE id = ?', [status, id]);
  return res.rowCount > 0;
}

// =============================================================
// DATABASE BACKUP & EXPORT (DISASTER RECOVERY)
// =============================================================

export async function exportDatabaseBackup(): Promise<{
  exportedAt: string;
  engine: string;
  isCentralized: boolean;
  events: EventRecord[];
  event_registrations: EventRegistrationRecord[];
  participants: ParticipantRecord[];
  stall_options: StallOptionRecord[];
  stall_bookings: StallBookingRecord[];
  payments: PaymentRecord[];
  site_settings: Record<string, string>;
  counts: {
    realRegistrations: number;
    testRegistrations: number;
    participants: number;
    payments: number;
    stalls: number;
  };
}> {
  await ensureSchema();

  const events = await query<EventRecord>('SELECT * FROM events ORDER BY id ASC');
  const event_registrations = await query<EventRegistrationRecord>('SELECT * FROM event_registrations ORDER BY created_at DESC');
  const participants = await query<ParticipantRecord>('SELECT * FROM participants ORDER BY registration_id ASC, participant_order ASC');
  const stall_options = await query<StallOptionRecord>('SELECT * FROM stall_options ORDER BY id ASC');
  const stall_bookings = await query<StallBookingRecord>('SELECT * FROM stall_bookings ORDER BY created_at DESC');
  const payments = await query<PaymentRecord>('SELECT * FROM payments ORDER BY created_at DESC');
  const settings = await getSiteSettings();

  const realCount = event_registrations.filter(r => r.registration_type === 'REAL').length;
  const testCount = event_registrations.filter(r => r.registration_type === 'TEST').length;

  return {
    exportedAt: new Date().toISOString(),
    engine: DATABASE_URL ? 'PostgreSQL Central Database' : 'SQLite Local',
    isCentralized: Boolean(DATABASE_URL),
    events,
    event_registrations,
    participants,
    stall_options,
    stall_bookings,
    payments,
    site_settings: settings,
    counts: {
      realRegistrations: realCount,
      testRegistrations: testCount,
      participants: participants.length,
      payments: payments.length,
      stalls: stall_bookings.length
    }
  };
}
