// src/app/api/flags/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const flagSchema = z.object({
  contractorName: z.string().trim().min(1).max(200),
  reportedBy: z.string().trim().max(200).optional().nullable(),
  stage: z.string().trim().min(1).max(100),
  dateReported: z.string().min(1),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export async function GET() {
  const flags = await prisma.flag.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(flags);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = flagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const flag = await prisma.flag.create({
    data: { ...parsed.data, dateReported: new Date(parsed.data.dateReported) },
  });
  return NextResponse.json(flag);
}
