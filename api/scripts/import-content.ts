import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import mammoth from "mammoth";
import sharp from "sharp";
import TurndownService from "turndown";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import { renderMarkdown } from "../lib/utils/markdown-core";
import { toPlainText } from "../lib/utils/sanitize-core";

/**
 * Imports the drive-export .docx curriculum documents into EducationContent.
 *
 * Run with: npx tsx scripts/import-content.ts [--dry-run] [--only=<slug>] [--force]
 *
 * Three idempotency keys keep re-runs safe:
 *   - sha256(docx bytes)  -> EducationContent.importChecksum (unchanged doc = no-op)
 *   - sha256(image bytes) -> the local media filename (same figure = same URL,
 *     never duplicated, cached clients stay valid)
 *   - (slug, locale)      -> the upsert target
 *
 * Never overwrites a row an admin has hand-edited since import (updatedAt >
 * importedAt) unless --force is passed — a re-import must not silently
 * destroy a correction made through the CMS.
 *
 * Not handled here: quiz extraction. The source documents' quiz/FAQ sections
 * are prose ("State whether True or False", "Write down the correct answer")
 * and cannot be reliably parsed into a structured answer key — see
 * scripts/extract-quizzes.ts, which produces reviewable JSON for a human to
 * correct instead of writing directly to the database.
 */

const CONTENT_DIR = path.join(__dirname, "..", "content");
const DOCX_DIR = path.join(CONTENT_DIR, "docx");
const MEDIA_DIR = path.join(__dirname, "..", "public", "content");
const MEDIA_URL_PREFIX = "/content";

interface ManifestEntry {
  slug: string;
  category: string;
  sortOrder: number;
  tags: string[];
  files: { en: string; ta: string };
}

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isForce = args.includes("--force");
const onlyArg = args.find((a) => a.startsWith("--only="));
const onlySlug = onlyArg?.split("=")[1];

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function extFromContentType(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("bmp")) return "bmp";
  // WMF/EMF and anything else unrecognised — flagged separately, see main().
  return "bin";
}

const MAX_IMAGE_EDGE_PX = 1600;

/**
 * Word figures pasted from a camera or scan are routinely 300 DPI — shipping
 * them raw to a 2GB Android phone over 3G is the difference between a usable
 * app and an unusable one. Re-encodes to WebP capped at 1600px on the long
 * edge; GIFs are left untouched (animation would be lost).
 */
async function resizeForMobile(buffer: Buffer, ext: string): Promise<{ buffer: Buffer; ext: string }> {
  if (ext === "gif") return { buffer, ext };
  try {
    const resized = await sharp(buffer)
      .resize({ width: MAX_IMAGE_EDGE_PX, height: MAX_IMAGE_EDGE_PX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return { buffer: resized, ext: "webp" };
  } catch {
    // A handful of legacy formats sharp can't decode either — fall back to
    // the original bytes rather than failing the whole import over one image.
    return { buffer, ext };
  }
}

interface ConvertResult {
  html: string;
  rawText: string;
  unsupportedImages: string[];
}

async function convertDocx(docxPath: string, mediaSubdir: string): Promise<ConvertResult> {
  const unsupportedImages: string[] = [];

  const [{ value: html }, { value: rawText }] = await Promise.all([
    mammoth.convertToHtml(
      { path: docxPath },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          const contentType = image.contentType ?? "";
          if (contentType.includes("wmf") || contentType.includes("emf") || contentType === "") {
            unsupportedImages.push(contentType || "unknown");
            // Placeholder alt text; the file-level check in main() fails the
            // import loudly rather than shipping a broken <img> to a device.
            return { src: "", alt: "unsupported-image-format" };
          }

          const base64 = await image.read("base64");
          const original = Buffer.from(base64, "base64");
          const originalExt = extFromContentType(contentType);
          const { buffer, ext } = await resizeForMobile(original, originalExt);
          // Hash the resized bytes: the filename is the idempotency key a
          // re-run checks, and it's the resized image that must be stable.
          const filename = `${sha256(buffer)}.${ext}`;
          const destDir = path.join(MEDIA_DIR, mediaSubdir);
          const destPath = path.join(destDir, filename);

          if (!isDryRun) {
            await mkdir(destDir, { recursive: true });
            const exists = await readdir(destDir).then((files) => files.includes(filename)).catch(() => false);
            if (!exists) await writeFile(destPath, buffer);
          }

          return { src: `${MEDIA_URL_PREFIX}/${mediaSubdir}/${filename}` };
        }),
      },
    ),
    mammoth.extractRawText({ path: docxPath }),
  ]);

  return { html, rawText, unsupportedImages };
}

