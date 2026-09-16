// src/app/api/kpi/history/route.ts
//
// "Log today's snapshot" creates a new dated history entry from whatever
// the current live KPISnapshot values are. If an entry for today's date
// already exists, it's replaced rather than duplicated — matches the
// original component's behavior of filtering out any existing
// same-day entry before appending.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const SNAPSHOT_ID = 'singleton';

export async function GET() {
  const history = await prisma.kPIHistoryEntry.findMany({ orderBy: { date: 'desc' }, take: 50 });
  return NextResponse.json(history);
}

export async function POST() {
  const snapshot = await prisma.kPISnapshot.upsert({
    where: { id: SNAPSHOT_ID },
    update: {},
    create: { id: SNAPSHOT_ID },
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  await prisma.kPIHistoryEntry.deleteMany({
    where: { date: { gte: todayStart, lt: todayEnd } },
  });

  const entry = await prisma.kPIHistoryEntry.create({
    data: {
      date: todayStart,
      contractorProfiles: snapshot.contractorProfiles,
      developerAccounts: snapshot.developerAccounts,
      verifiedProfiles: snapshot.verifiedProfiles,
      platformIntroductions: snapshot.platformIntroductions,
      trialCohortActive: snapshot.trialCohortActive,
    },
  });

  return NextResponse.json(entry);
}
