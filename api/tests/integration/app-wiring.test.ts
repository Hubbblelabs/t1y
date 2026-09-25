import { afterAll, describe, expect, it } from "vitest";

import { NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import {
  createProfileFieldDefinition,
  listProfileQuestions,
  listSignupQuestions,
} from "@/lib/services/profile-fields";
import {
  countUnreadAnswers,
  getSupportThreadForUser,
  listSupportThreadsForUser,
  markSupportMessagesRead,
  openSupportThread,
  replyToSupportThread,
} from "@/lib/services/support";

/**
 * What the app is given, and what a parent can reach.
 *
 * The properties that matter are the ones a phone cannot enforce for itself:
 * that a family only ever sees its own conversations, that the questions sent
 * to a signed-out phone carry nothing admin-only, and that the two lists the
 * app reads never disagree with what the dashboard shows.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 npm test
 */

const userIds: string[] = [];
const threadIds: string[] = [];
const fieldIds: string[] = [];
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

afterAll(async () => {
  if (threadIds.length) await prisma.supportThread.deleteMany({ where: { id: { in: threadIds } } });
  if (fieldIds.length) await prisma.profileFieldDefinition.deleteMany({ where: { id: { in: fieldIds } } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

async function aChild(): Promise<string> {
  const id = `test-wire-${stamp()}`;
  await prisma.user.create({
    data: { id, email: `${id}@example.test`, name: "Test Child", emailVerified: false },
  });
  userIds.push(id);
  return id;
}

async function anAdmin(): Promise<string> {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("No admin. Run `npm run db:seed`.");
  return admin.id;
}

describe("Questions sent to the app", () => {
  it("gives a signed-out phone exactly the four sign-up questions, in order", async () => {
    const questions = await listSignupQuestions();
    expect(questions.map((q) => q.key)).toEqual(["name", "dateOfBirth", "sex", "diagnosisYear"]);
    expect(questions.every((q) => q.required)).toBe(true);
    expect(questions.every((q) => q.promptEn)).toBe(true);
  });

  it("carries nothing that belongs only to the dashboard", async () => {
    for (const question of [...(await listSignupQuestions()), ...(await listProfileQuestions())]) {
      // Whether a calculator may read a question is not the parent's business,
      // and is not what a signed-out caller should be able to learn.
      expect(question).not.toHaveProperty("isMedical");
      for (const option of question.options ?? []) {
        expect(option).not.toHaveProperty("numericValue");
      }
    }
  });

  it("gives the profile screen every question, built in and added together", async () => {
    const key = `testProfileQ${stamp()}`;
    const added = await createProfileFieldDefinition({
      key,
      fieldType: "TEXT",
      labelEn: "School",
      sortOrder: 9999,
    });
    fieldIds.push(added.id);

    const keys = (await listProfileQuestions()).map((q) => q.key);
    expect(keys).toContain("name"); // built in
    expect(keys).toContain("heightCm");
    expect(keys).toContain(key); // added
    expect(keys.indexOf(key)).toBeGreaterThan(keys.indexOf("emergencyContactPhone"));
  });

  it("offers an added question at sign-up only when it is marked for it", async () => {
    const quiet = `testQuiet${stamp()}`;
    const loud = `testLoud${stamp()}`;
    const a = await createProfileFieldDefinition({ key: quiet, fieldType: "TEXT", labelEn: "Quiet" });
    const b = await createProfileFieldDefinition({
      key: loud,
      fieldType: "TEXT",
      labelEn: "Loud",
      showOnSignup: true,
      promptEn: "Which school?",
      sortOrder: 9998,
    });
    fieldIds.push(a.id, b.id);

    const atSignup = (await listSignupQuestions()).map((q) => q.key);
    expect(atSignup).toContain(loud);
    expect(atSignup).not.toContain(quiet);
  });

  it("stops asking a question the moment it is switched off", async () => {
    const key = `testOff${stamp()}`;
    const field = await createProfileFieldDefinition({ key, fieldType: "TEXT", labelEn: "Off soon" });
    fieldIds.push(field.id);
    expect((await listProfileQuestions()).map((q) => q.key)).toContain(key);

    await prisma.profileFieldDefinition.update({ where: { id: field.id }, data: { active: false } });
    expect((await listProfileQuestions()).map((q) => q.key)).not.toContain(key);
  });
});

describe("A parent's own conversations", () => {
  async function aThread(userId: string) {
    const thread = await openSupportThread({
      userId,
      body: "Test — wiring. A question about my child.",
    });
    threadIds.push(thread.id);
    return thread;
  }

  it("lists only that child's questions", async () => {
    const mine = await aChild();
    const theirs = await aChild();
    const myThread = await aThread(mine);
    await aThread(theirs);

    const listed = await listSupportThreadsForUser(mine);
    expect(listed.map((t) => t.id)).toEqual([myThread.id]);
  });

  it("reports another family's conversation as not found, never as forbidden", async () => {
    const mine = await aChild();
    const theirs = await aChild();
    const theirThread = await aThread(theirs);

    // The answer must not reveal that the id exists.
    await expect(getSupportThreadForUser(theirThread.id, mine)).rejects.toThrow(NotFoundError);
  });

  it("returns a parent's own conversation with its messages", async () => {
    const mine = await aChild();
    const thread = await aThread(mine);

    const full = await getSupportThreadForUser(thread.id, mine);
    expect(full.messages).toHaveLength(1);
    expect(full.messages[0].authorRole).toBe("PARENT");
  });

  it("counts an answer as unread until the parent opens it", async () => {
    const mine = await aChild();
    const thread = await aThread(mine);
    expect(await countUnreadAnswers(mine)).toBe(0);

    await replyToSupportThread({
      threadId: thread.id,
      authorId: await anAdmin(),
      authorRole: "ADMIN",
      body: "Here is our answer.",
    });
    expect(await countUnreadAnswers(mine)).toBe(1);

    await markSupportMessagesRead({ threadId: thread.id, readerRole: "PARENT" });
    expect(await countUnreadAnswers(mine)).toBe(0);
  });

  it("does not count the parent's own messages as unread answers", async () => {
    const mine = await aChild();
    await aThread(mine);
    expect(await countUnreadAnswers(mine)).toBe(0);
  });

  it("only counts unread answers for the child they were sent to", async () => {
    const mine = await aChild();
    const theirs = await aChild();
    const theirThread = await aThread(theirs);
    await replyToSupportThread({
      threadId: theirThread.id,
      authorId: await anAdmin(),
      authorRole: "ADMIN",
      body: "For them.",
    });

    expect(await countUnreadAnswers(mine)).toBe(0);
    expect(await countUnreadAnswers(theirs)).toBe(1);
  });
});
