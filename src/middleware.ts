// src/middleware.ts
//
// Gates every page in this app except /login and /api/login itself.
// Runs on Vercel's Node.js runtime (not Edge) so it can use Node's
// built-in crypto module directly for HMAC verification.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as crypto from 'crypto';

export const runtime = 'nodejs';

const COOKIE_NAME = 'kalm_ops_session';

function hmacSign(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return crypto.timingSafeEqual(bufA, bufB);
}

function isValidSession(token: string | undefined, secret: string | undefined): boolean {
  if (!token || !secret) return false;

  const [expiresAtStr, signature] = token.split('.');
  if (!expiresAtStr || !signature) return false;

  const expiresAt = Number(expiresAtStr);
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) return false;

  const expectedSignature = hmacSign(expiresAtStr, secret);
  return constantTimeEqual(signature, expectedSignature);
}

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/api/login') {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const valid = isValidSession(token, process.env.OPS_SESSION_SECRET);

  if (!valid) {
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
