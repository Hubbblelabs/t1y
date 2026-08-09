import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/admin/login-form";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/states";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Card className="p-6">
      <div className="mb-5">
        <h1 className="text-ink text-base font-semibold">Sign in</h1>
        <p className="text-ink-muted mt-1 text-[13px]">
          Use your administrator, researcher or clinical reviewer account.
        </p>
      </div>

      {/* The form reads `?next=` from the URL, which requires a Suspense
          boundary around the client component that calls useSearchParams. */}
      <Suspense fallback={<Skeleton className="h-56 w-full" />}>
        <LoginForm />
      </Suspense>
    </Card>
  );
}
