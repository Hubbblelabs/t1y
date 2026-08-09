import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer, PageHeader, Section } from "@/components/admin/page-header";
import { DataPoint } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSettings } from "@/lib/services/settings";
import { listThresholds } from "@/lib/services/thresholds";
import { isEmailConfigured, isStorageConfigured } from "@/lib/env";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Settings" };

/**
 * Platform settings.
 *
 * Clinical thresholds are shown here but managed on their own page — they are
 * not ordinary configuration, and grouping them with defaults would understate
 * that they need clinical sign-off.
 */
export default async function SettingsPage() {
  const [settings, thresholds] = await Promise.all([
    getSettings(),
    listThresholds({ includeInactive: false }),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Platform defaults and integration status"
      />

      <Section title="Platform defaults">
        <Card className="p-5">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <DataPoint label="Platform name" value={settings["platform.name"]} />
            <DataPoint
              label="Support email"
              value={settings["platform.supportEmail"] || null}
            />
            <DataPoint label="Default time zone" value={settings["platform.defaultTimezone"]} />
            <DataPoint
              label="Default glucose unit"
              value={settings["platform.defaultGlucoseUnit"] === "MG_DL" ? "mg/dL" : "mmol/L"}
            />
            <DataPoint
              label="Inactivity threshold"
              value={`${settings["participants.inactivityDays"]} days`}
            />
            <DataPoint
              label="Adherence window"
              value={`${settings["reports.adherenceWindowDays"]} days`}
            />
            <DataPoint
              label="Quiet hours"
              value={`${settings["notifications.quietHoursStart"]} – ${settings["notifications.quietHoursEnd"]}`}
            />
            <DataPoint
              label="Health values in notifications"
              value={
                settings["notifications.allowHealthValuesInBody"] ? "Allowed" : "Blocked"
              }
            />
            <DataPoint
              label="Export row limit"
              value={settings["exports.maxRows"].toLocaleString("en-GB")}
            />
          </dl>
        </Card>
      </Section>

      <Section
        title="Clinical thresholds"
        description="Target ranges shown alongside recorded values. The platform ships with none — every threshold is entered by a clinician and carries its source."
        actions={
          <Button variant="secondary" size="sm" asChild>
            <Link href="/admin/thresholds">Manage thresholds</Link>
          </Button>
        }
      >
        <Card className="p-5">
          {thresholds.length === 0 ? (
            <p className="text-ink-muted text-[13px]">
              No thresholds are configured. Recorded values are displayed without a
              reference range until a clinical reviewer defines one.
            </p>
          ) : (
            <ul className="divide-line divide-y">
              {thresholds.slice(0, 8).map((threshold) => (
                <li
                  key={threshold.id}
                  className="flex flex-wrap items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-ink text-[13px] font-medium">{threshold.label}</p>
                    <p className="text-ink-subtle text-xs">
                      {threshold.key} · {threshold.source}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{threshold.scope.toLowerCase()}</Badge>
                    <span className="text-ink tabular text-[13px]">
                      {threshold.lowValue ?? "—"}–{threshold.highValue ?? "—"}{" "}
                      {threshold.unit}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Section>

      <Section
        title="Integrations"
        description="Configured through environment variables, not through this interface"
      >
        <Card className="p-5">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
            <DataPoint
              label="Transactional email (Resend)"
              value={
                isEmailConfigured() ? (
                  <Badge tone="success">Configured</Badge>
                ) : (
                  <Badge tone="warning">Not configured</Badge>
                )
              }
            />
            <DataPoint
              label="Object storage (Cloudflare R2)"
              value={
                isStorageConfigured() ? (
                  <Badge tone="success">Configured</Badge>
                ) : (
                  <Badge tone="warning">Not configured</Badge>
                )
              }
            />
            <DataPoint
              label="Error monitoring (Sentry)"
              value={
                process.env.SENTRY_DSN ? (
                  <Badge tone="success">Configured</Badge>
                ) : (
                  <Badge tone="warning">Not configured</Badge>
                )
              }
            />
          </dl>
        </Card>
      </Section>
    </PageContainer>
  );
}
