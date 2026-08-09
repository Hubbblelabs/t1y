import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type {
  ContentStatus,
  Difficulty,
  ExerciseCategory,
} from "@/generated/prisma/enums";
import { ConflictError, NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { sanitizeRichText } from "@/lib/utils/sanitize";

/** Guided exercise programmes authored by administrators. */

const PUBLIC_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  category: true,
  difficulty: true,
  durationMinutes: true,
  instructions: true,
  equipment: true,
  precautions: true,
  videoUrl: true,
  imageUrl: true,
  publishedAt: true,
} satisfies Prisma.ExerciseContentSelect;

const ADMIN_SELECT = {
  ...PUBLIC_SELECT,
  videoKey: true,
  imageKey: true,
  status: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
  _count: { select: { logs: true } },
} satisfies Prisma.ExerciseContentSelect;

export async function listPublishedPrograms(params: {
  category?: ExerciseCategory;
  difficulty?: Difficulty;
  skip: number;
  take: number;
}) {
  const where: Prisma.ExerciseContentWhereInput = {
    status: "PUBLISHED",
    ...(params.category ? { category: params.category } : {}),
    ...(params.difficulty ? { difficulty: params.difficulty } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.exerciseContent.findMany({
      where,
      select: { ...PUBLIC_SELECT, instructions: false },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      skip: params.skip,
      take: params.take,
    }),
    prisma.exerciseContent.count({ where }),
  ]);

  return { items, total };
}

export async function getPublishedProgramBySlug(slug: string) {
  const program = await prisma.exerciseContent.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: PUBLIC_SELECT,
  });
  if (!program) throw new NotFoundError("Exercise programme");
  return program;
}

export async function listProgramsForAdmin(params: {
  status?: ContentStatus;
  category?: ExerciseCategory;
  difficulty?: Difficulty;
  search?: string;
  skip: number;
  take: number;
}) {
  const where: Prisma.ExerciseContentWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.category ? { category: params.category } : {}),
    ...(params.difficulty ? { difficulty: params.difficulty } : {}),
    ...(params.search
      ? { title: { contains: params.search, mode: "insensitive" } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.exerciseContent.findMany({
      where,
      select: { ...ADMIN_SELECT, instructions: false },
      orderBy: { updatedAt: "desc" },
      skip: params.skip,
      take: params.take,
    }),
    prisma.exerciseContent.count({ where }),
  ]);

  return { items, total };
}

export async function getProgramById(id: string) {
  const program = await prisma.exerciseContent.findUnique({
    where: { id },
    select: ADMIN_SELECT,
  });
  if (!program) throw new NotFoundError("Exercise programme");
  return program;
}

export interface ProgramInput {
  slug: string;
  title: string;
  description: string;
  category: ExerciseCategory;
  difficulty: Difficulty;
  durationMinutes: number;
  instructions: string;
  equipment?: string[];
  /** Safety notes shown before a participant starts the programme. */
  precautions?: string | null;
  videoUrl?: string | null;
  videoKey?: string | null;
  imageUrl?: string | null;
  imageKey?: string | null;
  status?: ContentStatus;
  sortOrder?: number;
}

export async function createProgram(authorId: string, input: ProgramInput) {
  const existing = await prisma.exerciseContent.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (existing) throw new ConflictError("A programme with this slug already exists.");

  return prisma.exerciseContent.create({
    data: {
      ...input,
      instructions: sanitizeRichText(input.instructions),
      equipment: input.equipment ?? [],
      publishedAt: input.status === "PUBLISHED" ? new Date() : null,
      authorId,
    },
    select: ADMIN_SELECT,
  });
}

export async function updateProgram(id: string, input: Partial<ProgramInput>) {
  const current = await prisma.exerciseContent.findUnique({
    where: { id },
    select: { publishedAt: true },
  });
  if (!current) throw new NotFoundError("Exercise programme");

  const publishedAt =
    input.status === "PUBLISHED" && current.publishedAt === null
      ? new Date()
      : input.status === "DRAFT"
        ? null
        : undefined;

  return prisma.exerciseContent.update({
    where: { id },
    data: {
      ...input,
      ...(input.instructions !== undefined
        ? { instructions: sanitizeRichText(input.instructions) }
        : {}),
      ...(publishedAt !== undefined ? { publishedAt } : {}),
    },
    select: ADMIN_SELECT,
  });
}

export async function deleteProgram(id: string): Promise<void> {
  await prisma.exerciseContent.delete({ where: { id } });
}

export async function getProgramStats() {
  const grouped = await prisma.exerciseContent.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const counts = new Map(grouped.map((row) => [row.status, row._count._all]));

  return {
    total: grouped.reduce((sum, row) => sum + row._count._all, 0),
    published: counts.get("PUBLISHED") ?? 0,
    draft: counts.get("DRAFT") ?? 0,
    archived: counts.get("ARCHIVED") ?? 0,
  };
}
