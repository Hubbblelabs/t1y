import { defineRoute } from "@/lib/api/handler";
import { buildPagination, paginated } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { getAuditStats, listAuditActions, listAuditLogs } from "@/lib/services/audit-query";
import { resolveDateRange, toSkipTake } from "@/lib/validation/common";
import { auditQuerySchema } from "@/lib/validation/admin";

/**
 * GET /api/admin/audit-logs
 *
 * Read-only. There is no create, update or delete endpoint for audit entries
 * anywhere in the application — they are written only by the audit service.
 *
 * Reading the audit trail is itself audited.
 */
export const GET = defineRoute({
  capability: Capability.AUDIT_VIEW,
  query: auditQuerySchema,
  handler: async ({ principal, query, audit }) => {
    const { from, to } = resolveDateRange(query);
    const { skip, take } = toSkipTake(query);

    const [{ items, total }, stats, actions] = await Promise.all([
      listAuditLogs({
        actorId: query.actorId,
        participantId: query.participantId,
        action: query.action,
        resourceType: query.resourceType,
        actorRole: query.actorRole,
        success: query.success,
        search: query.search,
        from,
        to,
        skip,
        take,
      }),
      getAuditStats(from, to),
      listAuditActions(),
    ]);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.AUDIT_LOG_VIEWED,
        resourceType: "audit-log",
        description: "Viewed the audit trail",
        metadata: { page: query.page, range: query.range },
      },
      audit,
    );

    return paginated(items, buildPagination(query.page, query.pageSize, total), {
      stats,
      availableActions: actions,
      range: { from: from.toISOString(), to: to.toISOString() },
    });
  },
});
