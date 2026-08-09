import Link from "next/link";
import { Activity } from "lucide-react";

import { Pagination } from "@/components/admin/pagination";
import { Badge } from "@/components/ui/badge";
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
import { participantLabel } from "@/lib/services/health-browser";
import { formatDateTime, humaniseEnum } from "@/lib/utils/format";

/**
 * Shared presentation for the cross-participant health tables.
 *
 * Every row links back to the participant it belongs to, which is the usual
 * next step from a browse view. On narrow screens the table scrolls inside its
 * own region rather than widening the page.
 */

export interface BrowseRow {
  id: string;
  user: {
    id: string;
    profile: { participantCode: string; firstName: string; lastName: string } | null;
  };
  occurredAt: Date;
  cells: Array<{ label: string; value: React.ReactNode; align?: "left" | "right" }>;
}

export function HealthBrowserTable({
  rows,
  total,
  page,
  pageSize,
  emptyTitle,
  emptyDescription,
  columns,
}: {
  rows: BrowseRow[];
  total: number;
  page: number;
  pageSize: number;
  emptyTitle: string;
  emptyDescription: string;
  columns: Array<{ label: string; align?: "left" | "right" }>;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState icon={Activity} title={emptyTitle} description={emptyDescription} />
    );
  }

  const pagination = buildPagination(page, pageSize, total);

  return (
    <>
      <TableScroll className="hidden md:block" label="Health records">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Participant</TableHead>
              <TableHead>Recorded</TableHead>
              {columns.map((column) => (
                <TableHead
                  key={column.label}
                  className={column.align === "right" ? "text-right" : undefined}
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const participant = participantLabel(row.user);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/admin/participants/${row.user.id}`}
                      className="hover:text-primary font-medium underline-offset-4 hover:underline"
                    >
                      {participant.code}
                    </Link>
                  </TableCell>
                  <TableCell className="text-ink-muted whitespace-nowrap">
                    {formatDateTime(row.occurredAt)}
                  </TableCell>
                  {row.cells.map((cell, index) => (
                    <TableCell
                      key={index}
                      className={
                        cell.align === "right" ? "tabular text-right" : undefined
                      }
                    >
                      {cell.value}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableScroll>

      <ul className="divide-line divide-y md:hidden">
        {rows.map((row) => {
          const participant = participantLabel(row.user);
          return (
            <li key={row.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/admin/participants/${row.user.id}`}
                  className="text-ink hover:text-primary text-sm font-medium underline-offset-4 hover:underline"
                >
                  {participant.code}
                </Link>
                <span className="text-ink-subtle text-xs">
                  {formatDateTime(row.occurredAt)}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                {row.cells.map((cell, index) => (
                  <div key={index}>
                    <dt className="text-ink-subtle">{cell.label}</dt>
                    <dd className="text-ink">{cell.value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>

      <div className="border-line border-t px-4 py-3">
        <Pagination pagination={pagination} />
      </div>
    </>
  );
}

/** Consistent tone mapping for medication dose outcomes. */
export function DoseStatusBadge({ status }: { status: string }) {
  const tone =
    status === "TAKEN"
      ? "success"
      : status === "MISSED"
        ? "danger"
        : status === "SKIPPED"
          ? "warning"
          : "neutral";

  return <Badge tone={tone as never}>{humaniseEnum(status)}</Badge>;
}
