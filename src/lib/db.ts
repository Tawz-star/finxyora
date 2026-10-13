import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { DIRECT_UPI_CONFIG, buildDynamicUpiUrl, buildQrCodeImageUrl, getPaymentGatewayInfo } from './payment-gateway';
import { sendRejectionRefundEmail, sendPaymentVerifiedConfirmationEmail } from './email';
import { getEventKeyIdentifier } from './payment-types';

export { getEventKeyIdentifier };

// =============================================================
// DATABASE ENGINE CONFIGURATION
// =============================================================

// Priority: PostgreSQL via DATABASE_URL or POSTGRES_URL (Single Source of Truth)
const RAW_DATABASE_URL = (process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.FINXYORA_DATABASE_URL || '').trim();
const DATABASE_URL = ((RAW_DATABASE_URL.startsWith('postgres://') || RAW_DATABASE_URL.startsWith('postgresql://')) && !RAW_DATABASE_URL.includes('[SENSITIVE]'))
  ? RAW_DATABASE_URL
  : '';

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
  rejection_reason?: string;
  rejected_at?: string;
  refund_status?: string;
  email_status?: string;
  email_sent_at?: string;
  email_error?: string;
  payment_screenshot?: string | null;
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
  selected_day?: string;
  booking_dates?: string;
  has_electricity: number;
  total_amount: number;
  payment_status: 'pending' | 'submitted' | 'verified' | 'rejected' | 'paid';
  status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'refunded' | 'paid';
  registration_type: 'REAL' | 'TEST';
  transaction_id?: string;
  admin_notes?: string;
  rejection_reason?: string;
  rejected_at?: string;
  refund_status?: string;
  email_status?: string;
  email_sent_at?: string;
  email_error?: string;
  payment_screenshot?: string | null;
  created_at: string;
  updated_at: string;
  option_name?: string;
}

export function formatApplicantType(type?: string | null, category?: string | null): 'Student' | 'Outsider' {
  const norm = String(type || '').trim().toLowerCase();
  const catNorm = String(category || '').trim().toUpperCase();
  if (norm === 'outsider' || norm === 'vendor' || catNorm === 'OUTSIDE_VENDOR') {
    return 'Outsider';
  }
  return 'Student';
}

export function formatCreatedAtIST(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).formatToParts(d);
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  const period = (p.dayPeriod || '').toUpperCase();
  return `${p.weekday}, ${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute} ${period} IST`;
}

export type PaymentStatus =
  | 'PENDING'
  | 'VERIFYING'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'REVIEW_REQUIRED'
  | 'Pending upon submission'
  | 'pending'
  | 'submitted'
  | 'verified'
  | 'rejected'
  | 'successful'
  | 'failed'
  | 'refunded';

