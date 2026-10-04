import "server-only";

import { NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import type { SosContactInput } from "@/lib/validation/sos";

/**
 * Emergency contacts (doctor, nurse, …) coordinators add, and which children
 * see each. The app shows them on its SOS screen and dials from there.
 */

export async function listSosContacts() {
  const rows = await prisma.sosContact.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { assignments: true } } },
  });
  return rows.map(({ _count, ...row }) => ({ ...row, childCount: _count.assignments }));
}

export async function getSosContact(id: string) {
  const row = await prisma.sosContact.findUnique({
    where: { id },
    include: { assignments: { select: { userId: true } } },
  });
  if (!row) throw new NotFoundError("SOS contact");
  const { assignments, ...rest } = row;
  return { ...rest, participantIds: assignments.map((a) => a.userId) };
}

/** Only real child accounts can be assigned; anything else is dropped quietly. */
async function validChildIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: { id: { in: ids }, role: "PATIENT", deletedAt: null },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function createSosContact(input: SosContactInput) {
  const childIds = input.visibleToAll ? [] : await validChildIds(input.participantIds);
  const last = await prisma.sosContact.aggregate({ _max: { sortOrder: true } });
  return prisma.sosContact.create({
    data: {
      name: input.name,
      phone: input.phone,
      label: input.label,
      visibleToAll: input.visibleToAll,
      active: input.active,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
      assignments: { create: childIds.map((userId) => ({ userId })) },
    },
  });
}

export async function updateSosContact(id: string, input: SosContactInput) {
  await getSosContact(id);
  const childIds = input.visibleToAll ? [] : await validChildIds(input.participantIds);
  return prisma.$transaction(async (tx) => {
    await tx.sosContactAssignment.deleteMany({ where: { contactId: id } });
    return tx.sosContact.update({
      where: { id },
      data: {
        name: input.name,
        phone: input.phone,
        label: input.label,
        visibleToAll: input.visibleToAll,
        active: input.active,
        assignments: { create: childIds.map((userId) => ({ userId })) },
      },
    });
  });
}

export async function deleteSosContact(id: string): Promise<void> {
  await getSosContact(id);
  await prisma.sosContact.delete({ where: { id } });
}

/** The children a coordinator can choose between when assigning a contact. */
export async function listChildOptions() {
  const rows = await prisma.user.findMany({
    where: { role: "PATIENT", deletedAt: null },
    select: { id: true, profile: { select: { participantCode: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.profile?.participantCode ?? "",
    name: r.profile?.name ?? "",
  }));
}

/** What one child's app shows: live contacts for everyone, plus those assigned to them. */
export async function listSosContactsForChild(userId: string) {
  const rows = await prisma.sosContact.findMany({
    where: {
      active: true,
      OR: [{ visibleToAll: true }, { assignments: { some: { userId } } }],
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, phone: true, label: true },
  });
  return rows;
}
