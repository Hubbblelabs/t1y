import type { Metadata } from "next";

import { Poppins } from "next/font/google";

import { GuardianEntry } from "@/components/guardian/guardian-entry";

// The same typeface as the app, so the page reads as the same product.
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: "Record readings",
  // A one-time private link — never indexed, and the URL must not leak
  // onward as a referrer.
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/**
 * The guardian's page, opened from the link a parent shares from the app.
 * Public by design: the link plus the 6-digit code are the credential (see
 * lib/services/guardian-shares.ts).
 */
export default async function GuardianPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  return (
    <div className={poppins.className}>
      <GuardianEntry token={token} />
    </div>
  );
}
