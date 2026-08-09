"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { requestPasswordReset, resetPassword } from "@/lib/auth/client";

const MIN_PASSWORD_LENGTH = 12;

/**
 * Requests a reset link.
 *
 * Always reports success, whether or not the address exists. Confirming which
 * addresses are registered would leak the staff directory.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    try {
      await requestPasswordReset({
        email: email.trim(),
        redirectTo: "/admin/reset-password",
      });
    } catch {
      // Swallowed deliberately — see the note above.
    } finally {
      setPending(false);
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-success-soft text-success flex items-start gap-2 rounded-md p-3 text-[13px]">
          <CheckCircle2 className="mt-px size-4 shrink-0" aria-hidden="true" />
          <span>
            If an account exists for that address, a reset link is on its way. The
            link expires in one hour.
          </span>
        </div>
        <Button variant="secondary" asChild className="w-full">
          <Link href="/admin/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Email address" htmlFor="email" required>
        <Input
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending}
        />
      </Field>

      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Sending…
          </>
        ) : (
          "Send reset link"
        )}
      </Button>

      <Link
        href="/admin/login"
        className="text-ink-muted hover:text-primary text-center text-xs underline-offset-4 hover:underline"
      >
        Back to sign in
      </Link>
    </form>
  );
}

/** Sets a new password from an emailed token. */
export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  if (!token) {
    return (
      <div
        role="alert"
        className="bg-danger-soft text-danger flex items-start gap-2 rounded-md p-3 text-[13px]"
      >
        <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
        <span>
          This reset link is invalid or has expired. Request a new one from the{" "}
          <Link href="/admin/forgot-password" className="underline">
            forgot password
          </Link>{" "}
          page.
        </span>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmation) {
      setError("The two passwords do not match.");
      return;
    }

    setPending(true);
    try {
      const result = await resetPassword({ newPassword: password, token: token! });
      if (result.error) {
        setError("This reset link is invalid or has expired. Request a new one.");
        return;
      }
      router.push("/admin/login?reset=1");
    } catch {
      setError("Unable to reset your password right now. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {error ? (
        <div
          role="alert"
          className="bg-danger-soft text-danger flex items-start gap-2 rounded-md p-3 text-[13px]"
        >
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <Field
        label="New password"
        htmlFor="password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        required
      >
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
        />
      </Field>

      <Field label="Confirm new password" htmlFor="confirmation" required>
        <Input
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          disabled={pending}
        />
      </Field>

      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Saving…
          </>
        ) : (
          "Set new password"
        )}
      </Button>
    </form>
  );
}
