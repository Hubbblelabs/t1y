import Link from "next/link";

import { DataPoint } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { getParticipantProfile } from "@/lib/services/participants";
import { formatDate, formatNumber, humaniseEnum } from "@/lib/utils/format";

type Participant = Awaited<ReturnType<typeof getParticipantProfile>>;

/**
 * Profile, diabetes information and study enrolments.
 *
 * Contact details appear here because an administrator managing a participant
 * legitimately needs them; the research export deliberately carries none of it.
 */
export function ParticipantProfileCard({ participant }: { participant: Participant }) {
  const profile = participant.profile;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="text-ink mb-3 text-sm font-semibold">Profile</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <DataPoint label="Participant ID" value={profile?.participantCode} />
          <DataPoint label="Status" value={humaniseEnum(participant.status)} />
          <DataPoint
            label="Date of birth"
            value={profile?.dateOfBirth ? formatDate(profile.dateOfBirth) : null}
          />
          <DataPoint label="Sex" value={humaniseEnum(profile?.sex)} />
          <DataPoint label="Phone" value={profile?.phone} />
          <DataPoint
            label="Location"
            value={[profile?.city, profile?.country].filter(Boolean).join(", ") || null}
          />
          <DataPoint label="Time zone" value={participant.timezone} />
          <DataPoint label="Joined" value={formatDate(participant.createdAt)} />
          <DataPoint
            label="Email verified"
            value={participant.emailVerified ? "Yes" : "No"}
          />
          <DataPoint
            label="Onboarded"
            value={profile?.onboardedAt ? formatDate(profile.onboardedAt) : "Not completed"}
          />
        </dl>
      </Card>

      <Card className="p-5">
        <h2 className="text-ink mb-3 text-sm font-semibold">Diabetes information</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <DataPoint label="Type" value={humaniseEnum(profile?.diabetesType)} />
          <DataPoint label="Diagnosed" value={profile?.diagnosisYear} />
          <DataPoint
            label="Treatment"
            value={humaniseEnum(profile?.treatmentModality)}
            className="col-span-2"
          />
          <DataPoint
            label="Height"
            value={profile?.heightCm ? formatNumber(profile.heightCm, { unit: "cm" }) : null}
          />
          <DataPoint
            label="Baseline weight"
            value={
              profile?.baselineWeightKg
                ? formatNumber(profile.baselineWeightKg, { decimals: 1, unit: "kg" })
                : null
            }
          />
          <DataPoint
            label="Primary clinician"
            value={profile?.primaryClinician}
            className="col-span-2"
          />
        </dl>
      </Card>

      <Card className="p-5">
        <h2 className="text-ink mb-3 text-sm font-semibold">Records</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <DataPoint
            label="Glucose readings"
            value={formatNumber(participant._count.glucoseReadings)}
          />
          <DataPoint label="Medications" value={formatNumber(participant._count.medications)} />
          <DataPoint
            label="Insulin records"
            value={formatNumber(participant._count.insulinLogs)}
          />
          <DataPoint label="Meals" value={formatNumber(participant._count.meals)} />
          <DataPoint
            label="Exercise sessions"
            value={formatNumber(participant._count.exerciseLogs)}
          />
          <DataPoint label="HbA1c results" value={formatNumber(participant._count.hba1cRecords)} />
        </dl>
      </Card>

      <Card className="p-5">
        <h2 className="text-ink mb-3 text-sm font-semibold">Research</h2>
        {participant.studyEnrollments.length === 0 ? (
          <p className="text-ink-subtle text-[13px]">Not enrolled in any study.</p>
        ) : (
          <ul className="space-y-3">
            {participant.studyEnrollments.map((enrollment) => (
              <li key={enrollment.id} className="border-line border-l-2 pl-3">
                <Link
                  href={`/admin/research/studies/${enrollment.study.id}`}
                  className="text-ink hover:text-primary text-[13px] font-medium underline-offset-4 hover:underline"
                >
                  {enrollment.study.code}
                </Link>
                <p className="text-ink-muted truncate text-xs">{enrollment.study.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral">{humaniseEnum(enrollment.enrollmentStatus)}</Badge>
                  {enrollment.armOrGroup ? (
                    <Badge tone="neutral">{enrollment.armOrGroup}</Badge>
                  ) : null}
                </div>
                <p className="text-ink-subtle mt-1 text-xs">
                  Study ID: {enrollment.studyParticipantCode}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
