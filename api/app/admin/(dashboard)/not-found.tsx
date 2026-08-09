import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { PageContainer } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Shown for a record that does not exist — or that the caller may not see.
 *
 * The wording is deliberately the same in both cases: telling an unauthorised
 * user that a record exists but is off-limits would confirm its existence.
 */
export default function AdminNotFound() {
  return (
    <PageContainer>
      <Card className="mx-auto max-w-md p-8 text-center">
        <div className="bg-surface-sunken text-ink-subtle mx-auto mb-4 w-fit rounded-full p-3">
          <FileQuestion className="size-5" aria-hidden="true" />
        </div>
        <h1 className="text-ink text-base font-semibold">Not found</h1>
        <p className="text-ink-muted mt-2 text-[13px] leading-relaxed">
          This record does not exist, or is not available to your account.
        </p>
        <Button variant="secondary" asChild className="mt-5">
          <Link href="/admin/dashboard">Back to the dashboard</Link>
        </Button>
      </Card>
    </PageContainer>
  );
}
