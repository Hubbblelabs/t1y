import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { DataPoint } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePrincipal } from "@/lib/auth/session";
import { capabilitiesFor, ROLE_LABELS } from "@/lib/permissions/roles";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, humaniseEnum } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Your account" };

/**
 * The signed-in user's own account.
 *
 * Shows the capabilities their role grants, which makes the permission model
 * legible rather than something a user has to infer from which menu items
 * appear.
 */
export default async function AccountPage() {
  const principal = await requirePrincipal();

  const [account, sessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: principal.userId },
      select: {
        name: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true,
        adminUser: {
          select: { jobTitle: true, department: true, organization: true, phone: true },
        },
      },
    }),
    prisma.session.count({ where: { userId: principal.userId } }),
  ]);

  const capabilities = capabilitiesFor(principal.role);

  return (
    <PageContainer>
      <PageHeader title="Your account" description="Your profile and access level" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-ink mb-3 text-sm font-semibold">Profile</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
            <DataPoint label="Name" value={account?.name} />
            <DataPoint label="Email" value={account?.email} className="col-span-1" />
            <DataPoint label="Role" value={ROLE_LABELS[principal.role]} />
            <DataPoint
              label="Email verified"
              value={
                account?.emailVerified ? (
                  <Badge tone="success">Verified</Badge>
                ) : (
                  <Badge tone="warning">Not verified</Badge>
                )
              }
            />
            <DataPoint label="Job title" value={account?.adminUser?.jobTitle} />
            <DataPoint label="Department" value={account?.adminUser?.department} />
            <DataPoint
              label="Last sign-in"
              value={account?.lastLoginAt ? formatDateTime(account.lastLoginAt) : null}
            />
            <DataPoint label="Active sessions" value={sessions} />
          </dl>

          <div className="border-line mt-5 border-t pt-4">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/admin/forgot-password">Change your password</Link>
            </Button>
            <p className="text-ink-subtle mt-2 text-xs">
              You will receive an email with a link to set a new password.
            </p>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-ink mb-1 text-sm font-semibold">What your role permits</h2>
          <p className="text-ink-muted mb-3 text-xs">
            These permissions are enforced by the server on every request, not
            only by what appears in the navigation.
          </p>

          {capabilities.length === 0 ? (
            <p className="text-ink-muted text-[13px]">
              This account holds no administrative permissions.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {capabilities.map((capability) => (
                <li key={capability}>
                  <Badge tone="neutral">{humaniseEnum(capability.replace(/[:-]/g, " "))}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
