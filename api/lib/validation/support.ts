import { z } from "zod";

/**
 * Just a message. There is no title and no link: a parent describes what they
 * need in a few sentences, and a short title for the team's inbox is worked out
 * from the message itself (see `subjectFrom` in lib/services/support.ts).
 */
const message = z
  .string()
  .trim()
  .min(1, "Please write your message.")
  .max(1000, "Please keep your message under 1000 characters.");

/** A parent starting a new question about their child. */
export const openSupportThreadSchema = z.object({ body: message });

/** A parent adding to a conversation. */
export const supportFollowUpSchema = z.object({ body: message });
