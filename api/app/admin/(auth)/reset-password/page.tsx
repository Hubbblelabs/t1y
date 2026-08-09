import type { Metadata } from "next";
import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/admin/password-forms";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/states";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <Card className="p-6">
      <div className="mb-5">
        <h1 className="text-ink text-base font-semibold">Choose a new password</h1>
        <p className="text-ink-muted mt-1 text-[13px]">
          Pick a password you do not use anywhere else.
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-56 w-full" />}>
        <ResetPasswordForm />
      </Suspense>
    </Card>
  );
}
