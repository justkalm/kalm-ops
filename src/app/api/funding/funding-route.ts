// src/app/api/funding/route.ts
//
// Founder funding-contribution schedule: 4 partners, 3 rounds each, due
// every alternate month over 6 months. Per-partner round amount is their
// total capital commitment split evenly across the 3 rounds — partners
// aren't contributing equal amounts (equity split is uneven: Moiz 33.5%,
// Hassan 33.5%, Shaheer 24%, Anas 9%). GET seeds the 12 rows on first
// call if they don't exist yet (idempotent), so no manual seed script needed.

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// Total capital commitment per partner, split evenly across 3 rounds.
const PARTNER_TOTALS: Record<string, number> = {
  moiz: 150750,
  hassan: 150750,
  shaheer: 108000,
  anas: 40500,
};
const ROUND_MONTHS = [1, 3, 5]; // months from schedule start

async function ensureSeeded() {
  const count = await prisma.fundingContribution.count();
  if (count > 0) return;

  const now = new Date();
  const rows = [];
  for (const [partner, total] of Object.entries(PARTNER_TOTALS)) {
    const perRound = Math.round(total / 3);
    for (let round = 1; round <= 3; round++) {
      const targetDate = new Date(now);
      targetDate.setMonth(targetDate.getMonth() + ROUND_MONTHS[round - 1]);
      rows.push({ partner, round, amount: perRound, targetDate });
    }
  }
  await prisma.fundingContribution.createMany({ data: rows, skipDuplicates: true });
}

export async function GET() {
  await ensureSeeded();
  const contributions = await prisma.fundingContribution.findMany({
    orderBy: [{ round: 'asc' }, { partner: 'asc' }],
  });
  return NextResponse.json(contributions);
}

const updateSchema = z.object({
  id: z.string().min(1),
  paid: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const { id, paid } = parsed.data;
  const item = await prisma.fundingContribution.update({
    where: { id },
    data: { paid, paidDate: paid ? new Date() : null },
  });
  return NextResponse.json(item);
}
