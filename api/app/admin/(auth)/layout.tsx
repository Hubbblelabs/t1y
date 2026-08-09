import { Activity } from "lucide-react";

/**
 * Layout for the signed-out authentication pages.
 *
 * A single centred column — no navigation, nothing that hints at the contents
 * of the platform before the visitor is authenticated.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-canvas flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex items-center justify-center gap-2.5">
          <span className="bg-primary text-ink-inverse flex size-8 items-center justify-center rounded-md">
            <Activity className="size-4.5" aria-hidden="true" />
          </span>
          <span className="text-ink text-base font-semibold">Diabetes Platform</span>
        </div>

        {children}

        <p className="text-ink-subtle mt-6 text-center text-xs leading-relaxed">
          This system contains confidential health information. Access is
          monitored and recorded.
        </p>
      </div>
    </div>
  );
}
