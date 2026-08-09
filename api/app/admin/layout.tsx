import type { Metadata } from "next";

/**
 * Shared metadata for everything under /admin.
 *
 * Deliberately does no authentication: the login and password-reset pages live
 * in the `(auth)` group and must render for signed-out visitors. The
 * authenticated shell and its access check live in `(dashboard)/layout.tsx`.
 */
export const metadata: Metadata = {
  title: { default: "Administration", template: "%s · Diabetes Platform" },
  // Health-data surfaces must never be indexed.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