export function normalizePaymentStatus(status?: string | null): 'PENDING' | 'VERIFYING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REVIEW_REQUIRED' | 'REFUNDED' {
  const s = String(status || '').toUpperCase();
  if (s === 'REFUNDED') return 'REFUNDED';
  if (s === 'PAID' || s === 'VERIFIED' || s === 'SUCCESSFUL' || s === 'CONFIRMED' || s === 'APPROVED') return 'PAID';
  if (s === 'REVIEW_REQUIRED' || s === 'SUBMITTED' || s === 'PENDING_REVIEW' || s.includes('PENDING UPON SUBMISSION')) return 'REVIEW_REQUIRED';
  if (s === 'VERIFYING') return 'VERIFYING';
  if (s === 'FAILED' || s === 'REJECTED' || s === 'CANCELLED') return 'FAILED';
  if (s === 'EXPIRED') return 'EXPIRED';
  return 'PENDING';
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
  status: PaymentStatus;
  payer_email?: string;
  payer_phone?: string;
  payment_method: string;
  idempotency_key?: string;
  registration_type: 'REAL' | 'TEST';
  created_at: string;
  verified_at?: string;
  verified_by?: string;
  rejection_reason?: string;
  user_reference?: string;
  provider_reference?: string;
  verified_amount?: number;
  review_notes?: string;
  verification_method?: string;
  refund_status?: string;
  refund_amount?: number;
  refund_ref?: string;
  refunded_at?: string;
  rejected_at?: string;
  email_status?: string;
  email_sent_at?: string;
  email_error?: string;
  item_title?: string;
  participant_count?: number;
  payment_screenshot?: string | null;
  leader_name?: string | null;
  leader_email?: string | null;
  leader_phone?: string | null;
  college_name?: string | null;
  team_name?: string | null;
  participants_list?: Array<{
    fullName: string;
    rollNumber: string;
    department: string;
    yearOfStudy: string;
    section: string;
  }>;
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
        selected_day VARCHAR(50),
        booking_dates TEXT,
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

      CREATE TABLE IF NOT EXISTS incoming_bank_credits (
        id VARCHAR(100) PRIMARY KEY,
        amount NUMERIC(10,2) NOT NULL,
        sender_phone VARCHAR(50),
        sender_vpa VARCHAR(150),
        bank_ref VARCHAR(100),
        payer_name VARCHAR(150),
        raw_message TEXT,
        matched_payment_id VARCHAR(100),
        matched_registration_id VARCHAR(100),
        created_at VARCHAR(100) NOT NULL,
        matched_at VARCHAR(100)
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
    await safeAddPgCol('stall_bookings', 'selected_day', 'VARCHAR(50)');
    await safeAddPgCol('stall_bookings', 'booking_dates', 'TEXT');
    await safeAddPgCol('payments', 'registration_type', 'VARCHAR(20) DEFAULT \'REAL\'');
    await safeAddPgCol('payments', 'verified_by', 'VARCHAR(100)');
    await safeAddPgCol('payments', 'verified_at', 'VARCHAR(100)');
    await safeAddPgCol('payments', 'rejection_reason', 'TEXT');
    await safeAddPgCol('payments', 'user_reference', 'VARCHAR(100)');
    await safeAddPgCol('payments', 'provider_reference', 'VARCHAR(100)');
    await safeAddPgCol('payments', 'verified_amount', 'NUMERIC(10,2)');
    await safeAddPgCol('payments', 'review_notes', 'TEXT');
    await safeAddPgCol('payments', 'verification_method', 'VARCHAR(50)');
    await safeAddPgCol('enquiries', 'phone', 'VARCHAR(50)');
    await safeAddPgCol('enquiries', 'email_status', "VARCHAR(50) DEFAULT 'pending'");
    await safeAddPgCol('enquiries', 'email_dispatched', 'INTEGER DEFAULT 0');
    await safeAddPgCol('enquiries', 'email_error', 'TEXT');
    await safeAddPgCol('payments', 'refund_status', "VARCHAR(50) DEFAULT 'NONE'");
    await safeAddPgCol('payments', 'refund_amount', 'NUMERIC(10,2) DEFAULT 0');
    await safeAddPgCol('payments', 'refund_ref', 'VARCHAR(100)');
    await safeAddPgCol('payments', 'refunded_at', 'VARCHAR(100)');
    await safeAddPgCol('payments', 'rejected_at', 'VARCHAR(100)');
    await safeAddPgCol('payments', 'email_status', "VARCHAR(50) DEFAULT 'NONE'");
    await safeAddPgCol('payments', 'email_sent_at', 'VARCHAR(100)');
    await safeAddPgCol('payments', 'email_error', 'TEXT');
    await safeAddPgCol('event_registrations', 'rejection_reason', 'TEXT');
    await safeAddPgCol('event_registrations', 'rejected_at', 'VARCHAR(100)');
    await safeAddPgCol('event_registrations', 'refund_status', "VARCHAR(50) DEFAULT 'NONE'");
    await safeAddPgCol('event_registrations', 'email_status', "VARCHAR(50) DEFAULT 'NONE'");
    await safeAddPgCol('event_registrations', 'email_sent_at', 'VARCHAR(100)');
    await safeAddPgCol('event_registrations', 'email_error', 'TEXT');
    await safeAddPgCol('stall_bookings', 'rejection_reason', 'TEXT');
    await safeAddPgCol('stall_bookings', 'rejected_at', 'VARCHAR(100)');
    await safeAddPgCol('stall_bookings', 'refund_status', "VARCHAR(50) DEFAULT 'NONE'");
    await safeAddPgCol('stall_bookings', 'email_status', "VARCHAR(50) DEFAULT 'NONE'");
    await safeAddPgCol('stall_bookings', 'email_sent_at', 'VARCHAR(100)');
    await safeAddPgCol('stall_bookings', 'email_error', 'TEXT');
    await safeAddPgCol('payments', 'payment_screenshot', 'TEXT');
    await safeAddPgCol('event_registrations', 'payment_screenshot', 'TEXT');
    await safeAddPgCol('stall_bookings', 'payment_screenshot', 'TEXT');

    // Create Indexes after columns are verified to exist
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_pg_evt_reg_type ON event_registrations(registration_type);
        CREATE INDEX IF NOT EXISTS idx_pg_evt_reg_event ON event_registrations(event_id);
        CREATE INDEX IF NOT EXISTS idx_pg_parts_reg ON participants(registration_id);
        CREATE INDEX IF NOT EXISTS idx_pg_pay_ref ON payments(reference_id);
        CREATE INDEX IF NOT EXISTS idx_pg_pay_utr ON payments(gateway_payment_id);
        CREATE INDEX IF NOT EXISTS idx_pg_pay_usr_ref ON payments(user_reference);
      `);
    } catch {
      // Ignored
    }

    await seedInitialDataPostgres(pool);

    try {
      await pool.query("UPDATE events SET title = 'NEWSROOM EVENT' WHERE id = 'corporate-walk';");
    } catch {
      // Ignored
    }
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
        selected_day TEXT,
        booking_dates TEXT,
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

      CREATE TABLE IF NOT EXISTS incoming_bank_credits (
        id TEXT PRIMARY KEY,
        amount REAL NOT NULL,
        sender_phone TEXT,
        sender_vpa TEXT,
        bank_ref TEXT,
        payer_name TEXT,
        raw_message TEXT,
        matched_payment_id TEXT,
        matched_registration_id TEXT,
        created_at TEXT NOT NULL,
        matched_at TEXT
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
    safeAddSqCol('stall_bookings', 'selected_day', 'TEXT');
    safeAddSqCol('stall_bookings', 'booking_dates', 'TEXT');
    safeAddSqCol('payments', 'registration_type', "TEXT NOT NULL DEFAULT 'REAL'");
    safeAddSqCol('payments', 'verified_by', 'TEXT');
    safeAddSqCol('payments', 'verified_at', 'TEXT');
    safeAddSqCol('payments', 'rejection_reason', 'TEXT');
    safeAddSqCol('payments', 'user_reference', 'TEXT');
    safeAddSqCol('payments', 'provider_reference', 'TEXT');
    safeAddSqCol('payments', 'verified_amount', 'REAL');
    safeAddSqCol('payments', 'review_notes', 'TEXT');
    safeAddSqCol('payments', 'verification_method', 'TEXT');
    safeAddSqCol('enquiries', 'phone', 'TEXT');
    safeAddSqCol('enquiries', 'email_status', "TEXT NOT NULL DEFAULT 'pending'");
    safeAddSqCol('enquiries', 'email_dispatched', 'INTEGER NOT NULL DEFAULT 0');
    safeAddSqCol('enquiries', 'email_error', 'TEXT');
    safeAddSqCol('payments', 'refund_status', "TEXT NOT NULL DEFAULT 'NONE'");
    safeAddSqCol('payments', 'refund_amount', 'REAL NOT NULL DEFAULT 0');
    safeAddSqCol('payments', 'refund_ref', 'TEXT');
    safeAddSqCol('payments', 'refunded_at', 'TEXT');
    safeAddSqCol('payments', 'rejected_at', 'TEXT');
    safeAddSqCol('payments', 'email_status', "TEXT NOT NULL DEFAULT 'NONE'");
    safeAddSqCol('payments', 'email_sent_at', 'TEXT');
    safeAddSqCol('payments', 'email_error', 'TEXT');
    safeAddSqCol('event_registrations', 'rejection_reason', 'TEXT');
    safeAddSqCol('event_registrations', 'rejected_at', 'TEXT');
    safeAddSqCol('event_registrations', 'refund_status', "TEXT NOT NULL DEFAULT 'NONE'");
    safeAddSqCol('event_registrations', 'email_status', "TEXT NOT NULL DEFAULT 'NONE'");
    safeAddSqCol('event_registrations', 'email_sent_at', 'TEXT');
    safeAddSqCol('event_registrations', 'email_error', 'TEXT');
    safeAddSqCol('stall_bookings', 'rejection_reason', 'TEXT');
    safeAddSqCol('stall_bookings', 'rejected_at', 'TEXT');
    safeAddSqCol('stall_bookings', 'refund_status', "TEXT NOT NULL DEFAULT 'NONE'");
    safeAddSqCol('stall_bookings', 'email_status', "TEXT NOT NULL DEFAULT 'NONE'");
    safeAddSqCol('stall_bookings', 'email_sent_at', 'TEXT');
    safeAddSqCol('stall_bookings', 'email_error', 'TEXT');
    safeAddSqCol('payments', 'payment_screenshot', 'TEXT');
    safeAddSqCol('event_registrations', 'payment_screenshot', 'TEXT');
    safeAddSqCol('stall_bookings', 'payment_screenshot', 'TEXT');

    // Create Indexes after columns are verified to exist
    try {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sq_evt_reg_type ON event_registrations(registration_type);
        CREATE INDEX IF NOT EXISTS idx_sq_evt_reg_event ON event_registrations(event_id);
        CREATE INDEX IF NOT EXISTS idx_sq_parts_reg ON participants(registration_id);
        CREATE INDEX IF NOT EXISTS idx_sq_pay_ref ON payments(reference_id);
        CREATE INDEX IF NOT EXISTS idx_sq_pay_utr ON payments(gateway_payment_id);
        CREATE INDEX IF NOT EXISTS idx_sq_pay_usr_ref ON payments(user_reference);
      `);
    } catch {
      // Ignored
    }

    // Synchronize default event dates & normalize applicant types
    try {
      db.prepare("INSERT OR IGNORE INTO site_settings (key, value) VALUES ('event_day1_date', 'November 12, 2026')").run();
      db.prepare("INSERT OR IGNORE INTO site_settings (key, value) VALUES ('event_day2_date', 'November 13, 2026')").run();
      db.exec("UPDATE stall_bookings SET applicant_type = 'outsider' WHERE applicant_type IN ('vendor', 'OUTSIDE_VENDOR', 'outsider') OR stall_category = 'OUTSIDE_VENDOR';");
      db.exec("UPDATE events SET min_participants = 1, max_participants = 1 WHERE id = 'best-cfo';");
      db.exec("UPDATE events SET title = 'NEWSROOM EVENT' WHERE id = 'corporate-walk';");
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
    title: 'NEWSROOM EVENT',
    category: 'Financial Journalism, Crisis Broadcasting & Media Analysis',
    description: 'Enter the live newsroom floor under breaking news pressure. Teams will analyze breaking financial developments, conduct live investigative reporting, and manage crisis communications under real-world constraints — with editorial leaderboards shifting every round.',
    rules: JSON.stringify([
      'Teams must consist of exactly 2 participants.',
      'Round 1: Breaking Financial Story Analysis — Interpret real-time market data, uncover key angles, and pitch headlines within a strict deadline.',
      'Round 2: Live Crisis Broadcast Simulation — Deliver a breaking news televised broadcast responding to market volatility and corporate fraud revelations.',
      'Round 3: Press Conference & Editorial Defense — Justify your news coverage and editorial ethics before the senior judging panel.',
      'Judges will evaluate based on investigative depth, communication poise, fact accuracy, and real-time news judgment.'
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
      'Individual candidate competition for aspiring financial officers.',
      'Round 1: Financial Statement Forensics & Liquidity Crisis Simulation.',
      'Round 2: Capital Budgeting & M&A Valuation Defense.',
      'Round 3: Press Conference & Hostile Takeover Crisis Management.',
      'Calculators and standard financial modeling spreadsheets provided.',
      'Evaluations will heavily weigh strategic rationale, capital efficiency, and presentation poise.'
    ]),
    min: 1,
    max: 1,
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
    event_day1_date: 'November 12, 2026',
    event_day2_date: 'November 13, 2026',
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
    event_day1_date: 'November 12, 2026',
    event_day2_date: 'November 13, 2026',
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

async function generateRegistrationId(isTest: boolean, eventId?: string): Promise<string> {
  const eventCode = getEventKeyIdentifier(eventId);
  const prefix = isTest ? `FIN-TEST-${eventCode}` : `FIN-2026-${eventCode}`;
  const row = await queryOne<{ total: string | number }>(
    eventId
      ? 'SELECT COUNT(*) as total FROM event_registrations WHERE registration_type = ? AND event_id = ?'
      : 'SELECT COUNT(*) as total FROM event_registrations WHERE registration_type = ?',
    eventId ? [isTest ? 'TEST' : 'REAL', eventId] : [isTest ? 'TEST' : 'REAL']
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
  paymentScreenshot?: string;
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
    applicantType: 'student' | 'vendor' | 'outsider';
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
    selectedDay?: string;
    bookingDates?: string;
  };
}

export interface CreatePaymentOrderParams {
  referenceType: 'event' | 'stall';
  registrationId?: string;
  isTest?: boolean;
  eventData?: {
    eventId: string;
    collegeName?: string;
    collegeLocation?: string;
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
    applicantType: 'student' | 'vendor' | 'outsider';
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
    selectedDay?: string;
    bookingDates?: string;
  };
}

export interface PaymentOrderResult {
  success: boolean;
  registrationId: string;
  paymentId: string;
  referenceType: 'event' | 'stall';
  amount: number;
  currency: string;
  status: 'PENDING' | 'REVIEW_REQUIRED' | 'PAID';
  upiUrl: string;
  qrImageUrl: string;
  merchantVpa: string;
  merchantName: string;
  itemTitle: string;
  provider: 'DIRECT_UPI' | 'RAZORPAY';
  isGatewayAvailable: boolean;
}

export async function createPaymentOrder(params: CreatePaymentOrderParams): Promise<PaymentOrderResult> {
  await ensureSchema();
  const isTest = Boolean(params.isTest);
  const regType: 'REAL' | 'TEST' = isTest ? 'TEST' : 'REAL';
  const now = new Date().toISOString();
  const gatewayInfo = getPaymentGatewayInfo();

  if (params.referenceType === 'event') {
    if (!params.eventData) throw new Error('Missing event registration data');
    const { eventId, collegeName, collegeLocation, teamName, leaderName, leaderEmail, leaderPhone, participants } = params.eventData;

    const event = await getEventBySlug(eventId);
    if (!event) throw new Error(`Competition not found: ${eventId}`);

    const participantCount = participants?.length || 0;
    if (participantCount < event.min_participants || participantCount > event.max_participants) {
      throw new Error(`Participant limit error: ${event.title} requires between ${event.min_participants} and ${event.max_participants} participant(s). Provided: ${participantCount}.`);
    }

    // MANDATORY BACKEND ENFORCEMENT: ₹50 PER PARTICIPANT
    const calculatedFee = 50 * participantCount;

    const eventCode = getEventKeyIdentifier(eventId);
    const hasEventCode = params.registrationId && params.registrationId.includes(`-${eventCode}-`);
    const regId = params.registrationId && params.registrationId.startsWith('FIN-') && !params.registrationId.startsWith('FIN-EVT-') && hasEventCode
      ? params.registrationId
      : await generateRegistrationId(isTest, eventId);

    const payId = `PAY-${regId}-${Date.now().toString().slice(-6)}`;
    const orderRef = `ORD-${regId}`;

    // Check if registration already exists in SQL
    const existingReg = await queryOne<EventRegistrationRecord>(
      'SELECT id, payment_status FROM event_registrations WHERE id = ?',
      [regId]
    );

    if (!existingReg) {
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
        collegeName?.trim() || 'Bishop Heber College',
        collegeLocation?.trim() || 'Tiruchirappalli',
        teamName?.trim() || null,
        leaderName.trim(),
        leaderEmail.trim().toLowerCase(),
        leaderPhone.trim(),
        participantCount,
        calculatedFee,
        regType,
        now,
        now
      ]);

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
    }

    // Pre-insert pending payment record if not exists
    const existingPay = await queryOne<PaymentRecord>(
      'SELECT id, status, amount FROM payments WHERE reference_id = ?',
      [regId]
    );

    let activePaymentId = payId;
    let paymentStatus: 'PENDING' | 'REVIEW_REQUIRED' | 'PAID' = 'PENDING';

    if (!existingPay) {
      await execute(`
        INSERT INTO payments (
          id, reference_type, reference_id, gateway_order_id, amount,
          currency, status, payer_email, payer_phone, payment_method,
          idempotency_key, registration_type, created_at, verification_method
        ) VALUES (?, 'event', ?, ?, ?, 'INR', 'pending', ?, ?, 'UPI', ?, ?, ?, ?)
      `, [
        payId,
        regId,
        orderRef,
        calculatedFee,
        leaderEmail.trim().toLowerCase(),
        leaderPhone.trim(),
        payId,
        regType,
        now,
        gatewayInfo.isConfigured ? 'GATEWAY' : 'DIRECT_UPI_REVIEW'
      ]);
    } else {
      activePaymentId = existingPay.id;
      paymentStatus = normalizePaymentStatus(existingPay.status) as any;
    }

    const upiUrl = buildDynamicUpiUrl({
      amount: calculatedFee,
      referenceId: orderRef
    });
    const qrImageUrl = buildQrCodeImageUrl(upiUrl);

    return {
      success: true,
      registrationId: regId,
      paymentId: activePaymentId,
      referenceType: 'event',
      amount: calculatedFee,
      currency: 'INR',
      status: paymentStatus,
      upiUrl,
      qrImageUrl,
      merchantVpa: DIRECT_UPI_CONFIG.vpa,
      merchantName: DIRECT_UPI_CONFIG.payeeName,
      itemTitle: event.title,
      provider: gatewayInfo.provider,
      isGatewayAvailable: gatewayInfo.isConfigured
    };
  } else {
    // STALL ORDER CREATION
    if (!params.stallData) throw new Error('Missing stall booking data');
    const {
      optionId,
      applicantType,
      entityName,
      collegeName,
      departmentClass,
      contactName,
      contactEmail,
      contactPhone,
      businessDetails,
      productsServices,
      stallsRequested,
      durationDays,
      selectedDay,
      bookingDates
    } = params.stallData;

    const opt = await queryOne<StallOptionRecord>('SELECT * FROM stall_options WHERE id = ?', [optionId]);
    if (!opt) throw new Error('Stall option not found');

    const settings = await getSiteSettings();
    const day1Date = settings.event_day1_date || 'November 12, 2026';
    const day2Date = settings.event_day2_date || 'November 13, 2026';

    const validDays = (durationDays === 2) ? 2 : 1;
    const validStalls = Math.max(1, Math.min(10, Number(stallsRequested) || 1));
    const totalAmount = opt.price * validStalls * validDays;
    const cleanApplicantType = (opt.category === 'OUTSIDE_VENDOR' || applicantType === 'outsider' || applicantType === 'vendor') ? 'outsider' : 'student';

    let cleanSelectedDay = selectedDay;
    let cleanBookingDates = bookingDates;
    if (validDays === 2) {
      cleanSelectedDay = 'Both Days (Day 1 & Day 2)';
      cleanBookingDates = `${day1Date} & ${day2Date}`;
    } else {
      if (cleanSelectedDay === 'Day 2' || cleanSelectedDay?.includes('Day 2')) {
        cleanSelectedDay = 'Day 2';
        cleanBookingDates = day2Date;
      } else {
        cleanSelectedDay = 'Day 1';
        cleanBookingDates = day1Date;
      }
    }

    const bookingId = params.registrationId && params.registrationId.startsWith('FIN-')
      ? params.registrationId
      : await generateStallBookingId(isTest);

    const payId = `PAY-${bookingId}-${Date.now().toString().slice(-6)}`;
    const orderRef = `ORD-${bookingId}`;

    const existingBooking = await queryOne<StallBookingRecord>(
      'SELECT id, payment_status, status FROM stall_bookings WHERE id = ?',
      [bookingId]
    );

    if (!existingBooking) {
      await execute(`
        INSERT INTO stall_bookings (
          id, option_id, stall_category, applicant_type, entity_name, college_name,
          department_class, contact_name, contact_email, contact_phone, business_details,
          products_services, stalls_requested, duration_days, selected_day, booking_dates,
          has_electricity, total_amount, payment_status,
          status, registration_type, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?)
      `, [
        bookingId,
        opt.id,
        opt.category,
        cleanApplicantType,
        entityName.trim(),
        collegeName?.trim() || null,
        departmentClass?.trim() || null,
        contactName.trim(),
        contactEmail.trim().toLowerCase(),
        contactPhone.trim(),
        businessDetails?.trim() || null,
        productsServices.trim(),
        validStalls,
        validDays,
        cleanSelectedDay,
        cleanBookingDates,
        opt.has_electricity,
        totalAmount,
        regType,
        now,
        now
      ]);
    }

    const existingPay = await queryOne<PaymentRecord>(
      'SELECT id, status FROM payments WHERE reference_id = ?',
      [bookingId]
    );

    let activePaymentId = payId;
    let paymentStatus: 'PENDING' | 'REVIEW_REQUIRED' | 'PAID' = 'PENDING';

    if (!existingPay) {
      await execute(`
        INSERT INTO payments (
          id, reference_type, reference_id, gateway_order_id, amount,
          currency, status, payer_email, payer_phone, payment_method,
          idempotency_key, registration_type, created_at, verification_method
        ) VALUES (?, 'stall', ?, ?, ?, 'INR', 'pending', ?, ?, 'UPI', ?, ?, ?, ?)
      `, [
        payId,
        bookingId,
        orderRef,
        totalAmount,
        contactEmail.trim().toLowerCase(),
        contactPhone.trim(),
        payId,
        regType,
        now,
        gatewayInfo.isConfigured ? 'GATEWAY' : 'DIRECT_UPI_REVIEW'
      ]);
    } else {
      activePaymentId = existingPay.id;
      paymentStatus = normalizePaymentStatus(existingPay.status) as any;
    }

    const upiUrl = buildDynamicUpiUrl({
      amount: totalAmount,
      referenceId: orderRef
    });
    const qrImageUrl = buildQrCodeImageUrl(upiUrl);

    return {
      success: true,
      registrationId: bookingId,
      paymentId: activePaymentId,
      referenceType: 'stall',
      amount: totalAmount,
      currency: 'INR',
      status: paymentStatus,
      upiUrl,
      qrImageUrl,
      merchantVpa: DIRECT_UPI_CONFIG.vpa,
      merchantName: DIRECT_UPI_CONFIG.payeeName,
      itemTitle: opt.name,
      provider: gatewayInfo.provider,
      isGatewayAvailable: gatewayInfo.isConfigured
    };
  }
}

