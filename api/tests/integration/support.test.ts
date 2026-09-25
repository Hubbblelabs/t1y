import { afterAll, describe, expect, it } from "vitest";

import { DailyLimitError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import {
  DAILY_MESSAGE_LIMIT,
  countAwaitingReply,
  countSentToday,
  getSupportThread,
  listSupportThreadsForAdmin,
  markSupportMessagesRead,
  openSupportThread,
  remainingToday,
  replyToSupportThread,
  setSupportThreadStatus,
  startOfIndianDay,
  subjectFrom,
} from "@/lib/services/support";

/**
 * Help requests, against the development database.
 *
 * The property that matters most is that a thread's status follows the
 * conversation on its own: a coordinator should never have to remember to
 * change a dropdown, because the moment they forget, the inbox starts lying
 * about which families are still waiting.
 *
 * Every test uses its own family. A family may send only three messages a day,
 * so sharing one across tests would make them fail for the wrong reason.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 npm test
 */

const createdThreadIds: string[] = [];
const createdUserIds: string[] = [];

afterAll(async () => {
  if (createdThreadIds.length > 0) {
    await prisma.supportThread.deleteMany({ where: { id: { in: createdThreadIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

async function aFamily(): Promise<string> {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const user = await prisma.user.create({
    data: {
      id: `test-support-${stamp}`,
      email: `support-${stamp}@example.test`,
      name: "Test Child",
      emailVerified: false,
    },
    select: { id: true },
  });
  createdUserIds.push(user.id);
  return user.id;
}

async function anAdminId(): Promise<string> {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("No admin in the development database. Run `npm run db:seed`.");
  return admin.id;
}

async function aThread(body = "My child's reading was low this morning. What should we do?") {
  const userId = await aFamily();
  const thread = await openSupportThread({ userId, body });
  createdThreadIds.push(thread.id);
  return { thread, userId };
}

describe("Help requests", () => {
  it("a new question arrives waiting for an answer", async () => {
    const { thread } = await aThread();
    expect(thread.status).toBe("AWAITING_REPLY");

    const full = await getSupportThread(thread.id);
    expect(full.messages).toHaveLength(1);
    expect(full.messages[0].authorRole).toBe("PARENT");
  });

  it("takes its title from the message, since a parent is not asked for one", async () => {
    const { thread } = await aThread("Low readings at night\nIt happened twice this week.");
    expect(thread.subject).toBe("Low readings at night");
  });

  it("counts only the families still waiting", async () => {
    const before = await countAwaitingReply();
    const { thread } = await aThread("Test — counted");
    expect(await countAwaitingReply()).toBe(before + 1);

    await replyToSupportThread({
      threadId: thread.id,
      authorId: await anAdminId(),
      authorRole: "ADMIN",
      body: "Thanks for asking — here is what to do.",
    });
    expect(await countAwaitingReply()).toBe(before);
  });

  it("answering marks it answered, without anyone setting a status", async () => {
    const { thread } = await aThread();

    await replyToSupportThread({
      threadId: thread.id,
      authorId: await anAdminId(),
      authorRole: "ADMIN",
      body: "Here is our answer.",
    });

    const answered = await getSupportThread(thread.id);
    expect(answered.status).toBe("ANSWERED");
    expect(answered.messages).toHaveLength(2);
  });

  it("a family writing again puts it back in the queue", async () => {
    const { thread, userId } = await aThread();

    await replyToSupportThread({
      threadId: thread.id,
      authorId: await anAdminId(),
      authorRole: "ADMIN",
      body: "Our answer.",
    });
    await replyToSupportThread({
      threadId: thread.id,
      authorId: userId,
      authorRole: "PARENT",
      body: "Thank you — one more thing.",
    });

    expect((await getSupportThread(thread.id)).status).toBe("AWAITING_REPLY");
  });

  it("records when a family was first answered", async () => {
    const { thread } = await aThread();
    const adminId = await anAdminId();

    await replyToSupportThread({ threadId: thread.id, authorId: adminId, authorRole: "ADMIN", body: "First." });
    const first = await prisma.supportThread.findUniqueOrThrow({
      where: { id: thread.id },
      select: { firstRepliedAt: true },
    });
    expect(first.firstRepliedAt).toBeInstanceOf(Date);

    await replyToSupportThread({ threadId: thread.id, authorId: adminId, authorRole: "ADMIN", body: "Second." });
    const second = await prisma.supportThread.findUniqueOrThrow({
      where: { id: thread.id },
      select: { firstRepliedAt: true },
    });
    // "First" must mean first, not most recent.
    expect(second.firstRepliedAt).toEqual(first.firstRepliedAt);
  });

  it("marks only the other side's messages as read", async () => {
    const { thread } = await aThread();
    await replyToSupportThread({
      threadId: thread.id,
      authorId: await anAdminId(),
      authorRole: "ADMIN",
      body: "Our answer.",
    });

    const read = await markSupportMessagesRead({ threadId: thread.id, readerRole: "ADMIN" });
    expect(read).toBe(1);

    const full = await getSupportThread(thread.id);
    expect(full.messages.find((m) => m.authorRole === "PARENT")?.readAt).toBeInstanceOf(Date);
    expect(full.messages.find((m) => m.authorRole === "ADMIN")?.readAt).toBeNull();
  });

  it("closing keeps the whole conversation", async () => {
    const { thread } = await aThread();
    await setSupportThreadStatus(thread.id, "CLOSED");

    const closed = await getSupportThread(thread.id);
    expect(closed.status).toBe("CLOSED");
    expect(closed.messages.length).toBeGreaterThan(0);
  });

  it("puts the families still waiting at the top of the inbox", async () => {
    await aThread();
    const threads = await listSupportThreadsForAdmin();

    const firstAnswered = threads.findIndex((t) => t.status !== "AWAITING_REPLY");
    const lastWaiting = threads.map((t) => t.status).lastIndexOf("AWAITING_REPLY");
    if (firstAnswered !== -1 && lastWaiting !== -1) expect(lastWaiting).toBeLessThan(firstAnswered);
  });
});

describe("The daily allowance", () => {
  it("is three messages", () => {
    expect(DAILY_MESSAGE_LIMIT).toBe(3);
  });

  it("starts full and counts down with each message", async () => {
    const { userId } = await aThread();
    expect(await countSentToday(userId)).toBe(1);
    expect(await remainingToday(userId)).toBe(2);
  });

  it("refuses a fourth message, and says what to do", async () => {
    const userId = await aFamily();
    for (let i = 0; i < DAILY_MESSAGE_LIMIT; i++) {
      const t = await openSupportThread({ userId, body: `Question number ${i + 1}` });
      createdThreadIds.push(t.id);
    }

    await expect(openSupportThread({ userId, body: "One too many" })).rejects.toThrow(DailyLimitError);
    await expect(openSupportThread({ userId, body: "One too many" })).rejects.toThrow(
      /You can send more tomorrow/,
    );
    expect(await remainingToday(userId)).toBe(0);
  });

  it("counts a follow-up, not only a new question", async () => {
    const { thread, userId } = await aThread(); // 1
    await replyToSupportThread({ threadId: thread.id, authorId: userId, authorRole: "PARENT", body: "Two" });
    await replyToSupportThread({ threadId: thread.id, authorId: userId, authorRole: "PARENT", body: "Three" });

    await expect(
      replyToSupportThread({ threadId: thread.id, authorId: userId, authorRole: "PARENT", body: "Four" }),
    ).rejects.toThrow(DailyLimitError);
  });

  it("never limits the team's replies", async () => {
    const { thread } = await aThread();
    const adminId = await anAdminId();
    for (let i = 0; i < DAILY_MESSAGE_LIMIT + 2; i++) {
      await replyToSupportThread({
        threadId: thread.id,
        authorId: adminId,
        authorRole: "ADMIN",
        body: `Answer ${i}`,
      });
    }
    expect((await getSupportThread(thread.id)).status).toBe("ANSWERED");
  });

  it("is per family: one family using its allowance does not affect another", async () => {
    const busy = await aFamily();
    for (let i = 0; i < DAILY_MESSAGE_LIMIT; i++) {
      const t = await openSupportThread({ userId: busy, body: `Busy ${i}` });
      createdThreadIds.push(t.id);
    }
    const { userId: other } = await aThread();
    expect(await remainingToday(other)).toBe(2);
  });

  it("does not count a message that was refused", async () => {
    const userId = await aFamily();
    for (let i = 0; i < DAILY_MESSAGE_LIMIT; i++) {
      const t = await openSupportThread({ userId, body: `Q${i}` });
      createdThreadIds.push(t.id);
    }
    await openSupportThread({ userId, body: "Refused" }).catch(() => {});
    expect(await countSentToday(userId)).toBe(DAILY_MESSAGE_LIMIT);
  });
});

describe("A day, for the allowance", () => {
  it("is a day in India, not in UTC", () => {
    // 20:00 UTC on 20 Sep is 01:30 IST on 21 Sep — already the next day there.
    const lateEvening = new Date("2026-09-20T20:00:00Z");
    expect(startOfIndianDay(lateEvening).toISOString()).toBe("2026-09-20T18:30:00.000Z");
  });

  it("starts at midnight in India", () => {
    // Midnight IST on 20 Sep is 18:30 UTC on 19 Sep.
    const midday = new Date("2026-09-20T06:30:00Z"); // noon IST
    expect(startOfIndianDay(midday).toISOString()).toBe("2026-09-19T18:30:00.000Z");
  });

  it("does not change until midnight there", () => {
    const a = startOfIndianDay(new Date("2026-09-20T00:00:00Z"));
    const b = startOfIndianDay(new Date("2026-09-20T18:29:00Z"));
    expect(a.toISOString()).toBe(b.toISOString());
  });
});

describe("Titles taken from a message", () => {
  it("uses the first line", () => {
    expect(subjectFrom("Low at night\nmore detail")).toBe("Low at night");
  });

  it("shortens a long first line", () => {
    const title = subjectFrom("x".repeat(200));
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("…")).toBe(true);
  });

  it("collapses stray spaces", () => {
    expect(subjectFrom("  too    many   spaces  ")).toBe("too many spaces");
  });

  it("never returns an empty title", () => {
    expect(subjectFrom("   ")).toBe("Question");
  });
});
