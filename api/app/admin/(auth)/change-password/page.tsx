import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { Card } from "@/components/ui/card";
import { getPrincipal } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Choose your password" };

/**
 * Where a new staff member lands after signing in with the temporary password
 * they were given, and where anyone can change theirs later.
 */
export default async function ChangePasswordPage() {
  const principal = await getPrincipal();
  if (!principal) redirect("/admin/login");

  const account = await prisma.user.findUnique({
    where: { id: principal.userId },
    select: { mustChangePassword: true },
  });
  const forced = account?.mustChangePassword ?? false;

  return (
    <Card className="p-6">
      <div className="mb-5">
        <h1 className="text-ink text-base font-semibold">Choose your own password</h1>
        <p className="text-ink-muted mt-1 text-xs">
          {forced
            ? "You signed in with a temporary password. Choose one only you know before you continue."
            : "Pick a password you do not use anywhere else."}
        </p>
      </div>
      <ChangePasswordForm />
    </Card>
  );
}