export async function submitPaymentUtr(payload: {
  paymentId?: string;
  registrationId: string;
  referenceType?: 'event' | 'stall';
  utrNumber: string;
  paymentScreenshot?: string;
  isTest?: boolean;
}): Promise<{
  success: boolean;
  registrationId: string;
  paymentId: string;
  status: 'Pending upon submission' | 'REVIEW_REQUIRED';
  amount: number;
  utrNumber: string;
  message: string;
  redirectUrl: string;
}> {
  await ensureSchema();
  const cleanUtr = String(payload.utrNumber || '').trim().replace(/\s/g, '');
  if (!cleanUtr || cleanUtr.length < 6) {
    throw new Error('Invalid UPI Reference / UTR Number. Must be at least 6 digits/characters from your payment receipt.');
  }

  const isTest = Boolean(payload.isTest);
  const now = new Date().toISOString();
  const screenshot = payload.paymentScreenshot?.trim() || null;

  // Prevent duplicate UTR submissions for REAL registrations
  if (!isTest) {
    const existingTx = await queryOne<PaymentRecord>(
      `SELECT id, reference_id FROM payments 
       WHERE (gateway_payment_id = ? OR user_reference = ?) 
         AND registration_type = 'REAL' 
         AND reference_id != ?`,
      [cleanUtr, cleanUtr, payload.registrationId]
    );
    if (existingTx) {
      throw new Error(`This UPI Reference / UTR Number (${cleanUtr}) has already been submitted for registration ${existingTx.reference_id}. Duplicate payment claims are not permitted.`);
    }
  }

  // Find payment record
  let pay = await queryOne<PaymentRecord>(
    'SELECT * FROM payments WHERE reference_id = ? OR id = ?',
    [payload.registrationId, payload.paymentId || '']
  );

  if (!pay) {
    // Check registration records to create payment entry if missing
    const evt = await queryOne<EventRegistrationRecord>('SELECT * FROM event_registrations WHERE id = ?', [payload.registrationId]);
    if (evt) {
      const payId = `PAY-${evt.id}-${Date.now().toString().slice(-6)}`;
      await execute(`
        INSERT INTO payments (
          id, reference_type, reference_id, gateway_order_id, gateway_payment_id,
          amount, currency, status, payer_email, payer_phone, payment_method,
          user_reference, registration_type, created_at, verification_method, payment_screenshot
        ) VALUES (?, 'event', ?, ?, ?, ?, 'INR', 'Pending upon submission', ?, ?, 'UPI - GPay', ?, ?, ?, 'DIRECT_UPI_REVIEW', ?)
      `, [
        payId,
        evt.id,
        `ORD-${evt.id}`,
        cleanUtr,
        evt.total_fee,
        evt.leader_email,
        evt.leader_phone,
        cleanUtr,
        evt.registration_type,
        now,
        screenshot
      ]);
      pay = await queryOne<PaymentRecord>('SELECT * FROM payments WHERE id = ?', [payId]);
    } else {
      const stl = await queryOne<StallBookingRecord>('SELECT * FROM stall_bookings WHERE id = ?', [payload.registrationId]);
      if (stl) {
        const payId = `PAY-${stl.id}-${Date.now().toString().slice(-6)}`;
        await execute(`
          INSERT INTO payments (
            id, reference_type, reference_id, gateway_order_id, gateway_payment_id,
            amount, currency, status, payer_email, payer_phone, payment_method,
            user_reference, registration_type, created_at, verification_method, payment_screenshot
          ) VALUES (?, 'stall', ?, ?, ?, ?, 'INR', 'Pending upon submission', ?, ?, 'UPI - GPay', ?, ?, ?, 'DIRECT_UPI_REVIEW', ?)
        `, [
          payId,
          stl.id,
          `ORD-${stl.id}`,
          cleanUtr,
          stl.total_amount,
          stl.contact_email,
          stl.contact_phone,
          cleanUtr,
          stl.registration_type,
          now,
          screenshot
        ]);
        pay = await queryOne<PaymentRecord>('SELECT * FROM payments WHERE id = ?', [payId]);
      }
    }
  }

  if (!pay) {
    throw new Error(`Registration record not found for ID: ${payload.registrationId}`);
  }

  // Update payment status to Pending upon submission with screenshot
  await execute(`
    UPDATE payments SET
      gateway_payment_id = ?,
      user_reference = ?,
      payment_screenshot = COALESCE(?, payment_screenshot),
      status = 'Pending upon submission',
      verification_method = 'DIRECT_UPI_REVIEW'
    WHERE id = ?
  `, [cleanUtr, cleanUtr, screenshot, pay.id]);

  // Update registration record
  if (pay.reference_type === 'event') {
    await execute(`
      UPDATE event_registrations SET
        payment_status = 'Pending upon submission',
        transaction_id = ?,
        payment_screenshot = COALESCE(?, payment_screenshot),
        updated_at = ?
      WHERE id = ?
    `, [cleanUtr, screenshot, now, pay.reference_id]);
  } else {
    await execute(`
      UPDATE stall_bookings SET
        payment_status = 'Pending upon submission',
        transaction_id = ?,
        payment_screenshot = COALESCE(?, payment_screenshot),
        updated_at = ?
      WHERE id = ?
    `, [cleanUtr, screenshot, now, pay.reference_id]);
  }

  await logAuditEvent(
    'CLIENT_UPI_SUBMISSION',
    'UTR_SUBMITTED_FOR_REVIEW',
    'PAYMENT',
    pay.id,
    `Direct UPI UTR (${cleanUtr}) submitted for registration ${pay.reference_id}. Awaiting manual reconciliation by festival staff.`
  );

  return {
    success: true,
    registrationId: pay.reference_id,
    paymentId: pay.id,
    status: 'REVIEW_REQUIRED',
    amount: pay.amount,
    utrNumber: cleanUtr,
    message: 'Payment submitted for verification. Your registration will be confirmed after payment verification.',
    redirectUrl: `/confirmation/${pay.reference_id}`
  };
}

