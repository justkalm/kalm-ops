// middleware.ts
//
// Gates every page in this app except /login and /api/login itself.
// Runs on Vercel's Edge runtime, so it can only use Web Crypto
// (SubtleCrypto), not Node's crypto module — the session verification
// logic here is a duplicate of isOpsAuthenticated in src/lib/ops-auth.ts,
// re-implemented inline because middleware.ts can't import from
// next/headers' cookies() the way route handlers can; it reads the
// request's cookies directly instead.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'kalm_ops_session';

async function hmacSign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Buffer.from(signature).toString('hex');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function isValidSession(token: string | undefined, secret: string | undefined): Promise<boolean> {
  if (!token || !secret) return false;

  const [expiresAtStr, signature] = token.split('.');
  if (!expiresAtStr || !signature) return false;

  const expiresAt = Number(expiresAtStr);
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) return false;

  const expectedSignature = await hmacSign(expiresAtStr, secret);
  return constantTimeEqual(signature, expectedSignature);
}

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/api/login') {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const valid = await isValidSession(token, process.env.OPS_SESSION_SECRET);

  if (!valid) {
    // API routes get a 401 instead of a redirect, since a redirect to an
    // HTML login page isn't useful for a fetch() call from the frontend.
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
