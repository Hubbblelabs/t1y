import type { Metadata } from "next";
import { ScrollText } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SearchBox } from "@/components/admin/search-box";
import { DateRangePicker } from "@/components/admin/date-range-picker";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from "@/components/ui/table";
import { buildPagination } from "@/lib/api/response";
import {
  AuditAction,
  actorFromPrincipal,
  recordAudit,
  requestContextFrom,
} from "@/lib/audit/audit";
import { requirePrincipal } from "@/lib/auth/session";
import { getAuditStats, listAuditLogs } from "@/lib/services/audit-query";
import { formatDateTime, formatNumber, humaniseEnum } from "@/lib/utils/format";
import { auditQuerySchema } from "@/lib/validation/admin";
import { resolveDateRange } from "@/lib/validation/common";
import { headers } from "next/headers";

export const metadata: Metadata = { title: "Audit logs" };

/**
 * The audit trail.
 *
 * Read-only: the application has no code path that edits or deletes an entry.
 * Viewing the trail is itself recorded.
 */
export default async function AuditLogsPage(props: PageProps<"/admin/audit-logs">) {
  const searchParams = await props.searchParams;
  const principal = await requirePrincipal();

  const parsed = auditQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : auditQuerySchema.parse({});
  const { from, to } = resolveDateRange(query);

  const [{ items, total }, stats] = await Promise.all([
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
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    getAuditStats(from, to),
  ]);

  const requestHeaders = await headers();
  await recordAudit(
    actorFromPrincipal(principal),
    {
      action: AuditAction.AUDIT_LOG_VIEWED,
      resourceType: "audit-log",
      description: "Viewed the audit trail",
      metadata: { page: query.page },
    },
    requestContextFrom(new Request("http://internal", { headers: requestHeaders })),
  );

  const pagination = buildPagination(query.page, query.pageSize, total);

  return (
    <PageContainer>
      <PageHeader
        title="Audit logs"
        description="A permanent record of sensitive operations. Entries cannot be edited or removed."
        actions={<DateRangePicker />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Entries in period" value={formatNumber(stats.total)} />
        <StatCard
          label="Failed operations"
          value={formatNumber(stats.failed)}
          hint={stats.failed > 0 ? "Review these entries" : "None recorded"}
        />
        <StatCard
          label="Most frequent action"
          value={stats.topActions[0]?.action ?? "—"}
          hint={
            stats.topActions[0]
              ? `${formatNumber(stats.topActions[0].count)} occurrences`
              : undefined
          }
        />
        <StatCard label="Distinct roles active" value={formatNumber(stats.byRole.length)} />
      </div>

      <Card>
        <div className="border-line border-b p-4">
          <SearchBox placeholder="Search by actor, action or resource" />
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No audit entries"
            description="No sensitive operations were recorded in the selected period."
          />
        ) : (
          <>
            <TableScroll label="Audit log entries">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead>IP address</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-ink-muted whitespace-nowrap">
                        {formatDateTime(entry.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        {entry.actorEmail ?? "System"}
                      </TableCell>
                      <TableCell className="text-ink-muted whitespace-nowrap">
                        {entry.actorRole ? humaniseEnum(entry.actorRole) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{entry.action}</TableCell>
                      <TableCell className="text-ink-muted max-w-40 truncate">
                        {entry.description ?? entry.resourceType}
                      </TableCell>
                      <TableCell className="text-ink-muted whitespace-nowrap">
                        {entry.subject?.profile?.participantCode ?? "—"}
                      </TableCell>
                      <TableCell className="text-ink-muted font-mono text-xs">
                        {entry.ipAddress ?? "—"}
                      </TableCell>
                      <TableCell>
                        {entry.success ? (
                          <Badge tone="neutral">OK</Badge>
                        ) : (
                          <Badge tone="danger">Failed</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>

            <div className="border-line border-t px-4 py-3">
              <Pagination pagination={pagination} />
            </div>
          </>
        )}
      </Card>
    </PageContainer>
  );
}
