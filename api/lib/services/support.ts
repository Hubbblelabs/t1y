import "server-only";

import { DailyLimitError, NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";

/**
 * Help and support.
 *
 * A parent asks a question about their child; a coordinator answers it. One
 * thread per question, so an answer is never separated from what was asked,
 * and either side can keep the conversation going.
 *
 * Nothing here deletes anything. A family's question and the answer they were
 * given stay on the record — a coordinator "closes" a thread, which only
 * stops it asking to be dealt with.
 */

/**
 * How many messages a family may send in a day.
 *
 * Counts every message a parent sends — a new question or a follow-up — so it
 * is one allowance rather than two. The team's replies are never counted.
 *
 * Deliberately small. This is a route to a person, not a chat: a short limit
 * keeps the inbox readable for a small team and encourages a parent to put the
 * whole question in one message.
 */
export const DAILY_MESSAGE_LIMIT = 3;

/** The study is in Coimbatore, so "a day" is a day there, not in UTC. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight at the start of the current day in India, as an instant. */
export function startOfIndianDay(now: Date = new Date()): Date {
  const local = now.getTime() + IST_OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - IST_OFFSET_MS);
}

/** How many messages this child's parent has sent today. */
export async function countSentToday(userId: string, now: Date = new Date()): Promise<number> {
  return prisma.supportMessage.count({
    where: {
      authorId: userId,
      authorRole: "PARENT",
      createdAt: { gte: startOfIndianDay(now) },
    },
  });
}

export async function remainingToday(userId: string, now: Date = new Date()): Promise<number> {
  return Math.max(0, DAILY_MESSAGE_LIMIT - (await countSentToday(userId, now)));
}

async function assertMayWriteToday(userId: string): Promise<void> {
  if ((await remainingToday(userId)) > 0) return;
  throw new DailyLimitError(
    `You have already sent ${DAILY_MESSAGE_LIMIT} messages today. ` +
      "You can send more tomorrow — the team will reply here.",
  );
}

/**
 * A short title for the inbox, taken from the message itself.
 *
 * Parents are not asked to write one: a separate "title" box in front of a
 * message is a barrier, and the first line of what they wrote describes it
 * well enough for a coordinator scanning a list.
 */
export function subjectFrom(body: string): string {
  const firstLine = body.trim().split(/\r?\n/)[0]?.trim() ?? "";
  const collapsed = firstLine.replace(/\s+/g, " ");
  return collapsed.length > 60 ? `${collapsed.slice(0, 57).trimEnd()}…` : collapsed || "Question";
}

const MESSAGE_SELECT = {
  id: true,
  authorId: true,
  authorRole: true,
  body: true,
  readAt: true,
  createdAt: true,
  author: { select: { id: true, name: true } },
} as const;

/**
 * The admin inbox.
 *
 * Unanswered threads first, then by most recent activity — the ordering
 * matches what the job actually is, which is "who is still waiting".
 */
export async function listSupportThreadsForAdmin(params?: {
  status?: "AWAITING_REPLY" | "ANSWERED" | "CLOSED";
}) {
  return prisma.supportThread.findMany({
    where: params?.status ? { status: params.status } : undefined,
    orderBy: [{ status: "asc" }, { lastMessageAt: "desc" }],
    select: {
      id: true,
      subject: true,
      status: true,
      lastMessageAt: true,
      firstRepliedAt: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          profile: { select: { participantCode: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, authorRole: true, createdAt: true },
      },
      _count: { select: { messages: true } },
    },
  });
}

export async function getSupportThread(id: string) {
  const thread = await prisma.supportThread.findUnique({
    where: { id },
    select: {
      id: true,
      subject: true,
      status: true,
      userId: true,
      lastMessageAt: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          profile: { select: { participantCode: true } },
        },
      },
      messages: { orderBy: { createdAt: "asc" }, select: MESSAGE_SELECT },
    },
  });
  if (!thread) throw new NotFoundError("Message");
  return thread;
}

/** How many families are still waiting — the badge on the inbox. */
export async function countAwaitingReply(): Promise<number> {
  return prisma.supportThread.count({ where: { status: "AWAITING_REPLY" } });
}

