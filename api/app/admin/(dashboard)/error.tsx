"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/admin/page-header";

/**
 * Error boundary for the admin area.
 *
 * Shows a plain, actionable message. The underlying exception is never
 * rendered — it could contain a query fragment or participant data — but the
 * `digest` is shown so a user can quote it when reporting the problem, and it
 * correlates with the server log and the Sentry event.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Next.js has already reported this server-side; log the digest only.
    console.error(
      JSON.stringify({
        level: "error",
        event: "admin.render_error",
        digest: error.digest ?? null,
      }),
    );
  }, [error.digest]);

  return (
    <PageContainer>
      <Card className="mx-auto max-w-md p-8 text-center">
        <div className="bg-danger-soft text-danger mx-auto mb-4 w-fit rounded-full p-3">
          <AlertCircle className="size-5" aria-hidden="true" />
        </div>
        <h1 className="text-ink text-base font-semibold">
          Unable to load this page
        </h1>
        <p className="text-ink-muted mt-2 text-[13px] leading-relaxed">
          Something went wrong while fetching the data. This has been recorded.
          Please try again.
        </p>

        <div className="mt-5 flex justify-center gap-2">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload the page
          </Button>
        </div>

        {error.digest ? (
          <p className="text-ink-subtle mt-4 font-mono text-xs">
            Reference: {error.digest}
          </p>
        ) : null}
      </Card>
    </PageContainer>
  );
}
