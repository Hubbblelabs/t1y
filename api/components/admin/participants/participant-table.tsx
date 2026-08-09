import Link from "next/link";
import { Users } from "lucide-react";

import { Pagination } from "@/components/admin/pagination";
import { SortableHeader } from "@/components/admin/sortable-header";
import { Badge, StatusDot } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import type { Principal } from "@/lib/auth/session";
import { listParticipants, type ParticipantRow } from "@/lib/services/participants";
import { formatDate, formatPercent, formatRelative, humaniseEnum } from "@/lib/utils/format";
import { buildPagination, type PaginationMeta } from "@/lib/api/response";
import type { participantListQuerySchema } from "@/lib/validation/admin";
import type { z } from "zod";

type Query = z.infer<typeof participantListQuerySchema>;

/**
 * The participant table.
 *
 * Server-rendered and server-paginated. Below `md` the rows collapse into
 * stacked cards rather than forcing a horizontal scroll through eight columns
 * on a phone.
 */
export async function ParticipantTable({
  principal,
  query,
}: {
  principal: Principal;
  query: Query;
}) {
  const adherenceTo = new Date();
  const adherenceFrom = new Date(adherenceTo);
  adherenceFrom.setDate(adherenceFrom.getDate() - 30);

  const { items, total } = await listParticipants(principal, {
    search: query.search,
    status: query.status,
    diabetesType: query.diabetesType,
    studyId: query.studyId,
    joinedFrom: query.joinedFrom,
    joinedTo: query.joinedTo,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
    adherenceFrom,
    adherenceTo,
  });

  const pagination = buildPagination(query.page, query.pageSize, total);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={
          hasFilters(query) ? "No participants match these filters" : "No participants yet"
        }
        description={
          hasFilters(query)
            ? "Try removing a filter or widening the date range."
            : "Participants appear here once they are registered on the platform."
        }
      />
    );
  }

  return (
    <>
      {/* Desktop and tablet */}
      <TableScroll className="hidden md:block" label="Participants">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="participantCode" label="Participant" />
              <SortableHeader field="name" label="Name" />
              <SortableHeader field="diabetesType" label="Type" />
              <SortableHeader field="status" label="Status" />
              <SortableHeader field="lastActivityAt" label="Last activity" />
              <TableHead className="text-right">Last glucose</TableHead>
              <TableHead className="text-right">HbA1c</TableHead>
              <TableHead className="text-right">Adherence</TableHead>
              <SortableHeader field="createdAt" label="Joined" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/admin/participants/${row.id}`}
                    className="hover:text-primary underline-offset-4 hover:underline"
                  >
                    {row.participantCode}
                  </Link>
                </TableCell>
                <TableCell className="max-w-44 truncate">{row.name}</TableCell>
                <TableCell className="text-ink-muted whitespace-nowrap">
                  {humaniseEnum(row.diabetesType)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-ink-muted whitespace-nowrap">
                  {row.lastActivityAt ? formatRelative(row.lastActivityAt) : "No activity"}
                </TableCell>
                <TableCell className="text-ink-muted tabular text-right whitespace-nowrap">
                  {row.lastGlucoseAt ? formatDate(row.lastGlucoseAt) : "—"}
                </TableCell>
                <TableCell className="tabular text-right">
                  {row.latestHbA1c ? `${row.latestHbA1c.valuePercent}%` : "—"}
                </TableCell>
                <TableCell className="tabular text-right">
                  {formatPercent(row.adherencePercent, 0)}
                </TableCell>
                <TableCell className="text-ink-muted whitespace-nowrap">
                  {formatDate(row.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableScroll>

      {/* Mobile: a readable stacked representation, not a shrunken table */}
      <ul className="divide-line divide-y md:hidden">
        {items.map((row) => (
          <li key={row.id}>
            <Link
              href={`/admin/participants/${row.id}`}
              className="hover:bg-surface-hover block px-4 py-3 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ink text-sm font-medium">{row.participantCode}</p>
                  <p className="text-ink-muted truncate text-[13px]">{row.name}</p>
                </div>
                <StatusBadge status={row.status} />
              </div>

              <dl className="text-ink-muted mt-2.5 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-ink-subtle">Type</dt>
                  <dd>{humaniseEnum(row.diabetesType)}</dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">HbA1c</dt>
                  <dd className="tabular">
                    {row.latestHbA1c ? `${row.latestHbA1c.valuePercent}%` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">Adherence</dt>
                  <dd className="tabular">{formatPercent(row.adherencePercent, 0)}</dd>
                </div>
              </dl>

              <p className="text-ink-subtle mt-2 text-xs">
                {row.lastActivityAt
                  ? `Last active ${formatRelative(row.lastActivityAt)}`
                  : "No activity recorded"}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <PaginationFooter pagination={pagination} />
    </>
  );
}

function PaginationFooter({ pagination }: { pagination: PaginationMeta }) {
  return (
    <div className="border-line border-t px-4 py-3">
      <Pagination pagination={pagination} />
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ACTIVE"
      ? "success"
      : status === "SUSPENDED"
        ? "danger"
        : status === "PENDING"
          ? "warning"
          : "neutral";

  return (
    <Badge tone={tone as never}>
      <StatusDot tone={tone as never} />
      {humaniseEnum(status)}
    </Badge>
  );
}

function hasFilters(query: Query): boolean {
  return Boolean(
    query.search ||
      query.status?.length ||
      query.diabetesType?.length ||
      query.studyId ||
      query.joinedFrom ||
      query.joinedTo,
  );
}
