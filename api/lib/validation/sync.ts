import { z } from "zod";

import { isoDateTime } from "@/lib/validation/common";
import { contentLocaleSchema, slugSchema } from "@/lib/validation/admin";
import { questionAnswerSchema } from "@/lib/validation/quizzes";

/**
 * The offline sync push contract. The device queues events locally
 * (client-generated UUID per event) and flushes them in a batch when
 * connectivity returns. See lib/services/sync.ts for why partial success,
 * idempotency-by-id, and clock-skew tolerance are all load-bearing together.
 */

const clientIdSchema = z.uuid();

export const MAX_SYNC_BATCH = 100;

const topicOpenPayload = z.object({
  topicSlug: slugSchema,
  locale: contentLocaleSchema,
});

const topicCompletionPayload = z.object({
  topicSlug: slugSchema,
  locale: contentLocaleSchema,
  secondsSpent: z.number().int().min(0).max(24 * 60 * 60).default(0),
});

const quizAttemptPayload = z.object({
  quizSlug: slugSchema,
  locale: contentLocaleSchema,
  startedAt: isoDateTime,
  completedAt: isoDateTime.optional(),
  responses: z
    .array(
      z.object({
        questionKey: z.string().trim().min(1).max(60),
        answer: questionAnswerSchema,
        answeredAt: isoDateTime,
      }),
    )
    .min(1)
    .max(50),
});

const syncEventSchema = z.discriminatedUnion("type", [
  z.object({
    clientId: clientIdSchema,
    type: z.literal("TOPIC_OPEN"),
    occurredAt: isoDateTime,
    payload: topicOpenPayload,
  }),
  z.object({
    clientId: clientIdSchema,
    type: z.literal("TOPIC_COMPLETION"),
    occurredAt: isoDateTime,
    payload: topicCompletionPayload,
  }),
  z.object({
    clientId: clientIdSchema,
    type: z.literal("QUIZ_ATTEMPT"),
    occurredAt: isoDateTime,
    payload: quizAttemptPayload,
  }),
]);

export const syncPushSchema = z.object({
  deviceId: z.string().trim().max(128).optional(),
  appVersion: z.string().trim().max(32).optional(),
  sentAt: isoDateTime,
  events: z.array(syncEventSchema).min(1).max(MAX_SYNC_BATCH),
});

export const syncBootstrapQuerySchema = z.object({
  locale: contentLocaleSchema.default("EN"),
});
