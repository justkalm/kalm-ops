// src/app/api/compliance/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const complianceItemSchema = z.object({
  title: z.string().trim().min(1).max(300),
  due: z.string().min(1),
  status: z.enum(['pending', 'done']).default('pending'),
  owner: z.enum(['moiz', 'hassan', 'anas']),
});

export async function GET() {
  const items = await prisma.complianceItem.findMany({ orderBy: { due: 'asc' } });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = complianceItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const item = await prisma.complianceItem.create({
    data: { ...parsed.data, due: new Date(parsed.data.due) },
  });
  return NextResponse.json(item);
}