export async function getPaymentStatus(queryId: string): Promise<{
  success: boolean;
  found: boolean;
  status: 'PENDING' | 'VERIFYING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REVIEW_REQUIRED' | 'REFUNDED';
  rawStatus: string;
  isVerified: boolean;
  registrationId: string;
  paymentId?: string;
  amount: number;
  utrNumber?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
  message: string;
  itemTitle?: string;
  referenceType?: 'event' | 'stall';
}> {
  await ensureSchema();
  const trimmed = queryId.trim();

  const pay = await queryOne<PaymentRecord>(
    `SELECT * FROM payments 
     WHERE id = ? OR reference_id = ? OR gateway_payment_id = ? OR user_reference = ?
     ORDER BY created_at DESC`,
    [trimmed, trimmed, trimmed, trimmed]
  );

  if (pay) {
    const norm = normalizePaymentStatus(pay.status);
    let msg = 'Payment has not been confirmed.';
    if (norm === 'PAID') {
      msg = 'Payment authoritatively verified — Registration confirmed!';
    } else if (norm === 'REVIEW_REQUIRED') {
      msg = 'Payment submitted for verification. Your registration will be confirmed after payment verification.';
    } else if (norm === 'VERIFYING') {
      msg = 'Verification in progress with payment provider.';
    } else if (norm === 'FAILED') {
      msg = pay.rejection_reason ? `Payment rejected: ${pay.rejection_reason}` : 'Payment failed or was rejected.';
    }

    return {
      success: true,
      found: true,
      status: norm,
      rawStatus: pay.status,
      isVerified: norm === 'PAID',
      registrationId: pay.reference_id,
      paymentId: pay.id,
      amount: Number(pay.amount || 0),
      utrNumber: pay.gateway_payment_id || pay.user_reference || undefined,
      verifiedAt: pay.verified_at || undefined,
      verifiedBy: pay.verified_by || undefined,
      rejectionReason: pay.rejection_reason || undefined,
      message: msg,
      referenceType: pay.reference_type
    };
  }

  // Fallback: check event_registrations directly
  const evt = await queryOne<EventRegistrationRecord>('SELECT * FROM event_registrations WHERE id = ?', [trimmed]);
  if (evt) {
    const norm = normalizePaymentStatus(evt.payment_status);
    return {
      success: true,
      found: true,
      status: norm,
      rawStatus: evt.payment_status,
      isVerified: norm === 'PAID',
      registrationId: evt.id,
      amount: Number(evt.total_fee || 0),
      utrNumber: evt.transaction_id || undefined,
      message: norm === 'PAID'
        ? 'Payment verified — Registration confirmed!'
        : norm === 'REVIEW_REQUIRED'
        ? 'Payment submitted for verification. Your registration will be confirmed after payment verification.'
        : 'Payment pending.',
      referenceType: 'event'
    };
  }

  // Fallback: check stall_bookings directly
  const stl = await queryOne<StallBookingRecord>('SELECT * FROM stall_bookings WHERE id = ?', [trimmed]);
  if (stl) {
    const norm = normalizePaymentStatus(stl.payment_status || stl.status);
    return {
      success: true,
      found: true,
      status: norm,
      rawStatus: stl.payment_status || stl.status,
      isVerified: norm === 'PAID',
      registrationId: stl.id,
      amount: Number(stl.total_amount || 0),
      utrNumber: stl.transaction_id || undefined,
      message: norm === 'PAID'
        ? 'Payment verified — Stall booking confirmed!'
        : norm === 'REVIEW_REQUIRED'
        ? 'Payment submitted for verification. Your booking will be confirmed after payment verification.'
        : 'Payment pending.',
      referenceType: 'stall'
    };
  }

  return {
    success: false,
    found: false,
    status: 'PENDING',
    rawStatus: 'not_found',
    isVerified: false,
    registrationId: trimmed,
    amount: 0,
    message: 'Registration reference not found in the database.'
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

  const cleanUtr = String(payload.utrNumber || '').trim().replace(/\s/g, '');
  if (!cleanUtr || cleanUtr.length < 6) {
    throw new Error('Invalid UPI Reference / UTR Number. Must be at least 6 digits/characters from your payment receipt.');
  }

  // Prevent duplicate transaction references for REAL registrations
  const isTest = Boolean(payload.isTest);
  const regType: 'REAL' | 'TEST' = isTest ? 'TEST' : 'REAL';

  if (!isTest) {
    const existingTx = await queryOne<PaymentRecord>(
      `SELECT id, reference_id FROM payments 
       WHERE (gateway_payment_id = ? OR user_reference = ?) 
         AND registration_type = 'REAL' 
         AND reference_id != ?`,
      [cleanUtr, cleanUtr, payload.registrationId || '']
    );
    if (existingTx) {
      throw new Error(`This UPI Reference / UTR Number (${cleanUtr}) has already been submitted for registration ${existingTx.reference_id}. Duplicate payment claims are not permitted.`);
    }
  }

  const now = new Date().toISOString();
  const screenshot = payload.paymentScreenshot?.trim() || null;
  const paymentStatus = 'Pending upon submission';

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

    const eventCode = getEventKeyIdentifier(eventId);
    const hasEventCode = payload.registrationId && payload.registrationId.includes(`-${eventCode}-`);
    const regId = payload.registrationId && payload.registrationId.startsWith('FIN-') && !payload.registrationId.startsWith('FIN-EVT-') && hasEventCode
      ? payload.registrationId
      : await generateRegistrationId(isTest, eventId);

    const payId = payload.paymentId || `PAY-${regId}-${Date.now().toString().slice(-6)}`;
    const regStatus = 'registered';

    // Insert or update registration
    const existingReg = await queryOne('SELECT id FROM event_registrations WHERE id = ?', [regId]);
    if (existingReg) {
      await execute(`
        UPDATE event_registrations SET
          payment_status = 'Pending upon submission',
          transaction_id = ?,
          payment_screenshot = COALESCE(?, payment_screenshot),
          updated_at = ?
        WHERE id = ?
      `, [cleanUtr, screenshot, now, regId]);
    } else {
      await execute(`
        INSERT INTO event_registrations (
          id, event_id, college_name, college_location, team_name,
          leader_name, leader_email, leader_phone, participant_count,
          total_fee, payment_status, registration_status, registration_type,
          transaction_id, payment_screenshot, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        regId,
        event.id,
        collegeName?.trim() || 'Bishop Heber College',
        collegeLocation?.trim() || 'Tiruchirappalli',
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
        screenshot,
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
    }

    // Insert or update payment record
    const existingPay = await queryOne<PaymentRecord>('SELECT id FROM payments WHERE reference_id = ? OR id = ?', [regId, payId]);
    if (existingPay) {
      await execute(`
        UPDATE payments SET
          gateway_payment_id = ?,
          user_reference = ?,
          payment_screenshot = COALESCE(?, payment_screenshot),
          status = 'Pending upon submission',
          verification_method = 'DIRECT_UPI_REVIEW'
        WHERE id = ?
      `, [cleanUtr, cleanUtr, screenshot, existingPay.id]);
    } else {
      await execute(`
        INSERT INTO payments (
          id, reference_type, reference_id, gateway_order_id, gateway_payment_id,
          gateway_signature, amount, currency, status, payer_email, payer_phone,
          payment_method, idempotency_key, registration_type, created_at,
          user_reference, verification_method, payment_screenshot
        ) VALUES (?, 'event', ?, ?, ?, 'CLIENT_CONFIRMED', ?, 'INR', 'Pending upon submission', ?, ?, 'UPI - GPay', ?, ?, ?, ?, 'DIRECT_UPI_REVIEW', ?)
      `, [
        payId,
        regId,
        `ORD-${regId}`,
        cleanUtr,
        calculatedFee,
        leaderEmail.trim().toLowerCase(),
        leaderPhone.trim(),
        payId,
        regType,
        now,
        cleanUtr,
        screenshot
      ]);
    }

    await logAuditEvent(
      'CLIENT_REGISTRATION_PIPELINE',
      'EVENT_REGISTRATION_SUBMITTED',
      'EVENT',
      regId,
      JSON.stringify({
        amount: calculatedFee,
        utrNumber: cleanUtr,
        paymentStatus: 'Pending upon submission',
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
      paymentStatus: 'Pending upon submission',
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
    const {
      optionId,
      applicantType,
      entityName,
      collegeName,
      departmentClass,
      contactName,
      contactEmail,
      contactPhone,
      businessDetails,
      productsServices,
      stallsRequested,
      durationDays,
      selectedDay,
      bookingDates
    } = payload.stallData;
    const validDays = (durationDays === 2) ? 2 : 1;

    const opt = await queryOne<StallOptionRecord>('SELECT * FROM stall_options WHERE id = ?', [optionId]);
    if (!opt) throw new Error('Stall option not found');

    const totalAmount = opt.price * stallsRequested * validDays;
    if (Math.abs(totalAmount - payload.expectedAmount) > 0.01) {
      throw new Error(`Fee calculation mismatch: expected ₹${totalAmount} (₹${opt.price} × ${stallsRequested} stall(s) × ${validDays} day(s)), received ₹${payload.expectedAmount}.`);
    }

    const cleanApplicantType = (opt.category === 'OUTSIDE_VENDOR' || applicantType === 'outsider' || applicantType === 'vendor') ? 'outsider' : 'student';
    const cleanSelectedDay = validDays === 2 ? 'Both Days (Day 1 & Day 2)' : (selectedDay || 'Day 1');
    const cleanBookingDates = bookingDates || (validDays === 2 ? 'November 12 & 13, 2026' : 'November 12, 2026');

    const bookingId = payload.registrationId && payload.registrationId.startsWith('FIN-')
      ? payload.registrationId
      : await generateStallBookingId(isTest);

    const payId = payload.paymentId || `PAY-${bookingId}-${Date.now().toString().slice(-6)}`;

    const existingBooking = await queryOne('SELECT id FROM stall_bookings WHERE id = ?', [bookingId]);
    if (existingBooking) {
      await execute(`
        UPDATE stall_bookings SET
          payment_status = 'Pending upon submission',
          transaction_id = ?,
          payment_screenshot = COALESCE(?, payment_screenshot),
          applicant_type = ?,
          duration_days = ?,
          selected_day = ?,
          booking_dates = ?,
          updated_at = ?
        WHERE id = ?
      `, [cleanUtr, screenshot, cleanApplicantType, validDays, cleanSelectedDay, cleanBookingDates, now, bookingId]);
    } else {
      await execute(`
        INSERT INTO stall_bookings (
          id, option_id, stall_category, applicant_type, entity_name, college_name,
          department_class, contact_name, contact_email, contact_phone, business_details,
          products_services, stalls_requested, duration_days, selected_day, booking_dates,
          has_electricity, total_amount, payment_status,
          status, registration_type, transaction_id, payment_screenshot, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending upon submission', 'pending', ?, ?, ?, ?, ?)
      `, [
        bookingId,
        opt.id,
        opt.category,
        cleanApplicantType,
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
        cleanSelectedDay,
        cleanBookingDates,
        opt.has_electricity,
        totalAmount,
        regType,
        cleanUtr,
        screenshot,
        now,
        now
      ]);
    }

    const existingPay = await queryOne<PaymentRecord>('SELECT id FROM payments WHERE reference_id = ? OR id = ?', [bookingId, payId]);
    if (existingPay) {
      await execute(`
        UPDATE payments SET
          gateway_payment_id = ?,
          user_reference = ?,
          payment_screenshot = COALESCE(?, payment_screenshot),
          status = 'Pending upon submission',
          verification_method = 'DIRECT_UPI_REVIEW'
        WHERE id = ?
      `, [cleanUtr, cleanUtr, screenshot, existingPay.id]);
    } else {
      await execute(`
        INSERT INTO payments (
          id, reference_type, reference_id, gateway_order_id, gateway_payment_id,
          gateway_signature, amount, currency, status, payer_email, payer_phone,
          payment_method, idempotency_key, registration_type, created_at,
          user_reference, verification_method, payment_screenshot
        ) VALUES (?, 'stall', ?, ?, ?, 'CLIENT_CONFIRMED', ?, 'INR', 'Pending upon submission', ?, ?, 'UPI - GPay', ?, ?, ?, ?, 'DIRECT_UPI_REVIEW', ?)
      `, [
        payId,
        bookingId,
        `ORD-${bookingId}`,
        cleanUtr,
        totalAmount,
        contactEmail.trim().toLowerCase(),
        contactPhone.trim(),
        payId,
        regType,
        now,
        cleanUtr,
        screenshot
      ]);
    }

    await logAuditEvent(
      'CLIENT_REGISTRATION_PIPELINE',
      'STALL_BOOKING_SUBMITTED',
      'STALL',
      bookingId,
      JSON.stringify({
        amount: totalAmount,
        utrNumber: cleanUtr,
        category: opt.name,
        paymentStatus: 'Pending upon submission',
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
      paymentStatus: 'Pending upon submission',
      ticketDetails: {
        categoryName: opt.name,
        entityName,
        contactName,
        contactEmail,
        contactPhone,
        stallsRequested,
        durationDays: validDays,
        selectedDay: cleanSelectedDay,
        bookingDates: cleanBookingDates,
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
  const regId = await generateRegistrationId(isTest, data.eventId);
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
    data.collegeName?.trim() || 'Bishop Heber College',
    data.collegeLocation?.trim() || 'Tiruchirappalli',
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
  const reg = await queryOne<EventRegistrationRecord>(
    'SELECT * FROM event_registrations WHERE id = ? OR UPPER(id) = UPPER(?)',
    [id, id]
  );
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

export async function deletePayment(
  paymentId: string,
  adminUsername: string
): Promise<{ success: boolean; message: string; deletedId: string; amount: number; referenceId: string }> {
  await ensureSchema();
  const pay = await queryOne<PaymentRecord>('SELECT * FROM payments WHERE id = ?', [paymentId]);
  if (!pay) {
    throw new Error(`Payment record "${paymentId}" not found.`);
  }

  // Delete payment record from central SQL database
  await execute('DELETE FROM payments WHERE id = ?', [paymentId]);

  // If this payment was tied to an event or stall registration, clean up status if no other payments exist
  if (pay.reference_type === 'event') {
    const remaining = await query<PaymentRecord>('SELECT * FROM payments WHERE reference_id = ?', [pay.reference_id]);
    if (remaining.length === 0) {
      await execute("UPDATE event_registrations SET transaction_id = NULL, payment_status = 'pending', registration_status = 'pending' WHERE id = ?", [pay.reference_id]);
    }
  } else if (pay.reference_type === 'stall') {
    const remaining = await query<PaymentRecord>('SELECT * FROM payments WHERE reference_id = ?', [pay.reference_id]);
    if (remaining.length === 0) {
      await execute("UPDATE stall_bookings SET transaction_id = NULL, payment_status = 'pending', status = 'pending' WHERE id = ?", [pay.reference_id]);
    }
  }

  await logAuditEvent(
    adminUsername,
    'DELETE_PAYMENT',
    'PAYMENT',
    paymentId,
    `Deleted payment ${paymentId} (₹${pay.amount}, Type: ${pay.registration_type}, Status: ${pay.status}, Ref: ${pay.reference_id})`
  );

  return {
    success: true,
    message: `Payment ${paymentId} (₹${pay.amount}) was deleted successfully and removed from revenue calculations.`,
    deletedId: paymentId,
    amount: Number(pay.amount || 0),
    referenceId: pay.reference_id
  };
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
  selectedDay?: string;
  bookingDates?: string;
  isTest?: boolean;
}): Promise<{ bookingId: string; totalAmount: number; stallOption: StallOptionRecord }> {
  const opt = await queryOne<StallOptionRecord>('SELECT * FROM stall_options WHERE id = ?', [data.optionId]);
  if (!opt) throw new Error('Stall option not found');

  const settings = await getSiteSettings();
  const day1Date = settings.event_day1_date || 'November 12, 2026';
  const day2Date = settings.event_day2_date || 'November 13, 2026';

  const durationDays = (data.durationDays === 2) ? 2 : 1;
  const cleanApplicantType = (opt.category === 'OUTSIDE_VENDOR' || data.applicantType === 'outsider' || data.applicantType === 'vendor') ? 'outsider' : 'student';

  let cleanSelectedDay = data.selectedDay;
  let cleanBookingDates = data.bookingDates;

  if (durationDays === 2) {
    cleanSelectedDay = 'Both Days (Day 1 & Day 2)';
    cleanBookingDates = `${day1Date} & ${day2Date}`;
  } else {
    if (cleanSelectedDay === 'Day 2' || cleanSelectedDay?.includes('Day 2')) {
      cleanSelectedDay = 'Day 2';
      cleanBookingDates = day2Date;
    } else {
      cleanSelectedDay = 'Day 1';
      cleanBookingDates = day1Date;
    }
  }
  const totalAmount = opt.price * data.stallsRequested * durationDays;
  const isTest = Boolean(data.isTest);
  const bookingId = await generateStallBookingId(isTest);
  const now = new Date().toISOString();

  await execute(`
    INSERT INTO stall_bookings (
      id, option_id, stall_category, applicant_type, entity_name, college_name,
      department_class, contact_name, contact_email, contact_phone, business_details,
      products_services, stalls_requested, duration_days, selected_day, booking_dates, has_electricity, total_amount, status,
      payment_status, registration_type, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?)
  `, [
    bookingId,
    opt.id,
    opt.category,
    cleanApplicantType,
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
    cleanSelectedDay,
    cleanBookingDates,
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
  const booking = await queryOne<StallBookingRecord>(
    'SELECT * FROM stall_bookings WHERE id = ? OR UPPER(id) = UPPER(?)',
    [id, id]
  );
  if (!booking) return null;
  const opt = await queryOne<StallOptionRecord>('SELECT name, has_electricity FROM stall_options WHERE id = ?', [booking.option_id]);
  return {
    ...booking,
    total_amount: Number(booking.total_amount || 0),
    stalls_requested: Number(booking.stalls_requested || 1),
    duration_days: Number(booking.duration_days || 1),
    selected_day: booking.selected_day || ((Number(booking.duration_days || 1) === 2) ? 'Both Days (Day 1 & Day 2)' : 'Day 1'),
    booking_dates: booking.booking_dates,
    has_electricity: booking.has_electricity ?? opt?.has_electricity ?? 0,
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
    duration_days: Number(r.duration_days || 1),
    selected_day: r.selected_day || ((Number(r.duration_days || 1) === 2) ? 'Both Days (Day 1 & Day 2)' : 'Day 1'),
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
    const norm = filter.status.toUpperCase();
    if (norm === 'REVIEW_REQUIRED' || norm === 'SUBMITTED' || norm.includes('PENDING UPON SUBMISSION')) {
      sql += " AND status IN ('REVIEW_REQUIRED', 'submitted', 'Pending upon submission', 'pending_upon_submission')";
    } else if (norm === 'PAID' || norm === 'VERIFIED') {
      sql += " AND status IN ('PAID', 'verified', 'successful')";
    } else if (norm === 'PENDING') {
      sql += " AND status IN ('PENDING', 'pending', 'Pending upon submission', 'pending_upon_submission', 'REVIEW_REQUIRED', 'submitted')";
    } else if (norm === 'FAILED' || norm === 'REJECTED') {
      sql += " AND status IN ('FAILED', 'rejected', 'failed')";
    } else if (norm === 'REFUNDED') {
      sql += " AND status IN ('refunded', 'REFUNDED')";
    } else {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
  }

  if (filter?.search) {
    sql += ' AND (id LIKE ? OR reference_id LIKE ? OR gateway_payment_id LIKE ? OR user_reference LIKE ? OR payer_email LIKE ?)';
    const term = `%${filter.search}%`;
    params.push(term, term, term, term, term);
  }

  sql += ' ORDER BY created_at DESC';
  const payments = await query<PaymentRecord>(sql, params);

  // Attach reference details for quick display
  const events = await getAllEvents();
  const eventMap = new Map(events.map(e => [e.id, e]));

  const regs = await query<{
    id: string;
    event_id: string;
    participant_count: number;
    leader_name: string;
    leader_email: string;
    leader_phone: string;
    college_name: string;
    team_name?: string;
    payment_screenshot?: string;
  }>(
    'SELECT id, event_id, participant_count, leader_name, leader_email, leader_phone, college_name, team_name, payment_screenshot FROM event_registrations'
  );
  const regMap = new Map(regs.map(r => [r.id, r]));

  const stalls = await query<{
    id: string;
    entity_name: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    college_name?: string;
    payment_screenshot?: string;
  }>(
    'SELECT id, entity_name, contact_name, contact_email, contact_phone, college_name, payment_screenshot FROM stall_bookings'
  );
  const stallMap = new Map(stalls.map(s => [s.id, s]));

  const allParts = await query<{
    registration_id: string;
    full_name: string;
    roll_number: string;
    department: string;
    year_of_study: string;
    section: string;
  }>(
    'SELECT registration_id, full_name, roll_number, department, year_of_study, section FROM participants ORDER BY participant_order ASC'
  );
  const partsByReg = new Map<string, Array<{ fullName: string; rollNumber: string; department: string; yearOfStudy: string; section: string; }>>();
  for (const part of allParts) {
    if (!partsByReg.has(part.registration_id)) {
      partsByReg.set(part.registration_id, []);
    }
    partsByReg.get(part.registration_id)!.push({
      fullName: part.full_name,
      rollNumber: part.roll_number,
      department: part.department,
      yearOfStudy: part.year_of_study,
      section: part.section
    });
  }

  return payments.map(p => {
    let itemTitle = p.reference_type === 'event' ? 'Competition Registration' : 'Festival Stall';
    let participantCount = 1;
    let screenshot = p.payment_screenshot || null;
    let leaderName = null;
    let leaderEmail = p.payer_email || null;
    let leaderPhone = p.payer_phone || null;
    let collegeName = null;
    let teamName = null;
    let participantsList: Array<{ fullName: string; rollNumber: string; department: string; yearOfStudy: string; section: string; }> = [];

    if (p.reference_type === 'event') {
      const reg = regMap.get(p.reference_id);
      if (reg) {
        participantCount = reg.participant_count;
        leaderName = reg.leader_name;
        leaderEmail = reg.leader_email || leaderEmail;
        leaderPhone = reg.leader_phone || leaderPhone;
        collegeName = reg.college_name;
        teamName = reg.team_name || null;
        if (!screenshot && reg.payment_screenshot) screenshot = reg.payment_screenshot;
        const ev = eventMap.get(reg.event_id);
        if (ev) itemTitle = ev.title;
        participantsList = partsByReg.get(reg.id) || [];
      }
    } else {
      const stl = stallMap.get(p.reference_id);
      if (stl) {
        leaderName = stl.contact_name;
        leaderEmail = stl.contact_email || leaderEmail;
        leaderPhone = stl.contact_phone || leaderPhone;
        collegeName = stl.college_name || null;
        teamName = stl.entity_name || null;
        if (!screenshot && stl.payment_screenshot) screenshot = stl.payment_screenshot;
        itemTitle = `Stall: ${stl.entity_name}`;
      }
    }

    return {
      ...p,
      item_title: itemTitle,
      participant_count: participantCount,
      payment_screenshot: screenshot,
      leader_name: leaderName,
      leader_email: leaderEmail,
      leader_phone: leaderPhone,
      college_name: collegeName,
      team_name: teamName,
      participants_list: participantsList
    };
  });
}

export async function verifyPayment(paymentId: string, adminUsername: string, notes?: string): Promise<boolean> {
  const pay = await queryOne<PaymentRecord>('SELECT * FROM payments WHERE id = ?', [paymentId]);
  if (!pay) throw new Error('Payment not found');

  const now = new Date().toISOString();
  await execute(`
    UPDATE payments SET
      status = 'PAID',
      verified_at = ?,
      verified_by = ?,
      verified_amount = ?,
      review_notes = ?
    WHERE id = ?
  `, [now, adminUsername, pay.amount, notes || 'Verified by admin against bank records', paymentId]);

  let recipientEmail = pay.payer_email || '';
  let recipientName = 'Participant';
  let itemTitle = pay.reference_type === 'event' ? 'Competition Registration' : 'Festival Stall';
  let collegeName = '';
  let participantCount = 1;

  // Update associated registration
  if (pay.reference_type === 'event') {
    await execute(`
      UPDATE event_registrations SET
        payment_status = 'PAID', registration_status = 'confirmed', updated_at = ?
      WHERE id = ?
    `, [now, pay.reference_id]);

    const reg = await queryOne<EventRegistrationRecord>('SELECT * FROM event_registrations WHERE id = ?', [pay.reference_id]);
    if (reg) {
      recipientEmail = reg.leader_email || recipientEmail;
      recipientName = reg.leader_name || recipientName;
      collegeName = reg.college_name || '';
      participantCount = reg.participant_count || 1;
      const ev = await queryOne<{ title: string }>('SELECT title FROM events WHERE id = ?', [reg.event_id]);
      if (ev) itemTitle = ev.title;
    }
  } else {
    await execute(`
      UPDATE stall_bookings SET
        payment_status = 'PAID', status = 'approved', updated_at = ?
      WHERE id = ?
    `, [now, pay.reference_id]);

    const stl = await queryOne<StallBookingRecord>('SELECT * FROM stall_bookings WHERE id = ?', [pay.reference_id]);
    if (stl) {
      recipientEmail = stl.contact_email || recipientEmail;
      recipientName = stl.contact_name || recipientName;
      collegeName = stl.college_name || '';
      itemTitle = `Festival Stall (${stl.entity_name || 'Exhibitor'})`;
    }
  }

  // Trigger confirmation email to participant's registered email address
  if (recipientEmail) {
    try {
      await sendPaymentVerifiedConfirmationEmail({
        recipientEmail,
        recipientName,
        registrationId: pay.reference_id,
        referenceType: pay.reference_type,
        itemTitle,
        amount: Number(pay.amount || 0),
        utrNumber: pay.gateway_payment_id || pay.user_reference || 'N/A',
        collegeName,
        participantCount
      });
      await execute(`
        UPDATE payments SET email_status = 'SENT', email_sent_at = ? WHERE id = ?
      `, [now, paymentId]);
    } catch (emailErr) {
      console.warn('Failed to dispatch payment verified confirmation email:', emailErr);
      await execute(`
        UPDATE payments SET email_status = 'FAILED', email_error = ? WHERE id = ?
      `, [String(emailErr), paymentId]);
    }
  }

  await logAuditEvent(
    adminUsername,
    'PAYMENT_VERIFIED',
    'PAYMENT',
    paymentId,
    `Admin manually verified payment of ₹${pay.amount} (Ref: ${pay.reference_id}, UTR: ${pay.gateway_payment_id || pay.user_reference || 'N/A'}). Confirmation email dispatched to ${recipientEmail}.${notes ? ' - ' + notes : ''}`
  );

  return true;
}

export interface RejectionRefundResult {
  success: boolean;
  message: string;
  paymentId: string;
  registrationId: string;
  refundStatus: string;
  refundAmount: number;
  emailSent: boolean;
  emailStatus: 'SENT' | 'FAILED' | 'SKIPPED';
  emailRecipient?: string;
  emailError?: string;
}

export async function rejectPayment(
  paymentId: string,
  adminUsername: string,
  reason: string,
  options?: { skipEmail?: boolean }
): Promise<RejectionRefundResult> {
  const pay = await queryOne<PaymentRecord>('SELECT * FROM payments WHERE id = ?', [paymentId]);
  if (!pay) throw new Error('Payment record not found');

  const now = new Date().toISOString();
  const wasPaid = normalizePaymentStatus(pay.status) === 'PAID';

  let participantName = 'Participant';
  let recipientEmail = pay.payer_email || '';
  let itemTitle = 'Finxyora Competition';
  let refundStatus = 'Not Applicable (Payment was not captured)';
  let refundStatusDb = 'NONE';
  let refundAmount = 0;

  // 1. Retrieve registered participant details directly from SQL DB (trusted source of truth)
  if (pay.reference_type === 'event') {
    const reg = await getEventRegistration(pay.reference_id);
    if (reg) {
      participantName = (reg.participants && reg.participants[0]?.full_name) || reg.leader_name;
      recipientEmail = reg.leader_email;
      itemTitle = reg.event?.title || 'Festival Event';
    }
  } else {
    const stl = await getStallBooking(pay.reference_id);
    if (stl) {
      participantName = stl.contact_name;
      recipientEmail = stl.contact_email;
      itemTitle = stl.option_name || stl.stall_category;
    }
  }

  // 2. Separate registration rejection from refund processing
  if (wasPaid) {
    // A paid registration was rejected — initiate/record refund
    refundStatus = 'Initiated (12–15 hours expected)';
    refundStatusDb = 'INITIATED';
    refundAmount = Number(pay.amount || 0);

    // If Razorpay gateway integration is active and has valid payment ID, attempt automated provider refund
    const gatewayInfo = getPaymentGatewayInfo();
    let providerRefundRef: string | undefined = undefined;
    if (gatewayInfo.isConfigured && pay.gateway_payment_id?.startsWith('pay_')) {
      try {
        const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
        const res = await fetch(`https://api.razorpay.com/v1/payments/${pay.gateway_payment_id}/refund`, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${gatewayInfo.keyId}:${razorpaySecret}`).toString('base64'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: Math.round(refundAmount * 100),
            notes: { reason, registrationId: pay.reference_id, rejectedBy: adminUsername }
          })
        });
        const rzpData = await res.json();
        if (res.ok && rzpData.id) {
          providerRefundRef = rzpData.id;
          refundStatus = 'Completed (Gateway Automated Refund)';
          refundStatusDb = 'COMPLETED';
        }
      } catch (gwErr) {
        console.warn('Gateway refund attempt error, falling back to manual record:', gwErr);
      }
    }

    // Update payment record: keep track that money was received, but now refund is in progress/completed
    await execute(`
      UPDATE payments SET
        status = ?,
        rejection_reason = ?,
        refund_status = ?,
        refund_amount = ?,
        refund_ref = ?,
        rejected_at = ?,
        verified_by = ?
      WHERE id = ?
    `, [
      refundStatusDb === 'COMPLETED' ? 'refunded' : 'PAID',
      reason,
      refundStatusDb,
      refundAmount,
      providerRefundRef || null,
      now,
      adminUsername,
      paymentId
    ]);
  } else {
    // Unpaid / pending payment rejected — no money was received
    await execute(`
      UPDATE payments SET
        status = 'FAILED',
        rejection_reason = ?,
        refund_status = 'NONE',
        refund_amount = 0,
        rejected_at = ?,
        verified_by = ?
      WHERE id = ?
    `, [reason, now, adminUsername, paymentId]);
  }

  // 3. Update registration status to cancelled/rejected with audit fields
  if (pay.reference_type === 'event') {
    await execute(`
      UPDATE event_registrations SET
        registration_status = 'cancelled',
        payment_status = 'rejected',
        rejection_reason = ?,
        rejected_at = ?,
        refund_status = ?,
        updated_at = ?
      WHERE id = ?
    `, [reason, now, refundStatusDb, now, pay.reference_id]);
  } else {
    await execute(`
      UPDATE stall_bookings SET
        status = 'rejected',
        payment_status = 'rejected',
        admin_notes = ?,
        rejection_reason = ?,
        rejected_at = ?,
        refund_status = ?,
        updated_at = ?
      WHERE id = ?
    `, [reason, reason, now, refundStatusDb, now, pay.reference_id]);
  }

  // 4. Send email notification to registered participant
  let emailSent = false;
  let emailStatus: 'SENT' | 'FAILED' | 'SKIPPED' = 'SKIPPED';
  let emailError: string | undefined = undefined;

  if (!options?.skipEmail && recipientEmail && recipientEmail.includes('@')) {
    try {
      const emailRes = await sendRejectionRefundEmail({
        participantName,
        recipientEmail,
        registrationId: pay.reference_id,
        itemTitle,
        amount: wasPaid ? refundAmount : Number(pay.amount || 0),
        refundStatus,
        rejectionReason: reason
      });

      if (emailRes.success) {
        emailSent = true;
        emailStatus = 'SENT';
      } else {
        emailStatus = 'FAILED';
        emailError = emailRes.error || 'Failed to dispatch via email service';
      }
    } catch (e) {
      emailStatus = 'FAILED';
      emailError = e instanceof Error ? e.message : 'Unknown email error';
    }

    // Save notification result in database
    await execute(`
      UPDATE payments SET
        email_status = ?,
        email_sent_at = ?,
        email_error = ?
      WHERE id = ?
    `, [emailStatus, now, emailError || null, paymentId]);

    if (pay.reference_type === 'event') {
      await execute(`
        UPDATE event_registrations SET
          email_status = ?,
          email_sent_at = ?,
          email_error = ?
        WHERE id = ?
      `, [emailStatus, now, emailError || null, pay.reference_id]);
    } else {
      await execute(`
        UPDATE stall_bookings SET
          email_status = ?,
          email_sent_at = ?,
          email_error = ?
        WHERE id = ?
      `, [emailStatus, now, emailError || null, pay.reference_id]);
    }
  }

  // 5. Audit Log
  await logAuditEvent(
    adminUsername,
    'PAYMENT_REGISTRATION_REJECTED',
    pay.reference_type === 'event' ? 'EVENT_REGISTRATION' : 'STALL_BOOKING',
    pay.reference_id,
    `Rejected: "${reason}" | WasPaid=${wasPaid} | RefundStatus=${refundStatusDb} (₹${refundAmount}) | Email=${emailStatus} to ${recipientEmail}${emailError ? ' (Err: ' + emailError + ')' : ''}`
  );

  return {
    success: true,
    message: `Registration ${pay.reference_id} marked as Rejected. Refund status: ${refundStatus}.${emailSent ? ' Notification email successfully sent to ' + recipientEmail + '.' : emailError ? ' Notice: Notification email failed (' + emailError + ').' : ''}`,
    paymentId,
    registrationId: pay.reference_id,
    refundStatus,
    refundAmount,
    emailSent,
    emailStatus,
    emailRecipient: recipientEmail,
    emailError
  };
}

