import { Section } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from "@/components/ui/table";
import { listPublishedEducation } from "@/lib/services/education";
import { listProgressForUser } from "@/lib/services/progress";
import { formatDate, formatNumber, humaniseEnum } from "@/lib/utils/format";

/**
 * A participant's Help Book and quiz activity — what this study's app
 * actually produces.
 *
 * This replaces a previous panel (Glucose/Medication/Insulin/Nutrition/
 * Exercise/HbA1c/Health metrics) that always rendered empty: the Flutter
 * app has no logging screens at all, v1 is curriculum + calculators +
 * quizzes only (see api/docs/UNUSED-BACKEND.md). A coordinator opening a
 * participant's page was shown seven sections of "no data yet" for
 * something the app was never going to produce.
 */
export async function ParticipantEngagement({ userId }: { userId: string }) {
  const [{ topics, attempts }, education] = await Promise.all([
    listProgressForUser(userId),
    listPublishedEducation({ locale: "EN", skip: 0, take: 100 }),
  ]);

  const titleBySlug = new Map(education.items.map((item) => [item.slug, item.title]));
  const completedCount = topics.filter((t) => t.completedAt !== null).length;
  const totalSeconds = topics.reduce((sum, t) => sum + t.secondsSpent, 0);
  const passedAttempts = attempts.filter((a) => a.passed === true).length;
  const completedAttempts = attempts.filter((a) => a.completedAt !== null).length;

  return (
    <div className="space-y-8">
      <Section title="Help Book" description={`${education.total} topics published`}>
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Topics opened" value={formatNumber(topics.length)} />
          <StatCard label="Topics completed" value={formatNumber(completedCount)} />
          <StatCard
            label="Time spent"
            value={totalSeconds > 0 ? Math.round(totalSeconds / 60) : null}
            unit="min"
          />
          <StatCard
            label="Completion"
            value={
              topics.length > 0 ? `${Math.round((completedCount / topics.length) * 100)}%` : null
            }
          />
        </div>

        <Card>
          {topics.length === 0 ? (
            <EmptyState
              title="No topics opened yet"
              description="Topics this participant reads appear here."
            />
          ) : (
            <TableScroll label="Topic progress">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Opened</TableHead>
                    <TableHead className="text-right">Last read</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topics.map((topic) => (
                    <TableRow key={topic.id}>
                      <TableCell className="font-medium">
                        {titleBySlug.get(topic.topicSlug) ?? humaniseEnum(topic.topicSlug)}
                      </TableCell>
                      <TableCell>
                        <Badge tone={topic.completedAt ? "success" : "neutral"}>
                          {topic.completedAt ? "Completed" : "In progress"}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular text-right">{topic.openCount}</TableCell>
                      <TableCell className="text-ink-muted tabular text-right whitespace-nowrap">
                        {formatDate(topic.lastOpenedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          )}
        </Card>
      </Section>

      <Section title="Quizzes" description="All attempts">
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Attempts" value={formatNumber(attempts.length)} />
          <StatCard label="Completed" value={formatNumber(completedAttempts)} />
          <StatCard label="Passed" value={formatNumber(passedAttempts)} />
          <StatCard
            label="Pass rate"
            value={
              completedAttempts > 0
                ? `${Math.round((passedAttempts / completedAttempts) * 100)}%`
                : null
            }
          />
        </div>

        <Card>
          {attempts.length === 0 ? (
            <EmptyState
              title="No quiz attempts yet"
              description="Attempts this participant makes appear here."
            />
          ) : (
            <TableScroll label="Quiz attempts">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quiz</TableHead>
                    <TableHead className="text-right">Attempt</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="text-right">Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell className="font-medium">{attempt.quiz.title}</TableCell>
                      <TableCell className="tabular text-right">
                        {attempt.attemptNumber}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {attempt.scorePercent === null ? "—" : `${attempt.scorePercent}%`}
                      </TableCell>
                      <TableCell>
                        {attempt.passed === null ? (
                          <Badge tone="neutral">In progress</Badge>
                        ) : (
                          <Badge tone={attempt.passed ? "success" : "danger"}>
                            {attempt.passed ? "Passed" : "Not passed"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-ink-muted tabular text-right whitespace-nowrap">
                        {formatDate(attempt.startedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          )}
        </Card>
      </Section>
    </div>
  );
}
