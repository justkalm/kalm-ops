// src/app/api/budget/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const budgetItemSchema = z.object({
  category: z.string().trim().min(1).max(100),
  item: z.string().trim().min(1).max(300),
  planned: z.number().int().min(0),
  spent: z.number().int().min(0),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = budgetItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const item = await prisma.budgetItem.update({ where: { id }, data: parsed.data });
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.budgetItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
