import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { DiabetesType, TreatmentModality } from "@/generated/prisma/enums";
import { NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { nextParticipantCode } from "@/lib/services/participants";

/**
 * The authenticated user's own account and profile.
 *
 * Everything returned here belongs to the caller, so there is no scoping to
 * apply — but note what is *not* selected: no password hash, no session token,
 * no internal flags.
 */

const ME_SELECT = {
  id: true,
  email: true,
  name: true,
  emailVerified: true,
  role: true,
  status: true,
  timezone: true,
  locale: true,
  image: true,
  createdAt: true,
  profile: {
    select: {
      participantCode: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      sex: true,
      phone: true,
      city: true,
      country: true,
      diabetesType: true,
      diagnosisYear: true,
      treatmentModality: true,
      heightCm: true,
      baselineWeightKg: true,
      primaryClinician: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      onboardedAt: true,
      lastActivityAt: true,
    },
  },
} satisfies Prisma.UserSelect;

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: ME_SELECT,
  });
  if (!user) throw new NotFoundError("Account");
  return user;
}

export interface UpdateMeInput {
  name?: string;
  timezone?: string;
  locale?: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: Date | null;
    sex?: "FEMALE" | "MALE" | "INTERSEX" | "PREFER_NOT_TO_SAY" | "UNSPECIFIED";
    phone?: string | null;
    city?: string | null;
    country?: string | null;
    diabetesType?: DiabetesType;
    diagnosisYear?: number | null;
    treatmentModality?: TreatmentModality;
    heightCm?: number | null;
    baselineWeightKg?: number | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
  };
}

/**
 * Updates the caller's account. `role`, `status` and `email` are deliberately
 * not updatable here — role changes go through the administrators module, and
 * an email change would need re-verification.
 *
 * A self-registered account has a `User` row but no `Profile` row — Better
 * Auth's sign-up creates only the former, and nothing else created the
 * latter until now. The mobile app's first authenticated request after
 * sign-in sends the sign-up chat's answers here expecting them to land
 * somewhere; a plain nested `update` silently failed (there was nothing to
 * update) and the profile stayed empty forever. `upsert` creates it the
 * first time and updates it on every call after.
 */
export async function updateCurrentUser(userId: string, input: UpdateMeInput) {
  const profile = input.profile;
  return prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      timezone: input.timezone,
      locale: input.locale,
      ...(profile
        ? {
            profile: {
              upsert: {
                update: profile,
                create: {
                  participantCode: await nextParticipantCode(),
                  firstName: profile.firstName ?? "",
                  lastName: profile.lastName ?? "",
                  dateOfBirth: profile.dateOfBirth,
                  sex: profile.sex,
                  phone: profile.phone,
                  city: profile.city,
                  country: profile.country,
                  diabetesType: profile.diabetesType,
                  diagnosisYear: profile.diagnosisYear,
                  treatmentModality: profile.treatmentModality,
                  heightCm: profile.heightCm,
                  baselineWeightKg: profile.baselineWeightKg,
                  emergencyContactName: profile.emergencyContactName,
                  emergencyContactPhone: profile.emergencyContactPhone,
                },
              },
            },
          }
        : {}),
    },
    select: ME_SELECT,
  });
}

/** Marks the participant as having completed onboarding. */
export async function completeOnboarding(userId: string) {
  await prisma.profile.updateMany({
    where: { userId, onboardedAt: null },
    data: { onboardedAt: new Date() },
  });
}
