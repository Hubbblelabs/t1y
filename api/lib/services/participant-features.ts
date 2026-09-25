import "server-only";

import { ForbiddenError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";

export {
  PARTICIPANT_FEATURE_KEYS,
  ALL_PARTICIPANT_FEATURES,
  PARTICIPANT_FEATURE_LABELS,
  type ParticipantFeatureKey,
} from "@/lib/participant-feature-registry";
import {
  PARTICIPANT_FEATURE_LABELS,
  type ParticipantFeatureKey,
} from "@/lib/participant-feature-registry";

/**
 * Throws if `feature` is not one this child is enrolled for.
 *
 * Called from every write endpoint the feature gates (glucose, insulin,
 * meals) before the record is created — the app is expected to hide the
 * entry screen too, but that is a courtesy, not the enforcement.
 */
export async function assertFeatureEnabled(userId: string, feature: ParticipantFeatureKey): Promise<void> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { enabledFeatures: true },
  });

  if (profile && !profile.enabledFeatures.includes(feature)) {
    throw new ForbiddenError(
      `${PARTICIPANT_FEATURE_LABELS[feature]} is not turned on for this account. Ask your study coordinator.`,
    );
  }
}
