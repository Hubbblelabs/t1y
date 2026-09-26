import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { UserRole, UserStatus } from "@/generated/prisma/enums";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db/prisma";
import { STAFF_ROLES } from "@/lib/permissions/roles";

/**
 * Staff account administration.
 *
 * Only a super administrator reaches this module (enforced by
 * `assertCanAssignRole`). Staff accounts are created with a temporary password
 * the administrator hands over; it must be replaced at first sign-in, and
 * anyone can change theirs later from Your account.
 */

const STAFF_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  emailVerified: true,
  lastLoginAt: true,
  createdAt: true,
  adminUser: {
    select: {
      jobTitle: true,
      department: true,
      organization: true,
      phone: true,
      invitedAt: true,
      capabilities: true,
    },
  },
  _count: { select: { studyAccess: true } },
} satisfies Prisma.UserSelect;

export async function listStaff(params: {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  skip: number;
  take: number;
}) {
  const where: Prisma.UserWhereInput = {
    role: params.role ? params.role : { in: [...STAFF_ROLES] },
    deletedAt: null,
    ...(params.status ? { status: params.status } : {}),
    ...(params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: "insensitive" } },
            { email: { contains: params.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: STAFF_SELECT,
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      skip: params.skip,
      take: params.take,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total };
}

export async function getStaffMember(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, role: { in: [...STAFF_ROLES] }, deletedAt: null },
    select: {
      ...STAFF_SELECT,
      studyAccess: {
        select: {
          id: true,
          role: true,
          canExport: true,
          grantedAt: true,
          study: { select: { id: true, code: true, title: true } },
        },
      },
    },
  });
  if (!user) throw new NotFoundError("Staff account");
  return user;
}

export interface CreateStaffInput {
  email: string;
  name: string;
  role: UserRole;
  /** Temporary. The account is marked so its owner must replace it at first sign-in. */
  password: string;
  jobTitle?: string;
  department?: string;
  organization?: string;
  phone?: string;
  /** Empty/omitted = full access to everything the role allows. */
  capabilities?: string[];
}

export async function createStaffMember(
  invitedById: string,
  input: CreateStaffInput,
): Promise<{ id: string; email: string; role: UserRole }> {
  if (input.role === "PATIENT") {
    throw new ValidationError("Use the participants module to create participants.");
  }

  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) throw new ConflictError("An account with this email already exists.");

  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: input.name,
        role: input.role,
        status: "ACTIVE",
        emailVerified: true,
        // Signed in with the temporary password, they are taken straight to
        // choose their own before seeing anything else.
        mustChangePassword: true,
        adminUser: {
          create: {
            jobTitle: input.jobTitle,
            department: input.department,
            organization: input.organization,
            phone: input.phone,
            capabilities: input.capabilities ?? [],
            invitedById,
            invitedAt: new Date(),
          },
        },
      },
      select: { id: true, email: true, role: true },
    });

    await tx.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: passwordHash,
      },
    });

    return user;
  });
}

/**
 * Looks up an existing family account by email, for "give an existing
 * account admin access too" — creating a new staff account rejects an email
 * already in use (see `createStaffMember`), which is exactly the case where
 * one person is both a parent in the study and a member of staff.
 */
export async function findPromotablePatient(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) throw new NotFoundError("Account");
  if (user.role !== "PATIENT") {
    throw new ConflictError("This is already a staff account.");
  }
  return user;
}

export interface PromoteToAdminInput {
  jobTitle?: string;
  department?: string;
  organization?: string;
  phone?: string;
  /** Empty/omitted = full access to everything ADMIN allows. */
  capabilities?: string[];
}

/**
 * Converts an existing family account to a staff account, in place — same
 * id, same email and password, `role` switched from PATIENT to ADMIN.
 *
 * There is no dual role in this schema (`UserRole` is PATIENT or ADMIN, never
 * both), so this is a genuine conversion, not an addition: the account signs
 * in to the dashboard from now on and can no longer be used to sign in to
 * the app as that child. The caller is expected to have warned for this
 * before calling it — see the confirmation step in the promote form.
 */
export async function promoteToAdmin(
  userId: string,
  invitedById: string,
  input: PromoteToAdminInput,
): Promise<{ id: string; email: string; role: UserRole }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) throw new NotFoundError("Account");
  if (user.role !== "PATIENT") {
    throw new ConflictError("This is already a staff account.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        role: "ADMIN",
        adminUser: {
          create: {
            jobTitle: input.jobTitle,
            department: input.department,
            organization: input.organization,
            phone: input.phone,
            capabilities: input.capabilities ?? [],
            invitedById,
            invitedAt: new Date(),
          },
        },
      },
      select: { id: true, email: true, role: true },
    });
    return updated;
  });
}

export async function updateStaffMember(
  id: string,
  input: {
    name?: string;
    role?: UserRole;
    status?: UserStatus;
    jobTitle?: string | null;
    department?: string | null;
    organization?: string | null;
    phone?: string | null;
    /** Empty array = full access; omitted = leave unchanged. */
    capabilities?: string[];
  },
) {
  if (input.role === "PATIENT") {
    throw new ValidationError("A staff account cannot be demoted to a participant.");
  }

  const existing = await prisma.user.findFirst({
    where: { id, role: { in: [...STAFF_ROLES] }, deletedAt: null },
    select: { id: true, adminUser: { select: { id: true } } },
  });
  if (!existing) throw new NotFoundError("Staff account");

  const profileFields = {
    jobTitle: input.jobTitle,
    department: input.department,
    organization: input.organization,
    phone: input.phone,
    ...(input.capabilities !== undefined ? { capabilities: input.capabilities } : {}),
  };
  const hasProfileChange = Object.values(profileFields).some(
    (value) => value !== undefined,
  );

  return prisma.user.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.role ? { role: input.role } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(hasProfileChange
        ? {
            adminUser: existing.adminUser
              ? { update: profileFields }
              : { create: profileFields },
          }
        : {}),
    },
    select: STAFF_SELECT,
  });
}

/**
 * Deactivates a staff account and revokes their sessions.
 *
 * Never a hard delete: the account is referenced by audit entries and authored
 * content, and that history must remain intact and attributable.
 */
export async function deactivateStaffMember(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, role: { in: [...STAFF_ROLES] }, deletedAt: null },
    select: { id: true },
  });
  if (!user) throw new NotFoundError("Staff account");

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { status: "INACTIVE" },
      select: { id: true, status: true },
    }),
    // Sessions are dropped so access ends immediately rather than at expiry.
    prisma.session.deleteMany({ where: { userId: id } }),
  ]);

  return updated;
}

/**
 * Guards against removing the last administrator, which would lock everyone
 * out of staff management permanently. ADMIN is the only staff role now
 * (see lib/permissions/roles.ts), so this protects the role itself rather
 * than a "super" tier within it.
 */
export async function assertNotLastAdmin(userId: string): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (target?.role !== "ADMIN") return;

  const remaining = await prisma.user.count({
    where: {
      role: "ADMIN",
      status: "ACTIVE",
      deletedAt: null,
      id: { not: userId },
    },
  });

  if (remaining === 0) {
    throw new ValidationError(
      "This is the only active administrator. Promote another account first.",
    );
  }
}
