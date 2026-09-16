// src/app/api/kpi/route.ts
//
// The live KPI snapshot — a single row updated in place. Separate from
// /api/kpi/history, which records dated copies of this snapshot over
// time rather than overwriting them.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const SNAPSHOT_ID = 'singleton';

const kpiSchema = z.object({
  contractorProfiles: z.number().int().min(0),
  developerAccounts: z.number().int().min(0),
  verifiedProfiles: z.number().int().min(0),
  platformIntroductions: z.number().int().min(0),
  trialCohortActive: z.number().int().min(0),
});

export async function GET() {
  const snapshot = await prisma.kPISnapshot.upsert({
    where: { id: SNAPSHOT_ID },
    update: {},
    create: { id: SNAPSHOT_ID },
  });
  return NextResponse.json(snapshot);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const parsed = kpiSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const snapshot = await prisma.kPISnapshot.upsert({
    where: { id: SNAPSHOT_ID },
    update: parsed.data,
    create: { id: SNAPSHOT_ID, ...parsed.data },
  });
  return NextResponse.json(snapshot);
}
