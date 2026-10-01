import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, signAdminToken, COOKIE_NAME } from '@/lib/auth';
import { logAuditEvent } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username and password required' }, { status: 400 });
    }

    const authResult = authenticateAdmin(username, password);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ success: false, error: authResult.message || 'Invalid credentials' }, { status: 401 });
    }

    const token = signAdminToken(authResult.user);
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: authResult.user
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 // 24 hours
    });

    logAuditEvent(authResult.user.username, 'ADMIN_LOGIN', 'SESSION', authResult.user.id, 'Successful administrator login');

    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Login failed' },
      { status: 500 }
    );
  }
}
