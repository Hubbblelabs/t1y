import "server-only";

import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { STUDY_DIABETES_TYPE } from "@/lib/config/study-scope";
import { nextParticipantCode } from "@/lib/services/participants";

/**
 * Households: one parent, one set of credentials, one or more enrolled
 * children.
 *
 * Each child remains a full `User` — see the Household model's own note for
 * why. What this module adds is the layer above: resolving whatever the
 * parent typed into the sign-in box (their email, their phone, or one
 * child's ID) down to the set of child accounts it could mean, and creating
 * further children under an existing household.
 *
 * Sign-in itself is still Better Auth's, unchanged: the app validates the
 * password once, picks a child, and signs in as that child's account. This
 * module never checks a password and never mints a session.
 */

/**
 * Additional children can't reuse the parent's address — `User.email` is
 * unique, and Better Auth authenticates against it. They get a plus-address
 * derived from the parent's, which stays deliverable to the same inbox on
 * every mainstream provider while remaining distinct per child.
 */
function childEmailFor(parentEmail: string, participantCode: string): string {
  const [local, domain] = parentEmail.toLowerCase().split("@");
  if (!local || !domain) throw new ValidationError("The parent email address isn't valid.");
  return `${local}+${participantCode.toLowerCase()}@${domain}`;
}

/** Digits only, so "+91 98765 43210" and "09876543210" resolve alike. */
function normalisePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

const PARTICIPANT_CODE_PATTERN = /^P\d{3,}$/i;

export type IdentifierKind = "email" | "phone" | "childId";

/** What the parent typed, classified without a database round trip. */
export function classifyIdentifier(raw: string): IdentifierKind {
  const value = raw.trim();
  if (value.includes("@")) return "email";
  if (PARTICIPANT_CODE_PATTERN.test(value)) return "childId";
  return "phone";
}

export interface HouseholdChild {
  userId: string;
  /**
   * `Profile.participantCode` — the child ID shown on the profile screen and
   * accepted as a sign-in identifier. Falls back to the account id for a
   * profile-less account, which is why [hasParticipantCode] exists.
   */
  childId: string;

  /** False when [childId] is a stand-in rather than a real participant code. */
  hasParticipantCode: boolean;
  /** The address to hand Better Auth's sign-in for this child. */
  email: string;
  name: string;
  dateOfBirth: Date | null;
  status: string;
  icIsfUnlocked: boolean;
}

export interface ResolvedHousehold {
  householdId: string | null;
  parentName: string | null;
  children: HouseholdChild[];
  /**
   * True when the identifier named exactly one child (a child ID), so the
   * app should sign straight in without showing the picker.
   */
  isSingleChild: boolean;
}

const CHILD_SELECT = {
  id: true,
  email: true,
  name: true,
  status: true,
  profile: {
    select: {
      participantCode: true,
      name: true,
      dateOfBirth: true,
      icIsfUnlocked: true,
    },
  },
} as const;

type ChildRow = {
  id: string;
  email: string;
  name: string;
  status: string;
  profile: {
    participantCode: string;
    name: string;
    dateOfBirth: Date | null;
    icIsfUnlocked: boolean;
  } | null;
};

/**
 * An account with no `Profile` row yet is still a real account that must be
 * able to sign in.
 *
 * The chat sign-up deliberately creates the profile on the *first
 * authenticated request* (see ProfileService.flushPendingProfile in the app)
 * — so demanding a profile in order to authenticate would be circular, and
 * would lock out everyone who registered but hasn't completed that flush.
 * Such an account has no participant code to be addressed by, so its own id
 * stands in as the selection key; the app only displays a child ID that
 * actually looks like one.
 */
function toChild(user: ChildRow): HouseholdChild {
  const profile = user.profile;
  if (!profile) {
    return {
      userId: user.id,
      childId: user.id,
      hasParticipantCode: false,
      email: user.email,
      name: user.name,
      dateOfBirth: null,
      status: user.status,
      icIsfUnlocked: false,
    };
  }

  return {
    userId: user.id,
    childId: profile.participantCode,
    hasParticipantCode: true,
    email: user.email,
    name: profile.name,
    dateOfBirth: profile.dateOfBirth,
    status: user.status,
    icIsfUnlocked: profile.icIsfUnlocked,
  };
}

/**
 * Maps a sign-in identifier to the child accounts it could mean.
 *
 * Deliberately returns children for an identifier the caller has *not* yet
 * proven they own — so the route must verify the password before returning
 * any of this to the client. Names and dates of birth are health-adjacent
 * personal data about children; a lookup endpoint that leaked them to
 * anyone who guessed a phone number would be its own incident.
 *
 * Accounts enrolled before households existed have no `householdId`. Those
 * resolve as a household of one, which is exactly what they are.
 */
