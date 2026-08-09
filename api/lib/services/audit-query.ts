import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

/**
 * Read access to the audit trail.
 *
 * Read-only by design: this module exposes no create, update or delete. Entries
 * are written exclusively through `lib/audit/audit.ts`, and nothing in the
 * application can modify one afterwards.
 */

const AUDIT_SELECT = {
  id: true,
  action: true,
  resourceType: true,
  resourceId: true,
  participantId: true,
  studyId: true,
  description: true,
  metadata: true,
  ipAddress: true,
  userAgent: true,
  requestId: true,
  success: true,
  createdAt: true,
  actorId: true,
  actorEmail: true,
  actorRole: true,
  subject: {
    select: { id: true, profile: { select: { participantCode: true } } },
  },
} satisfies Prisma.AuditLogSelect;

export interface AuditQueryParams {
  actorId?: string;
  participantId?: string;
  action?: string;
  resourceType?: string;
  actorRole?: UserRole;
  success?: boolean;
  search?: string;
  from?: Date;
  to?: Date;
  skip: number;
  take: number;
}

export async function listAuditLogs(params: AuditQueryParams) {
  const where: Prisma.AuditLogWhereInput = {
    ...(params.actorId ? { actorId: params.actorId } : {}),
    ...(params.participantId ? { participantId: params.participantId } : {}),
    ...(params.action ? { action: params.action } : {}),
    ...(params.resourceType ? { resourceType: params.resourceType } : {}),
    ...(params.actorRole ? { actorRole: params.actorRole } : {}),
    ...(params.success !== undefined ? { success: params.success } : {}),
    ...(params.from || params.to
      ? {
          createdAt: {
            ...(params.from ? { gte: params.from } : {}),
            ...(params.to ? { lte: params.to } : {}),
          },
        }
      : {}),
    ...(params.search
      ? {
          OR: [
            { actorEmail: { contains: params.search, mode: "insensitive" } },
            { action: { contains: params.search, mode: "insensitive" } },
            { resourceId: { contains: params.search, mode: "insensitive" } },
            { description: { contains: params.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: AUDIT_SELECT,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total };
}

/** Distinct action names present in the log, for populating the filter. */
export async function listAuditActions(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    distinct: ["action"],
    select: { action: true },
    orderBy: { action: "asc" },
    take: 200,
  });
  return rows.map((row) => row.action);
}

export async function getAuditStats(from: Date, to: Date) {
  const [total, failed, byRole, topActions] = await Promise.all([
    prisma.auditLog.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.auditLog.count({
      where: { createdAt: { gte: from, lte: to }, success: false },
    }),
    prisma.auditLog.groupBy({
      by: ["actorRole"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
    }),
    prisma.auditLog.groupBy({
      by: ["action"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
      orderBy: { _count: { action: "desc" } },
      take: 8,
    }),
  ]);

  return {
    total,
    failed,
    byRole: byRole.map((row) => ({
      role: row.actorRole,
      count: row._count._all,
    })),
    topActions: topActions.map((row) => ({
      action: row.action,
      count: row._count._all,
    })),
  };
}
