import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Digital Diabetes Management Platform",
    template: "%s · Diabetes Platform",
  },
  description:
    "Administration and research dashboard for diabetes self-management tracking.",
  // Nothing in this deployment should ever be indexed.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Zoom must not be disabled — users need to be able to enlarge dense tables.
  maximumScale: 5,
};

/**
 * Resolves the theme before the browser paints.
 *
 * Runs synchronously during HTML parsing, so there is no flash of the wrong
 * theme on a hard load — `useEffect` would paint the default first, and even
 * `useLayoutEffect` only runs once React has hydrated. A saved choice wins;
 * with none, the OS preference is read once and written onto <html> so the
 * stylesheet only ever has to match `[data-theme="dark"]`.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("admin-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