function deriveTitle(rawText: string, fallback: string): string {
  const firstLine = rawText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return fallback;
  return firstLine.slice(0, 200);
}

async function ensureAuthor(): Promise<string> {
  const email = process.env.IMPORT_AUTHOR_EMAIL;
  if (!email) {
    throw new Error("IMPORT_AUTHOR_EMAIL is not set. Add it to .env — see .env.example.");
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    throw new Error(
      `IMPORT_AUTHOR_EMAIL "${email}" does not exist. Run \`npm run db:seed\` first, or set it to a real admin's email.`,
    );
  }
  return user.id;
}

async function importOne(entry: ManifestEntry, locale: "en" | "ta", authorId: string) {
  const filename = entry.files[locale];
  const docxPath = path.join(DOCX_DIR, filename);
  const localeUpper = locale.toUpperCase() as "EN" | "TA";

  const buffer = await readFile(docxPath);
  const checksum = sha256(buffer);

  const existing = await prisma.educationContent.findUnique({
    where: { slug_locale: { slug: entry.slug, locale: localeUpper } },
    select: { id: true, importedAt: true, updatedAt: true, importChecksum: true },
  });

  if (existing?.importChecksum === checksum) {
    console.log(`  = ${entry.slug}.${locale}: unchanged (checksum match), skipping`);
    return;
  }

  if (
    existing &&
    !isForce &&
    existing.importedAt &&
    existing.updatedAt.getTime() > existing.importedAt.getTime()
  ) {
    console.log(
      `  ! ${entry.slug}.${locale}: has been hand-edited since import (updatedAt > importedAt). ` +
        `Skipping — pass --force to overwrite.`,
    );
    return;
  }

  const { html, rawText, unsupportedImages } = await convertDocx(docxPath, `${entry.slug}-${locale}`);
  if (unsupportedImages.length > 0) {
    console.error(
      `  ✗ ${entry.slug}.${locale}: ${unsupportedImages.length} embedded image(s) in an unsupported ` +
        `format (${unsupportedImages.join(", ")}) — likely WMF/EMF vector images pasted from Word. ` +
        `Re-export these as PNG in the source document and re-run.`,
    );
    process.exitCode = 1;
    return;
  }

  const markdown = turndown.turndown(html);
  const title = deriveTitle(rawText, `${entry.slug} (${locale})`);
  const bodyHtml = renderMarkdown(markdown);
  const excerpt = toPlainText(bodyHtml).slice(0, 280);

  if (isDryRun) {
    console.log(`  » ${entry.slug}.${locale}: would ${existing ? "update" : "create"} "${title}"`);
    return;
  }

  const data = {
    title,
    description: excerpt,
    excerpt,
    category: entry.category as never,
    body: bodyHtml,
    bodySource: markdown,
    bodyFormat: "MARKDOWN" as const,
    tags: entry.tags,
    sortOrder: entry.sortOrder,
    status: "DRAFT" as const,
    importChecksum: checksum,
    importedAt: new Date(),
  };

  if (existing) {
    await prisma.educationContent.update({
      where: { id: existing.id },
      data: { ...data, version: { increment: 1 } },
    });
    console.log(`  ✓ ${entry.slug}.${locale}: updated "${title}"`);
  } else {
    await prisma.educationContent.create({
      data: { ...data, slug: entry.slug, locale: localeUpper, authorId },
    });
    console.log(`  ✓ ${entry.slug}.${locale}: created "${title}"`);
  }
}

async function main() {
  console.log(`Importing content${isDryRun ? " (dry run)" : ""}${isForce ? " [force]" : ""}…`);

  const manifest: ManifestEntry[] = JSON.parse(
    await readFile(path.join(CONTENT_DIR, "manifest.json"), "utf-8"),
  );
  const entries = onlySlug ? manifest.filter((e) => e.slug === onlySlug) : manifest;
  if (entries.length === 0) {
    throw new Error(`No manifest entry matches --only=${onlySlug}`);
  }

  const authorId = isDryRun ? "dry-run" : await ensureAuthor();

  for (const entry of entries) {
    console.log(`\n${entry.slug} (${entry.category})`);
    await importOne(entry, "en", authorId);
    await importOne(entry, "ta", authorId);
  }

  console.log("\nDone. Imported articles are DRAFT — review and publish via the admin CMS.");
}

main()
  .catch((error) => {
    console.error("\nImport failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
