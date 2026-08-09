import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { DateRangePicker } from "@/components/admin/date-range-picker";
import { PageContainer, PageHeader, Section } from "@/components/admin/page-header";
import { DataPoint, StatCard } from "@/components/admin/stat-card";
import { CategoryBars } from "@/components/charts/trend-charts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, UnauthorizedState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from "@/components/ui/table";
import { NotFoundError } from "@/lib/api/errors";
import { requirePrincipal } from "@/lib/auth/session";
import { canViewStudy } from "@/lib/permissions/policies";
import {
  getStudy,
  getStudyAnalytics,
  listStudyParticipants,
} from "@/lib/services/research";
import { formatDate, formatNumber, formatPercent, humaniseEnum } from "@/lib/utils/format";
import { dateRangeSchema, resolveDateRange } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Study" };

/**
 * Study detail: enrolment, data completeness and the participant roster.
 *
 * Participants are listed by their study pseudonym, which is what appears in
 * exports — keeping the research view aligned with the research dataset.
 */
export default async function StudyDetailPage(
  props: PageProps<"/admin/research/studies/[id]">,
) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const principal = await requirePrincipal();

  if (!(await canViewStudy(principal, id))) {
    return (
      <PageContainer>
        <UnauthorizedState detail="You have not been granted access to this study." />
      </PageContainer>
    );
  }

  let study: Awaited<ReturnType<typeof getStudy>>;
  try {
    study = await getStudy(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const parsed = dateRangeSchema.safeParse(searchParams);
  const { from, to } = resolveDateRange(parsed.success ? parsed.data : { range: "30d" });

  const [analytics, roster] = await Promise.all([
    getStudyAnalytics({ studyId: id, from, to }),
    listStudyParticipants({ studyId: id, skip: 0, take: 25 }),
  ]);

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: "Research" },
          { label: "Studies", href: "/admin/research/studies" },
          { label: study.code },
        ]}
        title={study.title}
        description={study.objective ?? study.description ?? undefined}
        actions={
          <>
            <Badge tone={study.status === "ACTIVE" ? "success" : "neutral"}>
              {humaniseEnum(study.status)}
            </Badge>
            <DateRangePicker />
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Enrolled"
          value={formatNumber(analytics.enrollment.total)}
          hint={
            analytics.enrollment.targetEnrollment
              ? `${formatPercent(analytics.enrollment.progressPercent, 0)} of target ${analytics.enrollment.targetEnrollment}`
              : "No enrolment target set"
          }
        />
        <StatCard
          label="Medication adherence"
          value={formatPercent(analytics.adherencePercent, 1)}
          hint="Across enrolled participants"
        />
        <StatCard
          label="Glucose readings"
          value={analytics.measurementFrequency.glucoseReadingsPerParticipantPerDay}
          unit="/participant/day"
        />
        <StatCard
          label="Days observed"
          value={formatNumber(analytics.measurementFrequency.daysObserved)}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="text-ink mb-3 text-sm font-semibold">Study information</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
            <DataPoint label="Code" value={study.code} />
            <DataPoint label="Status" value={humaniseEnum(study.status)} />
            <DataPoint
              label="Principal investigator"
              value={study.principalInvestigator}
              className="col-span-2"
            />
            <DataPoint label="IRB number" value={study.irbNumber} />
            <DataPoint label="Consent version" value={study.consentVersion} />
            <DataPoint
              label="Start date"
              value={study.startDate ? formatDate(study.startDate) : null}
            />
            <DataPoint
              label="End date"
              value={study.endDate ? formatDate(study.endDate) : null}
            />
            <DataPoint
              label="Data in scope"
              value={
                study.dataPoints.length > 0
                  ? study.dataPoints.map(humaniseEnum).join(", ")
                  : null
              }
              className="col-span-2"
            />
          </dl>
        </Card>

        <div className="lg:col-span-2">
          <CategoryBars
            title="Data completeness"
            description="Share of enrolled participants contributing data in each domain"
            valueLabel="Participants"
            data={analytics.dataCompleteness.map((entry) => ({
              label: `${humaniseEnum(entry.domain)} (${entry.completenessPercent}%)`,
              value: entry.participantsWithData,
            }))}
          />
        </div>
      </div>

      <Section
        title="Enrolment"
        description={`${analytics.enrollment.total} participants across all statuses`}
      >
        <Card>
          {roster.items.length === 0 ? (
            <EmptyState
              title="No participants enrolled"
              description="Enrol participants to begin collecting data for this study."
            />
          ) : (
            <TableScroll label="Study participants">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Study ID</TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Consent</TableHead>
                    <TableHead>Enrolled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.items.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell className="font-medium">
                        {enrollment.studyParticipantCode}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/participants/${enrollment.user.id}`}
                          className="hover:text-primary underline-offset-4 hover:underline"
                        >
                          {enrollment.user.profile?.participantCode ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          tone={
                            enrollment.enrollmentStatus === "ACTIVE" ||
                            enrollment.enrollmentStatus === "ENROLLED"
                              ? "success"
                              : enrollment.enrollmentStatus === "WITHDRAWN"
                                ? "danger"
                                : "neutral"
                          }
                        >
                          {humaniseEnum(enrollment.enrollmentStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-ink-muted">
                        {enrollment.armOrGroup ?? "—"}
                      </TableCell>
                      <TableCell className="text-ink-muted whitespace-nowrap">
                        {enrollment.consentGivenAt
                          ? formatDate(enrollment.consentGivenAt)
                          : "Not recorded"}
                      </TableCell>
                      <TableCell className="text-ink-muted whitespace-nowrap">
                        {enrollment.enrolledAt ? formatDate(enrollment.enrolledAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          )}
        </Card>
      </Section>
    </PageContainer>
  );
}
