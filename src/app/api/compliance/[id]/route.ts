// src/app/api/compliance/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const complianceItemSchema = z.object({
  title: z.string().trim().min(1).max(300),
  due: z.string().min(1),
  status: z.enum(['pending', 'done']),
  owner: z.enum(['moiz', 'hassan', 'anas']),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = complianceItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const item = await prisma.complianceItem.update({
    where: { id },
    data: { ...parsed.data, due: new Date(parsed.data.due) },
  });
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.complianceItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
