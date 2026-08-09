import type { Metadata } from "next";
import { SlidersHorizontal } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, UnauthorizedState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from "@/components/ui/table";
import { requirePrincipal } from "@/lib/auth/session";
import { canManageThresholds } from "@/lib/permissions/policies";
import { listThresholds } from "@/lib/services/thresholds";
import { formatDate, humaniseEnum } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Clinical thresholds" };

/**
 * Clinical thresholds.
 *
 * This is the only mechanism by which the platform ever presents a value as
 * inside or outside a range. Each entry records the guideline or clinician it
 * came from, so no number displayed to a participant is unattributable.
 */
export default async function ThresholdsPage() {
  const principal = await requirePrincipal();

  if (!canManageThresholds(principal)) {
    return (
      <PageContainer>
        <UnauthorizedState detail="Clinical thresholds can only be managed by a clinical reviewer or super administrator." />
      </PageContainer>
    );
  }

  const thresholds = await listThresholds({ includeInactive: true });

  return (
    <PageContainer>
      <PageHeader
        title="Clinical thresholds"
        description="Configured target ranges and their clinical source"
      />

      <Card className="mb-6 p-4">
        <p className="text-ink-muted text-[13px] leading-relaxed">
          The platform contains no built-in target ranges. Any range shown
          alongside a recorded value originates here. Where no threshold exists
          for a participant, their values are displayed without a reference band
          and without classification.
        </p>
      </Card>

      <Card>
        {thresholds.length === 0 ? (
          <EmptyState
            icon={SlidersHorizontal}
            title="No thresholds configured"
            description="Until a threshold is defined, recorded values are presented without any target range."
          />
        ) : (
          <TableScroll label="Clinical thresholds">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">Range</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {thresholds.map((threshold) => (
                  <TableRow key={threshold.id}>
                    <TableCell className="font-medium">{threshold.label}</TableCell>
                    <TableCell className="text-ink-muted font-mono text-xs">
                      {threshold.key}
                    </TableCell>
                    <TableCell className="text-ink-muted">
                      {humaniseEnum(threshold.domain)}
                      {threshold.context ? (
                        <span className="text-ink-subtle ml-1 text-xs">
                          ({humaniseEnum(threshold.context)})
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge tone="neutral">{humaniseEnum(threshold.scope)}</Badge>
                    </TableCell>
                    <TableCell className="tabular text-right whitespace-nowrap">
                      {threshold.lowValue ?? "—"}–{threshold.highValue ?? "—"}{" "}
                      <span className="text-ink-subtle">{threshold.unit}</span>
                    </TableCell>
                    <TableCell className="text-ink-muted max-w-56 truncate">
                      {threshold.source}
                    </TableCell>
                    <TableCell>
                      {threshold.isActive ? (
                        <Badge tone="success">Active</Badge>
                      ) : (
                        <Badge tone="neutral">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-ink-muted whitespace-nowrap">
                      {formatDate(threshold.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        )}
      </Card>
    </PageContainer>
  );
}
