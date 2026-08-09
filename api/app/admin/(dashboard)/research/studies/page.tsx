import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SearchBox } from "@/components/admin/search-box";
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
import { requirePrincipal } from "@/lib/auth/session";
import { canManageStudies } from "@/lib/permissions/policies";
import { listStudies } from "@/lib/services/research";
import { formatDate, formatNumber, humaniseEnum } from "@/lib/utils/format";
import { studyListQuerySchema } from "@/lib/validation/admin";

export const metadata: Metadata = { title: "Studies" };

/**
 * Research studies.
 *
 * `listStudies` filters to the studies the caller holds access to, so a
 * researcher's list is their own — the page does not need to filter again.
 */
export default async function StudiesPage(
  props: PageProps<"/admin/research/studies">,
) {
  const searchParams = await props.searchParams;
  const principal = await requirePrincipal();

  const parsed = studyListQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : studyListQuerySchema.parse({});

  const { items, total } = await listStudies(principal, {
    status: query.status,
    search: query.search,
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });

  const pagination = buildPagination(query.page, query.pageSize, total);

  return (
    <PageContainer>
      <PageHeader
        title="Studies"
        description="Research studies and their enrolment"
        breadcrumbs={[{ label: "Research" }, { label: "Studies" }]}
      />

      <Card>
        <div className="border-line border-b p-4">
          <SearchBox placeholder="Search by title or code" />
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title={query.search ? "No studies match your search" : "No studies yet"}
            description={
              query.search
                ? "Try a different search term."
                : canManageStudies(principal)
                  ? "Create a study to begin enrolling participants and collecting research data."
                  : "You have not been granted access to any studies. Contact an administrator."
            }
          />
        ) : (
          <>
            <TableScroll label="Studies">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Enrolled</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead>Principal investigator</TableHead>
                    <TableHead>Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((study) => (
                    <TableRow key={study.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/research/studies/${study.id}`}
                          className="hover:text-primary underline-offset-4 hover:underline"
                        >
                          {study.code}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-72 truncate">{study.title}</TableCell>
                      <TableCell>
                        <Badge
                          tone={
                            study.status === "ACTIVE"
                              ? "success"
                              : study.status === "RECRUITING"
                                ? "info"
                                : "neutral"
                          }
                        >
                          {humaniseEnum(study.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatNumber(study._count.participants)}
                      </TableCell>
                      <TableCell className="text-ink-muted tabular text-right">
                        {study.targetEnrollment ? formatNumber(study.targetEnrollment) : "—"}
                      </TableCell>
                      <TableCell className="text-ink-muted max-w-48 truncate">
                        {study.principalInvestigator ?? "—"}
                      </TableCell>
                      <TableCell className="text-ink-muted whitespace-nowrap">
                        {study.startDate ? formatDate(study.startDate) : "—"}
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
