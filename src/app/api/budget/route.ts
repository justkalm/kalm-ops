// src/app/api/budget/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const budgetItemSchema = z.object({
  category: z.string().trim().min(1).max(100),
  item: z.string().trim().min(1).max(300),
  planned: z.number().int().min(0),
  spent: z.number().int().min(0),
});

export async function GET() {
  const items = await prisma.budgetItem.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = budgetItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const item = await prisma.budgetItem.create({ data: parsed.data });
  return NextResponse.json(item);
}
