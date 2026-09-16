// src/app/api/settings/route.ts
//
// A single settings row (budgetCeiling, vestingStart), upserted so a
// missing row is created automatically on first read rather than needing
// a separate seed step.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const SETTINGS_ID = 'singleton';

const settingsSchema = z.object({
  budgetCeiling: z.number().int().min(0),
  vestingStart: z.string().min(1),
});

export async function GET() {
  const settings = await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const settings = await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: {
      budgetCeiling: parsed.data.budgetCeiling,
      vestingStart: new Date(parsed.data.vestingStart),
    },
    create: {
      id: SETTINGS_ID,
      budgetCeiling: parsed.data.budgetCeiling,
      vestingStart: new Date(parsed.data.vestingStart),
    },
  });
  return NextResponse.json(settings);
}
