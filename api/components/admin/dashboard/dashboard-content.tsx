import { RecentActivityPanel } from "@/components/admin/dashboard/recent-activity";
import { Section } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { CategoryBars } from "@/components/charts/trend-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { requirePrincipal } from "@/lib/auth/session";
import { getDashboardCharts, getDashboardOverview } from "@/lib/services/analytics";
import { getCohortProgress } from "@/lib/services/progress";
import { resolveDateRange, type DateRangeInput } from "@/lib/validation/common";
import { formatNumber } from "@/lib/utils/format";

/**
 * Dashboard body — a Server Component, so the aggregate queries run on the
 * server and no participant data is serialised into the client bundle beyond
 * what is rendered.
 *
 * Only "Total participants" and "Active participants" come from
 * `getDashboardOverview`/`getDashboardCharts` here — the rest of what those
 * two return (records logged, medication adherence, glucose trends, exercise
 * minutes, HbA1c results) is health-logging data this study's app has no
 * screens to produce (see api/docs/UNUSED-BACKEND.md); it would only ever
 * render as empty cards and charts. Everything else on this page comes from
 * `getCohortProgress` instead — Help Book and quiz engagement, which is what
 * a coordinator's phone actually generates.
 */
export async function DashboardContent({ range }: { range: DateRangeInput }) {
  const principal = await requirePrincipal();
  const resolved = resolveDateRange(range);

  const [overview, charts, cohort] = await Promise.all([
    getDashboardOverview(principal, resolved),
    getDashboardCharts(principal, resolved, "day"),
    getCohortProgress(),
  ]);

  const topicsCompleted = cohort.topics.reduce((sum, t) => sum + t.completed, 0);
  const topicsOpened = cohort.topics.reduce((sum, t) => sum + t.opened, 0);
  const quizzesWithAttempts = cohort.quizzes.filter((q) => q.attempts > 0);
  const overallPassRate =
    quizzesWithAttempts.length > 0
      ? Math.round(
          quizzesWithAttempts.reduce((sum, q) => sum + (q.passRate ?? 0), 0) /
            quizzesWithAttempts.length,
        )
      : null;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total participants"
          value={formatNumber(overview.participants.total)}
          hint={`${formatNumber(overview.participants.pending)} pending activation`}
        />
        <StatCard
          label="Active participants"
          value={formatNumber(overview.participants.active)}
          delta={overview.participants.newChangePercent}
          deltaLabel="new sign-ups vs previous period"
          deltaMeaning="higher-is-better"
        />
        <StatCard
          label="Topics completed"
          value={formatNumber(topicsCompleted)}
          hint={
            topicsOpened > 0
              ? `${formatNumber(topicsOpened)} opened across the cohort`
              : "No topics opened yet"
          }
        />
        <StatCard
          label="Quiz pass rate"
          value={overallPassRate === null ? null : `${overallPassRate}%`}
          hint={
            quizzesWithAttempts.length > 0
              ? `Across ${quizzesWithAttempts.length} quiz${quizzesWithAttempts.length === 1 ? "" : "zes"} with attempts`
              : "No quiz attempts yet"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {cohort.topics.length === 0 ? (
            <Card className="p-5">
              <EmptyState
                title="No Help Book activity yet"
                description="Topic completions appear here once participants start reading."
              />
            </Card>
          ) : (
            <CategoryBars
              title="Help Book completion"
              description="Topics completed vs. opened, cohort-wide"
              valueLabel="Completed"
              data={cohort.topics.map((t) => ({ label: t.topicSlug, value: t.completed }))}
            />
          )}
        </div>

        <div className="lg:col-span-2">
          <RecentActivityPanel entries={charts.recentActivity} />
        </div>
      </div>

      <Section title="Quiz performance" description="Attempts and pass rate per quiz">
        <Card>
          {cohort.quizzes.length === 0 ? (
            <EmptyState
              title="No quizzes published yet"
              description="Quiz performance appears here once quizzes are published and attempted."
            />
          ) : (
            <ul className="divide-line divide-y">
              {cohort.quizzes.map((quiz) => (
                <li
                  key={`${quiz.slug}-${quiz.locale}`}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-ink truncate text-[13px] font-medium">{quiz.title}</p>
                    <p className="text-ink-subtle text-xs">
                      {formatNumber(quiz.attempts)} attempt{quiz.attempts === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Badge tone="neutral" className="tabular">
                    {quiz.passRate === null ? "—" : `${quiz.passRate}% passed`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Section>
    </div>
  );
}

export function DashboardHeadingCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
