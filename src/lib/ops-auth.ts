// src/lib/ops-auth.ts
//
// Same pattern as buildbridge-app's admin-auth.ts (from the security
// patch you built): a single shared password, but the session cookie is
// an HMAC-signed token derived from it — never the plaintext password
// itself — with constant-time comparison to prevent timing attacks.
//
// Uses Web Crypto (SubtleCrypto), not Node's crypto module, so this works
// correctly in Vercel's Edge Middleware runtime as well as regular
// serverless functions — Edge Middleware does not have access to Node's
// crypto module at all.

import { cookies } from 'next/headers';

const COOKIE_NAME = 'kalm_ops_session';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

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

async function buildSessionToken(): Promise<string> {
  const secret = process.env.OPS_SESSION_SECRET;
  if (!secret) throw new Error('OPS_SESSION_SECRET is not set');

  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payload = `${expiresAt}`;
  const signature = await hmacSign(payload, secret);
  return `${payload}.${signature}`;
}

export async function createOpsSession(): Promise<void> {
  const token = await buildSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

export async function isOpsAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;

  const secret = process.env.OPS_SESSION_SECRET;
  if (!secret) return false;

  const [expiresAtStr, signature] = token.split('.');
  if (!expiresAtStr || !signature) return false;

  const expiresAt = Number(expiresAtStr);
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) return false;

  const expectedSignature = await hmacSign(expiresAtStr, secret);
  return constantTimeEqual(signature, expectedSignature);
}

export async function verifyOpsPassword(password: string): Promise<boolean> {
  const correctPassword = process.env.OPS_PASSWORD;
  if (!correctPassword) return false;
  if (password.length !== correctPassword.length) return false;
  return constantTimeEqual(password, correctPassword);
}

export { COOKIE_NAME };
