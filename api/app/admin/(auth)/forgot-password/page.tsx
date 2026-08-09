import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/admin/password-forms";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <Card className="p-6">
      <div className="mb-5">
        <h1 className="text-ink text-base font-semibold">Reset your password</h1>
        <p className="text-ink-muted mt-1 text-[13px]">
          Enter your email address and we will send you a link to choose a new
          password.
        </p>
      </div>
      <ForgotPasswordForm />
    </Card>
  );
}
