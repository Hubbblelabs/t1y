import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "No access" };

/**
 * Shown when a signed-in account has no administrative capability — a
 * participant, typically, who reached the dashboard by following a link.
 *
 * States the situation plainly and offers no detail about what exists behind
 * the boundary.
 */
export default function NoAccessPage() {
  return (
    <Card className="p-6 text-center">
      <h1 className="text-ink text-base font-semibold">
        This account cannot access the dashboard
      </h1>
      <p className="text-ink-muted mt-2 text-[13px] leading-relaxed">
        The administration dashboard is for platform staff. If you are a study
        participant, please use the mobile application. If you believe you should
        have access, contact your administrator.
      </p>
      <Button variant="secondary" asChild className="mt-5 w-full">
        <Link href="/admin/login">Sign in with a different account</Link>
      </Button>
    </Card>
  );
}
