// src/app/api/equity/route.ts
//
// Always exactly 3 rows (one per founder). GET seeds the default 33.33%
// split on first call if no rows exist yet, so the dashboard has
// something sensible to show before anyone's touched this screen. PUT
// updates all 3 at once, since the equity split is edited as a whole
// (the UI shows all three founders together, not one at a time).

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const DEFAULT_EQUITY = [
  { person: 'moiz', equity: 33.33, capital: 170000 },
  { person: 'hassan', equity: 33.33, capital: 170000 },
  { person: 'anas', equity: 33.34, capital: 170000 },
];

const equitySchema = z.array(
  z.object({
    person: z.enum(['moiz', 'hassan', 'anas']),
    equity: z.number().min(0).max(100),
    capital: z.number().int().min(0),
  })
);

export async function GET() {
  let rows = await prisma.founderEquity.findMany();
  if (rows.length === 0) {
    await prisma.founderEquity.createMany({ data: DEFAULT_EQUITY });
    rows = await prisma.founderEquity.findMany();
  }
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const parsed = equitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  await Promise.all(
    parsed.data.map((e) =>
      prisma.founderEquity.upsert({
        where: { person: e.person },
        update: { equity: e.equity, capital: e.capital },
        create: e,
      })
    )
  );

  const rows = await prisma.founderEquity.findMany();
  return NextResponse.json(rows);
}
