import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { getDb } from './db';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'finxyora-super-secret-jwt-key-2026-production';
const COOKIE_NAME = 'finxyora_admin_token';

export interface AdminPayload {
  id: string;
  username: string;
  displayName: string;
  role: string;
}

export function authenticateAdmin(username: string, passwordPlain: string): { success: boolean; user?: AdminPayload; message?: string } {
  const db = getDb();
  const row = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username) as {
    id: string;
    username: string;
    password_hash: string;
    display_name: string;
    role: string;
  } | undefined;

  if (!row) {
    return { success: false, message: 'Invalid username or password' };
  }

  const matches = bcrypt.compareSync(passwordPlain, row.password_hash);
  if (!matches) {
    return { success: false, message: 'Invalid username or password' };
  }

  return {
    success: true,
    user: {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role
    }
  };
}

export function signAdminToken(user: AdminPayload): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyAdminToken(token: string): AdminPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminPayload;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export { COOKIE_NAME };
