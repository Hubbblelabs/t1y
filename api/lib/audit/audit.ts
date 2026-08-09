import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";
import type { Principal } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/utils/logger";

/**
 * Append-only audit trail for sensitive operations.
 *
 * Writing an audit entry must never break the operation being audited, so
 * failures are logged and swallowed. Nothing in this module updates or deletes
 * existing entries — the application has no code path that can.
 */

export const AuditAction = {
  // Authentication
  LOGIN: "auth.login",
  LOGOUT: "auth.logout",
  LOGIN_FAILED: "auth.login_failed",
  PASSWORD_RESET_REQUESTED: "auth.password_reset_requested",

  // Participants
  PARTICIPANT_VIEWED: "participant.viewed",
  PARTICIPANT_LIST_VIEWED: "participant.list_viewed",
  PARTICIPANT_CREATED: "participant.created",
  PARTICIPANT_UPDATED: "participant.updated",
  PARTICIPANT_STATUS_CHANGED: "participant.status_changed",

  // Health data
  HEALTH_DATA_VIEWED: "health_data.viewed",

  // Research
  STUDY_CREATED: "study.created",
  STUDY_UPDATED: "study.updated",
  STUDY_PARTICIPANT_ENROLLED: "study.participant_enrolled",
  STUDY_PARTICIPANT_WITHDRAWN: "study.participant_withdrawn",
  STUDY_ACCESS_GRANTED: "study.access_granted",
  STUDY_ACCESS_REVOKED: "study.access_revoked",
  RESEARCH_DATA_EXPORTED: "research.data_exported",

  // Content
  EDUCATION_CREATED: "education.created",
  EDUCATION_UPDATED: "education.updated",
  EDUCATION_DELETED: "education.deleted",
  EDUCATION_PUBLISHED: "education.published",
  EDUCATION_UNPUBLISHED: "education.unpublished",
  EXERCISE_CONTENT_CREATED: "exercise_content.created",
  EXERCISE_CONTENT_UPDATED: "exercise_content.updated",
  EXERCISE_CONTENT_DELETED: "exercise_content.deleted",

  // Notifications
  CAMPAIGN_CREATED: "notification_campaign.created",
  CAMPAIGN_SCHEDULED: "notification_campaign.scheduled",
  CAMPAIGN_CANCELLED: "notification_campaign.cancelled",
  CAMPAIGN_SENT: "notification_campaign.sent",

  // Administration
  ADMIN_CREATED: "admin.created",
  ADMIN_UPDATED: "admin.updated",
  ADMIN_ROLE_CHANGED: "admin.role_changed",
  ADMIN_DEACTIVATED: "admin.deactivated",
  SETTINGS_UPDATED: "settings.updated",
  THRESHOLD_CREATED: "threshold.created",
  THRESHOLD_UPDATED: "threshold.updated",
  THRESHOLD_DELETED: "threshold.deleted",

  // Storage
  UPLOAD_URL_ISSUED: "storage.upload_url_issued",

  // Audit
  AUDIT_LOG_VIEWED: "audit.viewed",
  AUDIT_LOG_EXPORTED: "audit.exported",
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditEntry {
  action: AuditActionValue;
  resourceType: string;
  resourceId?: string | null;
  /** The participant whose data was involved, when applicable. */
  participantId?: string | null;
  studyId?: string | null;
  description?: string;
  /** Small, non-sensitive context. Never health values or credentials. */
  metadata?: Prisma.InputJsonValue;
  success?: boolean;
}

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface AuditActor {
  userId: string | null;
  email: string | null;
  role: UserRole | null;
}

export function actorFromPrincipal(principal: Principal | null): AuditActor {
  if (!principal) return { userId: null, email: null, role: null };
  return { userId: principal.userId, email: principal.email, role: principal.role };
}

/**
 * Extracts client network context. `x-forwarded-for` may contain a chain; the
 * left-most entry is the original client.
 */
export function requestContextFrom(request: Request, requestId?: string): RequestContext {
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;

  return {
    ipAddress,
    userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    requestId: requestId ?? null,
  };
}

export async function recordAudit(
  actor: AuditActor,
  entry: AuditEntry,
  context: RequestContext = {},
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        participantId: entry.participantId ?? null,
        studyId: entry.studyId ?? null,
        description: entry.description ?? null,
        metadata: entry.metadata,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
        requestId: context.requestId ?? null,
        success: entry.success ?? true,
      },
    });
  } catch (error) {
    // An audit write must not fail the user's operation, but losing one is
    // notable, so it is logged at error level for alerting.
    logger.error("audit.write_failed", {
      action: entry.action,
      resourceType: entry.resourceType,
      reason: error instanceof Error ? error.message : "unknown",
    });
  }
}

/** Convenience wrapper for the common "staff member looked at a participant" entry. */
export async function recordParticipantAccess(
  principal: Principal,
  participantId: string,
  context: RequestContext,
  detail?: { action?: AuditActionValue; resourceType?: string; description?: string },
): Promise<void> {
  await recordAudit(
    actorFromPrincipal(principal),
    {
      action: detail?.action ?? AuditAction.PARTICIPANT_VIEWED,
      resourceType: detail?.resourceType ?? "participant",
      resourceId: participantId,
      participantId,
      description: detail?.description,
    },
    context,
  );
}