export async function refundPayment(
  paymentId: string,
  adminUsername: string,
  reason: string,
  options?: { skipEmail?: boolean }
): Promise<RejectionRefundResult> {
  const pay = await queryOne<PaymentRecord>('SELECT * FROM payments WHERE id = ?', [paymentId]);
  if (!pay) throw new Error('Payment record not found');

  const now = new Date().toISOString();
  const refundAmount = Number(pay.amount || 0);
  const refundStatus = 'Completed (Full Refund Issued)';
  const refundStatusDb = 'COMPLETED';

  let participantName = 'Participant';
  let recipientEmail = pay.payer_email || '';
  let itemTitle = 'Finxyora Competition';

  if (pay.reference_type === 'event') {
    const reg = await getEventRegistration(pay.reference_id);
    if (reg) {
      participantName = (reg.participants && reg.participants[0]?.full_name) || reg.leader_name;
      recipientEmail = reg.leader_email;
      itemTitle = reg.event?.title || 'Festival Event';
    }
  } else {
    const stl = await getStallBooking(pay.reference_id);
    if (stl) {
      participantName = stl.contact_name;
      recipientEmail = stl.contact_email;
      itemTitle = stl.option_name || stl.stall_category;
    }
  }

  // Attempt gateway refund if Razorpay is configured
  const gatewayInfo = getPaymentGatewayInfo();
  let providerRefundRef: string | undefined = undefined;
  if (gatewayInfo.isConfigured && pay.gateway_payment_id?.startsWith('pay_')) {
    try {
      const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
      const res = await fetch(`https://api.razorpay.com/v1/payments/${pay.gateway_payment_id}/refund`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${gatewayInfo.keyId}:${razorpaySecret}`).toString('base64'),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: Math.round(refundAmount * 100),
          notes: { reason, registrationId: pay.reference_id, refundedBy: adminUsername }
        })
      });
      const rzpData = await res.json();
      if (res.ok && rzpData.id) {
        providerRefundRef = rzpData.id;
      }
    } catch (gwErr) {
      console.warn('Gateway refund error, logging manual refund:', gwErr);
    }
  }

  // Update payments record
  await execute(`
    UPDATE payments SET
      status = 'refunded',
      refund_status = 'COMPLETED',
      refund_amount = ?,
      refund_ref = ?,
      refunded_at = ?,
      rejection_reason = ?,
      verified_by = ?
    WHERE id = ?
  `, [refundAmount, providerRefundRef || null, now, reason, adminUsername, paymentId]);

  if (pay.reference_type === 'event') {
    await execute(`
      UPDATE event_registrations SET
        payment_status = 'refunded',
        registration_status = 'cancelled',
        refund_status = 'COMPLETED',
        rejection_reason = ?,
        updated_at = ?
      WHERE id = ?
    `, [reason, now, pay.reference_id]);
  } else {
    await execute(`
      UPDATE stall_bookings SET
        payment_status = 'refunded',
        status = 'refunded',
        refund_status = 'COMPLETED',
        admin_notes = ?,
        rejection_reason = ?,
        updated_at = ?
      WHERE id = ?
    `, [reason, reason, now, pay.reference_id]);
  }

  // Send email confirmation
  let emailSent = false;
  let emailStatus: 'SENT' | 'FAILED' | 'SKIPPED' = 'SKIPPED';
  let emailError: string | undefined = undefined;

  if (!options?.skipEmail && recipientEmail && recipientEmail.includes('@')) {
    try {
      const emailRes = await sendRejectionRefundEmail({
        participantName,
        recipientEmail,
        registrationId: pay.reference_id,
        itemTitle,
        amount: refundAmount,
        refundStatus: 'Completed (Full Refund Issued)',
        rejectionReason: reason
      });

      if (emailRes.success) {
        emailSent = true;
        emailStatus = 'SENT';
      } else {
        emailStatus = 'FAILED';
        emailError = emailRes.error || 'Failed to dispatch via email service';
      }
    } catch (e) {
      emailStatus = 'FAILED';
      emailError = e instanceof Error ? e.message : 'Unknown email error';
    }

    await execute(`
      UPDATE payments SET
        email_status = ?,
        email_sent_at = ?,
        email_error = ?
      WHERE id = ?
    `, [emailStatus, now, emailError || null, paymentId]);
  }

  await logAuditEvent(
    adminUsername,
    'PAYMENT_REFUND_COMPLETED',
    'PAYMENT',
    paymentId,
    `Refund ₹${refundAmount} completed for ${pay.reference_id}: "${reason}" | Email=${emailStatus}`
  );

  return {
    success: true,
    message: `Payment ${paymentId} (Ref: ${pay.reference_id}) marked as Refunded. ${emailSent ? 'Confirmation email sent to ' + recipientEmail + '.' : emailError ? 'Notice: Email delivery failed (' + emailError + ').' : ''}`,
    paymentId,
    registrationId: pay.reference_id,
    refundStatus,
    refundAmount,
    emailSent,
    emailStatus,
    emailRecipient: recipientEmail,
    emailError
  };
}

export async function retryPaymentEmail(
  paymentId: string,
  adminUsername: string
): Promise<RejectionRefundResult> {
  const pay = await queryOne<PaymentRecord>('SELECT * FROM payments WHERE id = ?', [paymentId]);
  if (!pay) throw new Error('Payment record not found');

  let participantName = 'Participant';
  let recipientEmail = pay.payer_email || '';
  let itemTitle = 'Finxyora Competition';

  if (pay.reference_type === 'event') {
    const reg = await getEventRegistration(pay.reference_id);
    if (reg) {
      participantName = (reg.participants && reg.participants[0]?.full_name) || reg.leader_name;
      recipientEmail = reg.leader_email;
      itemTitle = reg.event?.title || 'Festival Event';
    }
  } else {
    const stl = await getStallBooking(pay.reference_id);
    if (stl) {
      participantName = stl.contact_name;
      recipientEmail = stl.contact_email;
      itemTitle = stl.option_name || stl.stall_category;
    }
  }

  if (!recipientEmail || !recipientEmail.includes('@')) {
    throw new Error('No registered email found in database for this record.');
  }

  const refundStatus = pay.status === 'refunded' || pay.refund_status === 'COMPLETED'
    ? 'Completed (Full Refund Issued)'
    : pay.refund_status === 'INITIATED' || pay.refund_status === 'PROCESSING'
    ? 'Initiated (12–15 hours expected)'
    : 'Not Applicable (Payment was not captured)';

  const now = new Date().toISOString();
  let emailSent = false;
  let emailStatus: 'SENT' | 'FAILED' = 'FAILED';
  let emailError: string | undefined = undefined;

  try {
    const emailRes = await sendRejectionRefundEmail({
      participantName,
      recipientEmail,
      registrationId: pay.reference_id,
      itemTitle,
      amount: Number(pay.refund_amount || pay.amount || 0),
      refundStatus,
      rejectionReason: pay.rejection_reason || 'Administrative review'
    });

    if (emailRes.success) {
      emailSent = true;
      emailStatus = 'SENT';
    } else {
      emailError = emailRes.error || 'Email dispatch failed';
    }
  } catch (err) {
    emailError = err instanceof Error ? err.message : 'Unknown error';
  }

  await execute(`
    UPDATE payments SET
      email_status = ?,
      email_sent_at = ?,
      email_error = ?
    WHERE id = ?
  `, [emailStatus, now, emailError || null, paymentId]);

  await logAuditEvent(
    adminUsername,
    'EMAIL_NOTIFICATION_RETRY',
    'PAYMENT',
    paymentId,
    `Email retry to ${recipientEmail}: ${emailStatus}${emailError ? ' (Err: ' + emailError + ')' : ''}`
  );

  return {
    success: emailSent,
    message: emailSent
      ? `Notification email successfully re-sent to ${recipientEmail}.`
      : `Email dispatch failed: ${emailError}`,
    paymentId,
    registrationId: pay.reference_id,
    refundStatus,
    refundAmount: Number(pay.refund_amount || pay.amount || 0),
    emailSent,
    emailStatus,
    emailRecipient: recipientEmail,
    emailError
  };
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
  completedRefunds: number;
  netCollections: number;
  pendingRefunds: number;
  submittedCollections: number;
  pendingCollections: number;
  refundedCollections: number;
  pendingPayments: number;
  successfulPayments: number;
  verifiedPayments: number;
  submittedPayments: number;
  failedPayments: number;
  refundedPayments: number;
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
    `SELECT COUNT(*) as count FROM event_registrations WHERE ${regTypeClause} AND LOWER(payment_status) IN ('verified', 'paid') AND LOWER(registration_status) != 'cancelled'`
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
    `SELECT COUNT(*) as count FROM stall_bookings WHERE ${stallTypeClause} AND LOWER(applicant_type) = 'student'`
  );
  const vendorStalls = await queryOne<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM stall_bookings WHERE ${stallTypeClause} AND LOWER(applicant_type) IN ('vendor', 'outsider')`
  );

  // 4. Financial breakdown (Strict verified revenue calculation rules)
  // Total verified collections: ONLY amounts received from successfully verified payments.
  // When a verified payment is refunded later, it remains in verified collections as original intake,
  // and the completed refund is subtracted from net collections to ensure non-negative, accurate reporting.
  const payTypeClause = filterType === 'ALL'
    ? '1=1'
    : filterType === 'TEST'
    ? "registration_type = 'TEST'"
    : "registration_type = 'REAL'";

  const verifiedSumRow = await queryOne<{ total: string | number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payments 
     WHERE ${payTypeClause} AND (LOWER(status) IN ('verified', 'successful', 'paid', 'refunded') OR refund_status = 'COMPLETED')`
  );

  // Completed refunds: Subtract only refunds confirmed as successfully completed
  const completedRefundsRow = await queryOne<{ total: string | number }>(
    `SELECT COALESCE(SUM(CASE WHEN refund_amount > 0 THEN refund_amount ELSE amount END), 0) as total FROM payments 
     WHERE ${payTypeClause} AND (LOWER(status) = 'refunded' OR refund_status = 'COMPLETED')`
  );

  // Pending refunds: uncompleted/initiated refunds (do not deduct until confirmed)
  const pendingRefundsRow = await queryOne<{ total: string | number }>(
    `SELECT COALESCE(SUM(CASE WHEN refund_amount > 0 THEN refund_amount ELSE amount END), 0) as total FROM payments 
     WHERE ${payTypeClause} AND refund_status IN ('INITIATED', 'PROCESSING', 'PENDING', 'REFUND_PENDING') AND LOWER(status) != 'refunded'`
  );

  // Pending payments: strictly pending verification (PENDING, SUBMITTED, REVIEW_REQUIRED, VERIFYING)
  const pendingSumRow = await queryOne<{ total: string | number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payments 
     WHERE ${payTypeClause} AND LOWER(status) IN ('pending', 'submitted', 'review_required', 'verifying')`
  );

  const submittedSumRow = await queryOne<{ total: string | number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE ${payTypeClause} AND LOWER(status) = 'submitted'`
  );

  const verifiedCollections = Number(verifiedSumRow?.total || 0);
  const completedRefunds = Number(completedRefundsRow?.total || 0);
  const refundedCollections = completedRefunds; // backwards-compatible alias
  const netCollections = Math.max(0, verifiedCollections - completedRefunds);
  const pendingCollections = Number(pendingSumRow?.total || 0);
  const pendingRefunds = Number(pendingRefundsRow?.total || 0);
  const submittedCollections = Number(submittedSumRow?.total || 0);

  // 5. Payment status tallies
  const pendingPayRow = await queryOne<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM payments WHERE ${payTypeClause} AND LOWER(status) IN ('pending', 'submitted', 'review_required', 'verifying')`
  );
  const submittedPayRow = await queryOne<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM payments WHERE ${payTypeClause} AND LOWER(status) = 'submitted'`
  );
  const verifiedPayRow = await queryOne<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM payments WHERE ${payTypeClause} AND LOWER(status) IN ('verified', 'successful', 'paid')`
  );
  const rejectedPayRow = await queryOne<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM payments WHERE ${payTypeClause} AND LOWER(status) IN ('rejected', 'failed', 'expired')`
  );
  const refundedPayRow = await queryOne<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM payments WHERE ${payTypeClause} AND (LOWER(status) = 'refunded' OR refund_status = 'COMPLETED')`
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
      "SELECT COUNT(*) as count FROM event_registrations WHERE event_id = ? AND LOWER(payment_status) IN ('verified', 'paid')",
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
    completedRefunds,
    netCollections,
    pendingRefunds,
    submittedCollections,
    pendingCollections,
    refundedCollections,
    pendingPayments: Number(pendingPayRow?.count || 0),
    successfulPayments: Number(verifiedPayRow?.count || 0),
    verifiedPayments: Number(verifiedPayRow?.count || 0),
    submittedPayments: Number(submittedPayRow?.count || 0),
    failedPayments: Number(rejectedPayRow?.count || 0),
    refundedPayments: Number(refundedPayRow?.count || 0),
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
