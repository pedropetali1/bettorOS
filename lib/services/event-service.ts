"use server";

import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | PrismaClient;

type FindOrCreateEventInput = {
  name: string;
  date: Date | string;
  sport?: string | null;
  client?: DbClient;
};

export async function findOrCreateEvent({
  name,
  date,
  sport,
  client,
}: FindOrCreateEventInput) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Event name is required.");
  }

  const eventDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(eventDate.getTime())) {
    throw new Error("Event date is invalid.");
  }

  const db = client ?? prisma;

  const matches = await db.$queryRaw<
    Array<{ id: string; name: string; score: number }>
  >(Prisma.sql`
    SELECT id, name, similarity(name, ${trimmedName}) as score
    FROM "Event"
    WHERE date::date = ${eventDate}::date
      AND similarity(name, ${trimmedName}) > 0.4
    ORDER BY score DESC
    LIMIT 1
  `);

  if (matches.length > 0) {
    return matches[0].id;
  }

  const created = await db.event.create({
    data: {
      name: trimmedName,
      date: eventDate,
      sport: sport ?? null,
    },
    select: { id: true },
  });

  return created.id;
}
