import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const galleryItemSchema = z.object({
  kind: z.enum(["IMAGE", "VIDEO"]),
  url: z.url("Add the picture or video first.").max(2000),
  thumbnailUrl: z.url().max(2000).nullish().transform((v) => v ?? undefined),
  title: z.string().trim().min(1, "Enter a title.").max(120),
  titleTa: optionalText(120),
  caption: optionalText(500),
  captionTa: optionalText(500),
  active: z.boolean().default(true),
});

export type GalleryItemInput = z.infer<typeof galleryItemSchema>;
