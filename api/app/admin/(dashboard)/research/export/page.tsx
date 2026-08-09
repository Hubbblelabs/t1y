import type { Metadata } from "next";

import { ExportForm } from "@/components/admin/research/export-form";
import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { UnauthorizedState } from "@/components/ui/states";
import { requirePrincipal } from "@/lib/auth/session";
import { canExportResearchData, exportableStudyIds } from "@/lib/permissions/policies";
import { listStudies } from "@/lib/services/research";

export const metadata: Metadata = { title: "Data export" };

/**
 * Research data export.
 *
 * Only studies the caller may export from are offered. The capability is
 * re-checked in the API route — the form merely avoids presenting options that
 * would be rejected.
 */
export default async function ExportPage() {
  const principal = await requirePrincipal();

  if (!(await canExportResearchData(principal))) {
    return (
      <PageContainer>
        <UnauthorizedState detail="Your account does not have permission to export research data." />
      </PageContainer>
    );
  }

  const allowedIds = await exportableStudyIds(principal);
  const { items } = await listStudies(principal, { skip: 0, take: 100 });
  const studies = items
    .filter((study) => allowedIds.includes(study.id))
    .map((study) => ({ id: study.id, code: study.code, title: study.title }));

  return (
    <PageContainer>
      <PageHeader
        title="Data export"
        description="Generate a pseudonymised research extract"
        breadcrumbs={[{ label: "Research" }, { label: "Data export" }]}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="p-5">
          <ExportForm studies={studies} />
        </Card>

        <Card className="p-5">
          <h2 className="text-ink mb-2 text-sm font-semibold">What is included</h2>
          <ul className="text-ink-muted space-y-2 text-[13px] leading-relaxed">
            <li>
              Rows are keyed by the study participant code. Names, email
              addresses, phone numbers and dates of birth are never included.
            </li>
            <li>
              Every export is recorded in the audit trail with the dataset, the
              period and the account that requested it.
            </li>
            <li>
              Extracts are capped at 50,000 rows. Narrow the period if a dataset
              is reported as truncated.
            </li>
          </ul>
        </Card>
      </div>
    </PageContainer>
  );
}
