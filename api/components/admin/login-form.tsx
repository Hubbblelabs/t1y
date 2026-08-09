"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth/client";

/**
 * Credential sign-in.
 *
 * Failures are reported with a single generic message regardless of cause:
 * distinguishing "no such account" from "wrong password" would let an attacker
 * enumerate valid staff email addresses.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const nextPath = safeNext(searchParams.get("next"));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = await signIn.email({ email: email.trim(), password });

      if (result.error) {
        setError(
          result.error.status === 403
            ? "Verify your email address before signing in. Check your inbox for the verification link."
            : "The email address or password is incorrect.",
        );
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Unable to sign in right now. Please try again.");
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

      <div>
        <Field label="Password" htmlFor="password" required>
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={pending}
          />
        </Field>
        <div className="mt-1.5 text-right">
          <Link
            href="/admin/forgot-password"
            className="text-ink-muted hover:text-primary text-xs underline-offset-4 hover:underline"
          >
            Forgot your password?
          </Link>
        </div>
      </div>

      <Button type="submit" variant="primary" className="mt-1 w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}

/**
 * Only same-site relative paths are accepted as a post-login destination —
 * an attacker-supplied `?next=https://evil.example` would otherwise turn the
 * login page into an open redirect.
 */
function safeNext(value: string | null): string {
  if (!value) return "/admin/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/admin/dashboard";
  return value;
}