/**
 * A parent starts a new question.
 *
 * The thread is filed against whoever is signed in, which in this app is the
 * child's own account — so a question is automatically about the right child
 * and cannot be filed against a sibling by mistake.
 */
export async function openSupportThread(params: { userId: string; body: string }) {
  await assertMayWriteToday(params.userId);

  return prisma.supportThread.create({
    data: {
      userId: params.userId,
      subject: subjectFrom(params.body),
      status: "AWAITING_REPLY",
      lastMessageAt: new Date(),
      messages: {
        create: {
          authorId: params.userId,
          authorRole: "PARENT",
          body: params.body.trim(),
        },
      },
    },
    select: { id: true, subject: true, status: true, createdAt: true },
  });
}

/**
 * Adds a message to an existing thread.
 *
 * The thread's status follows from who spoke last, rather than being set by
 * hand: a coordinator's reply marks it answered, and a parent writing again
 * puts it back in the queue. That way the inbox cannot drift out of step with
 * the conversation because somebody forgot to change a dropdown.
 */
export async function replyToSupportThread(params: {
  threadId: string;
  authorId: string;
  authorRole: "PARENT" | "ADMIN";
  body: string;
}) {
  const thread = await prisma.supportThread.findUnique({
    where: { id: params.threadId },
    select: { id: true, firstRepliedAt: true },
  });
  if (!thread) throw new NotFoundError("Message");

  const now = new Date();
  const isStaff = params.authorRole === "ADMIN";

  // Only the family's messages are limited; the team can always answer.
  if (!isStaff) await assertMayWriteToday(params.authorId);

  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({
      data: {
        threadId: params.threadId,
        authorId: params.authorId,
        authorRole: params.authorRole,
        body: params.body.trim(),
      },
      select: MESSAGE_SELECT,
    }),
    prisma.supportThread.update({
      where: { id: params.threadId },
      data: {
        status: isStaff ? "ANSWERED" : "AWAITING_REPLY",
        lastMessageAt: now,
        ...(isStaff && thread.firstRepliedAt === null ? { firstRepliedAt: now } : {}),
      },
    }),
  ]);

  return message;
}

export async function setSupportThreadStatus(
  id: string,
  status: "AWAITING_REPLY" | "ANSWERED" | "CLOSED",
) {
  const existing = await prisma.supportThread.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Message");

  return prisma.supportThread.update({ where: { id }, data: { status } });
}

/**
 * Marks the other side's messages as read.
 *
 * Only ever marks messages the reader did not write — "read" must mean
 * somebody else opened it, which is what makes it worth showing beside a
 * sent message.
 */
export async function markSupportMessagesRead(params: {
  threadId: string;
  readerRole: "PARENT" | "ADMIN";
}): Promise<number> {
  const { count } = await prisma.supportMessage.updateMany({
    where: {
      threadId: params.threadId,
      authorRole: params.readerRole === "ADMIN" ? "PARENT" : "ADMIN",
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  return count;
}

/** A parent's own threads, for the app's help screen. */
export async function listSupportThreadsForUser(userId: string) {
  return prisma.supportThread.findMany({
    where: { userId },
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      subject: true,
      status: true,
      lastMessageAt: true,
      messages: { orderBy: { createdAt: "asc" }, select: MESSAGE_SELECT },
    },
  });
}

/**
 * One of a parent's own conversations.
 *
 * Ownership is checked here rather than trusted from the route: a thread that
 * belongs to another child is reported as not found, never as forbidden, so
 * the answer gives nothing away about whether that id exists.
 */
export async function getSupportThreadForUser(id: string, userId: string) {
  const thread = await prisma.supportThread.findFirst({
    where: { id, userId },
    select: {
      id: true,
      subject: true,
      status: true,
      lastMessageAt: true,
      messages: { orderBy: { createdAt: "asc" }, select: MESSAGE_SELECT },
    },
  });
  if (!thread) throw new NotFoundError("Message");
  return thread;
}

/** How many of this parent's questions have an answer they have not opened. */
export async function countUnreadAnswers(userId: string): Promise<number> {
  return prisma.supportThread.count({
    where: {
      userId,
      messages: { some: { authorRole: "ADMIN", readAt: null } },
    },
  });
}
