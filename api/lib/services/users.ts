import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { DiabetesType, TreatmentModality } from "@/generated/prisma/enums";
import { NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { nextParticipantCode } from "@/lib/services/participants";
import { mergeAndValidateCustomFieldValues } from "@/lib/services/profile-fields";

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
      name: true,
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
      customFieldValues: true,
      icIsfUnlocked: true,
      enabledFeatures: true,
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
    name?: string;
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
    primaryClinician?: string | null;
    customFieldValues?: Record<string, string | number | null>;
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
  const { customFieldValues, ...profile } = input.profile ?? {};
  const hasProfile = input.profile !== undefined;

  // Custom-field answers are merged against whatever is already on file, not
  // replaced wholesale — spreading `profile` straight into a Prisma update
  // would otherwise overwrite the whole JSON bucket with only this call's
  // keys and silently drop every other admin-defined field's answer.
  let mergedCustomFields: Record<string, string | number | null> | undefined;
  if (customFieldValues) {
    const existing = await prisma.profile.findUnique({
      where: { userId },
      select: { customFieldValues: true },
    });
    mergedCustomFields = await mergeAndValidateCustomFieldValues(
      existing?.customFieldValues ?? {},
      customFieldValues,
    );
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      timezone: input.timezone,
      locale: input.locale,
      ...(hasProfile
        ? {
            profile: {
              upsert: {
                update: {
                  ...profile,
                  ...(mergedCustomFields ? { customFieldValues: mergedCustomFields } : {}),
                },
                create: {
                  participantCode: await nextParticipantCode(),
                  name: profile.name ?? "",
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
                  primaryClinician: profile.primaryClinician,
                  ...(mergedCustomFields ? { customFieldValues: mergedCustomFields } : {}),
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

/**
 * Deletes the caller's own account, from the app.
 *
 * What goes: everything that identifies the child or the family — name, email,
 * date of birth, phone numbers, city, clinician, emergency contact, answers to
 * added questions, help-and-support conversations, registered devices — and
 * the ability to sign in (password and every session). The account is marked
 * deleted, so it no longer appears anywhere in the app or in a household.
 *
 * What stays: the health and learning records (readings, doses, quiz results),
 * attached only to the participant code, because they are the study's research
 * data and the consent covers keeping them in de-identified form. This is
 * stated to the family on the deletion screen and in the terms before they
 * confirm, and in docs/COMPLIANCE.md.
 */
export async function deleteOwnAccount(userId: string): Promise<void> {
  const placeholder = "Deleted participant";

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        name: placeholder,
        email: `deleted-${userId}@deleted.invalid`,
        emailVerified: false,
        image: null,
        status: "INACTIVE",
        deletedAt: new Date(),
      },
    }),
    prisma.profile.updateMany({
      where: { userId },
      data: {
        name: placeholder,
        dateOfBirth: null,
        phone: null,
        city: null,
        country: null,
        primaryClinician: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        customFieldValues: {},
      },
    }),
    prisma.supportThread.deleteMany({ where: { userId } }),
    prisma.deviceToken.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
  ]);
}
