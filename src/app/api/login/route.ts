// src/app/api/login/route.ts
//
// Same simple shared-password login as buildbridge-app's admin panel —
// one password, all three founders use it. Rate-limited per the same
// reasoning as that project: an in-memory limiter is honest about its
// own limits (resets on cold start, doesn't coordinate across multiple
// serverless instances) but still meaningfully raises the bar against
// casual brute-forcing.

import { NextRequest, NextResponse } from 'next/server';
import { createOpsSession, verifyOpsPassword } from '@/lib/ops-auth';

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const password = (body as { password?: unknown })?.password;
  if (typeof password !== 'string') {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }

  const valid = await verifyOpsPassword(password);
  if (!valid) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  await createOpsSession();
  return NextResponse.json({ ok: true });
}
