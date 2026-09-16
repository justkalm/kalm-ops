// src/app/api/crm/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const crmContactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(['Developer', 'Contractor']),
  zone: z.string().trim().max(200).optional().nullable(),
  source: z.string().trim().min(1).max(200),
  owner: z.enum(['moiz', 'hassan', 'anas']),
  stage: z.string().trim().min(1).max(100),
  notes: z.string().trim().max(2000).optional().nullable(),
  lastContact: z.string().datetime().or(z.string().min(1)),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = crmContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const contact = await prisma.cRMContact.update({
    where: { id },
    data: { ...parsed.data, lastContact: new Date(parsed.data.lastContact) },
  });
  return NextResponse.json(contact);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.cRMContact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
