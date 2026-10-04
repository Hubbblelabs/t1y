import "server-only";

import { NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import type { GalleryItemInput } from "@/lib/validation/gallery";

/** The Gallery: pictures and videos the study team adds for every family. */

export async function listGalleryItems() {
  return prisma.galleryItem.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
}

export async function getGalleryItem(id: string) {
  const item = await prisma.galleryItem.findUnique({ where: { id } });
  if (!item) throw new NotFoundError("Gallery item");
  return item;
}

export async function createGalleryItem(input: GalleryItemInput) {
  const first = await prisma.galleryItem.aggregate({ _min: { sortOrder: true } });
  // Newest first: a new item goes ahead of everything already there.
  return prisma.galleryItem.create({ data: { ...input, sortOrder: (first._min.sortOrder ?? 0) - 1 } });
}

export async function updateGalleryItem(id: string, input: GalleryItemInput) {
  await getGalleryItem(id);
  return prisma.galleryItem.update({
    where: { id },
    data: {
      ...input,
      // Clearing a field in the form must clear it in the database.
      thumbnailUrl: input.thumbnailUrl ?? null,
      titleTa: input.titleTa ?? null,
      caption: input.caption ?? null,
      captionTa: input.captionTa ?? null,
    },
  });
}

export async function deleteGalleryItem(id: string): Promise<void> {
  await getGalleryItem(id);
  await prisma.galleryItem.delete({ where: { id } });
}

/** What the app shows: live items only, in order. */
export async function listGalleryForApp() {
  return prisma.galleryItem.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      kind: true,
      url: true,
      thumbnailUrl: true,
      title: true,
      titleTa: true,
      caption: true,
      captionTa: true,
    },
  });
}
