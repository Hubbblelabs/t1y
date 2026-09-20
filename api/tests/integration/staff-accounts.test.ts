import { afterAll, describe, expect, it } from "vitest";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { createStaffMember } from "@/lib/services/admins";

const email = `staff-${Date.now()}@example.test`;
const TEMP = "Temp-Password-1";
const OWN = "My-Own-Password-2026";

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
});

describe("adding a staff account", () => {
  it("creates it with a temporary password that must be replaced", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const staff = await createStaffMember(admin.id, {
      email,
      name: "Test Staff",
      role: "ADMIN",
      password: TEMP,
    });

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: staff.id },
      select: { mustChangePassword: true, status: true, emailVerified: true },
    });
    expect(row.mustChangePassword).toBe(true);
    expect(row.status).toBe("ACTIVE");
    expect(row.emailVerified).toBe(true);
  });

  it("lets them sign in with it, and refuses a wrong one", async () => {
    const ok = await auth.api.signInEmail({ body: { email, password: TEMP } });
    expect(ok.token).toBeTruthy();
    await expect(
      auth.api.signInEmail({ body: { email, password: "not-the-password" } }),
    ).rejects.toThrow();
  });

  it("refuses a second account with the same email", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    await expect(
      createStaffMember(admin.id, { email, name: "Again", role: "ADMIN", password: TEMP }),
    ).rejects.toThrow(/already exists/);
  });

  it("changing the password works and the old one stops working", async () => {
    const session = await auth.api.signInEmail({ body: { email, password: TEMP } });
    await auth.api.changePassword({
      headers: new Headers({ authorization: `Bearer ${session.token}` }),
      body: { currentPassword: TEMP, newPassword: OWN, revokeOtherSessions: true },
    });
    await expect(auth.api.signInEmail({ body: { email, password: TEMP } })).rejects.toThrow();
    const again = await auth.api.signInEmail({ body: { email, password: OWN } });
    expect(again.token).toBeTruthy();
  });
});
