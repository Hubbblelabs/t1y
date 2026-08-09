import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SearchBox } from "@/components/admin/search-box";
import { StatusBadge } from "@/components/admin/participants/participant-table";
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
import { listStaff } from "@/lib/services/admins";
import { ROLE_LABELS } from "@/lib/permissions/roles";
import { formatDate, formatNumber, formatRelative } from "@/lib/utils/format";
import { staffListQuerySchema } from "@/lib/validation/admin";

export const metadata: Metadata = { title: "Administrators" };

/**
 * Staff accounts. Reachable only by a super administrator — the layout's
 * navigation hides it and the API rejects everyone else.
 */
export default async function AdministratorsPage(
  props: PageProps<"/admin/administrators">,
) {
  const searchParams = await props.searchParams;
  const parsed = staffListQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : staffListQuerySchema.parse({});

  const { items, total } = await listStaff({
    role: query.role,
    status: query.status,
    search: query.search,
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });

  const pagination = buildPagination(query.page, query.pageSize, total);

  return (
    <PageContainer>
      <PageHeader
        title="Administrators"
        description="Staff accounts and their roles"
      />

      <Card className="mb-6 p-4">
        <p className="text-ink-muted text-[13px] leading-relaxed">
          New staff accounts are created without a password. The invitee receives
          a link and sets their own credentials, so no administrator ever knows
          another person&rsquo;s password. Deactivating an account revokes its
          sessions immediately but preserves its audit history.
        </p>
      </Card>

      <Card>
        <div className="border-line border-b p-4">
          <SearchBox placeholder="Search by name or email" />
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={query.search ? "No accounts match your search" : "No staff accounts"}
            description={
              query.search
                ? "Try a different search term."
                : "Invite an administrator, researcher or clinical reviewer to get started."
            }
          />
        ) : (
          <>
            <TableScroll label="Staff accounts">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Study access</TableHead>
                    <TableHead>Last sign-in</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((staff) => (
                    <TableRow key={staff.id}>
                      <TableCell className="font-medium">{staff.name}</TableCell>
                      <TableCell className="text-ink-muted max-w-56 truncate">
                        {staff.email}
                        {!staff.emailVerified ? (
                          <Badge tone="warning" className="ml-2">
                            Unverified
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge tone={staff.role === "SUPER_ADMIN" ? "primary" : "neutral"}>
                          {ROLE_LABELS[staff.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={staff.status} />
                      </TableCell>
                      <TableCell className="text-ink-muted max-w-40 truncate">
                        {staff.adminUser?.department ?? "—"}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatNumber(staff._count.studyAccess)}
                      </TableCell>
                      <TableCell className="text-ink-muted whitespace-nowrap">
                        {staff.lastLoginAt ? formatRelative(staff.lastLoginAt) : "Never"}
                      </TableCell>
                      <TableCell className="text-ink-muted whitespace-nowrap">
                        {formatDate(staff.createdAt)}
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