export async function resolveHousehold(identifier: string): Promise<ResolvedHousehold> {
  const value = identifier.trim();
  const kind = classifyIdentifier(value);

  if (kind === "childId") {
    const user = await prisma.user.findFirst({
      where: {
        role: "PATIENT",
        deletedAt: null,
        profile: { participantCode: { equals: value, mode: "insensitive" } },
      },
      select: { ...CHILD_SELECT, household: { select: { id: true, parentName: true } } },
    });
    const child = user ? toChild(user) : null;
    if (!child) throw new NotFoundError("Child");

    return {
      householdId: user!.household?.id ?? null,
      parentName: user!.household?.parentName ?? null,
      children: [child],
      isSingleChild: true,
    };
  }

  const household = await prisma.household.findFirst({
    where:
      kind === "email"
        ? { email: value.toLowerCase() }
        : { phone: normalisePhone(value) },
    select: {
      id: true,
      parentName: true,
      children: {
        where: { role: "PATIENT", deletedAt: null },
        select: CHILD_SELECT,
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (household) {
    const children = household.children.map(toChild);
    return {
      householdId: household.id,
      parentName: household.parentName,
      children,
      isSingleChild: children.length === 1,
    };
  }

  // No household row — fall back to the pre-household shape, where the
  // parent's email is the child account's own email.
  if (kind === "email") {
    const user = await prisma.user.findFirst({
      where: { email: value.toLowerCase(), role: "PATIENT", deletedAt: null },
      select: CHILD_SELECT,
    });
    const child = user ? toChild(user) : null;
    if (child) {
      return {
        householdId: null,
        parentName: null,
        children: [child],
        isSingleChild: true,
      };
    }
  }

  throw new NotFoundError("Account");
}

export interface AddChildInput {
  /** Any account already in the household the child is being added to. */
  requestedByUserId: string;
  name: string;
  dateOfBirth?: Date;
  sex?: "FEMALE" | "MALE" | "UNSPECIFIED";
  diagnosisYear?: number;
}

export interface AddChildResult {
  userId: string;
  childId: string;
  email: string;
}

/**
 * Enrols another child under the household of an existing signed-in account.
 *
 * The new account is created `PENDING`, exactly like a self-registered one:
 * a parent adding a second child does not get to skip the coordinator's
 * accept/reject step, because enrolment into the study is the coordinator's
 * decision, not the parent's. The child appears in the picker straight away
 * with that status so the parent can see it is awaiting approval.
 *
 * The new account shares the parent's password: whichever sibling's
 * credential the requester signed in with is copied onto the new account's
 * own `Account` row (Better Auth resolves a sign-in to one specific `User`,
 * so each child needs its own credential row even though the password is
 * identical). Skipping this step is what used to leave a newly added child
 * with no credential at all — sign-in for that child failed outright, even
 * with the correct household password, because there was nothing to check
 * it against.
 */
export async function addChild(input: AddChildInput): Promise<AddChildResult> {
  const requester = await prisma.user.findUnique({
    where: { id: input.requestedByUserId },
    select: { id: true, email: true, householdId: true, name: true },
  });
  if (!requester) throw new NotFoundError("Account");

  const credential = await prisma.account.findFirst({
    where: { userId: requester.id, providerId: "credential" },
    select: { password: true },
  });
  if (!credential?.password) {
    // Should not happen for a signed-in account, but a child added under
    // one with no credential of its own would otherwise be silently
    // unusable — fail loudly instead.
    throw new ConflictError("This account has no password set to share with the new child.");
  }

  const householdId = requester.householdId ?? (await backfillHousehold(requester.id));
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: { id: true, email: true },
  });
  if (!household) throw new NotFoundError("Household");

  const participantCode = await nextParticipantCode();
  const email = childEmailFor(household.email, participantCode);

  const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (clash) throw new ConflictError("That child already appears to be enrolled.");

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: input.name,
        role: "PATIENT",
        status: "PENDING",
        householdId: household.id,
        // The parent's address was already verified when the household was
        // created; this alias delivers to that same inbox, so re-verifying it
        // would only stall the parent behind an email they can't act on.
        emailVerified: true,
        profile: {
          create: {
            participantCode,
            name: input.name,
            dateOfBirth: input.dateOfBirth,
            sex: input.sex ?? "UNSPECIFIED",
            diabetesType: STUDY_DIABETES_TYPE,
            diagnosisYear: input.diagnosisYear,
          },
        },
      },
      select: { id: true, email: true },
    });

    await tx.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: credential.password,
      },
    });

    return user;
  });

  return { userId: created.id, childId: participantCode, email: created.email };
}

/**
 * Gives a pre-household account a household of its own, so that adding a
 * second child works for participants enrolled before this feature existed.
 * Their existing email becomes the household's parent email.
 */
export async function backfillHousehold(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, householdId: true, profile: { select: { phone: true } } },
  });
  if (!user) throw new NotFoundError("Account");
  if (user.householdId) return user.householdId;

  const phone = user.profile?.phone ? normalisePhone(user.profile.phone) : null;
  const household = await prisma.household.create({
    data: {
      email: user.email.toLowerCase(),
      // Only claim the phone if no other household has it — a shared clinic
      // number in an imported record must not block household creation.
      phone: phone && !(await prisma.household.findUnique({ where: { phone } })) ? phone : null,
      parentName: user.name,
      children: { connect: { id: user.id } },
    },
    select: { id: true },
  });

  return household.id;
}

/** The signed-in child's siblings, for the in-app "switch child" list. */
export async function listSiblings(userId: string): Promise<HouseholdChild[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { householdId: true },
  });
  if (!user?.householdId) {
    const self = await prisma.user.findUnique({ where: { id: userId }, select: CHILD_SELECT });
    const child = self ? toChild(self) : null;
    return child ? [child] : [];
  }

  const rows = await prisma.user.findMany({
    where: { householdId: user.householdId, role: "PATIENT", deletedAt: null },
    select: CHILD_SELECT,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toChild);
}
