/**
 * Uploads the admin thumbnails currently sitting in `.local-uploads/` (the
 * fallback the upload endpoint uses while no Cloudinary credentials are
 * configured — see lib/storage/cloudinary.ts) to Cloudinary, and repoints the
 * `EducationContent` rows whose `thumbnailUrl` is one of the local
 * `/uploads/...` paths.
 *
 * Companion to scripts/upload-content-images.ts, which does the same for the
 * Help Book's imported article figures under `public/content/`.
 *
 * Requires the same CLOUDINARY_* variables in `.env` as upload-content-images.ts.
 *
 * Run with: npx tsx scripts/migrate-local-uploads-to-cloudinary.ts [--dry-run]
 */

import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { v2 as cloudinary } from "cloudinary";

import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const isDryRun = process.argv.includes("--dry-run");

const CLOUDINARY = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
};

function isStorageConfigured(): boolean {
  return Boolean(CLOUDINARY.cloudName && CLOUDINARY.apiKey && CLOUDINARY.apiSecret);
}

let configured = false;
function client() {
  if (!configured) {
    cloudinary.config({
      cloud_name: CLOUDINARY.cloudName,
      api_key: CLOUDINARY.apiKey,
      api_secret: CLOUDINARY.apiSecret,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

function publicUrlFor(key: string, extension: string): string {
  return `https://res.cloudinary.com/${CLOUDINARY.cloudName}/image/upload/${key}${extension}`;
}

const LOCAL_UPLOADS_ROOT = path.join(process.cwd(), ".local-uploads");
/** Key prefix inside Cloudinary; matches lib/storage/cloudinary.ts's folder scheme. */
const KEY_PREFIX = "t1dpe/education-thumbnail";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

async function resolveUploaderId(): Promise<string> {
  const email = process.env.IMPORT_AUTHOR_EMAIL;
  const user = email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
    : await prisma.user.findFirst({
        where: { role: "ADMIN" },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
  if (!user) {
    console.error("No uploader found. Seed an admin account first.");
    process.exit(1);
  }
  return user.id;
}

async function main() {
  console.log(`Moving local uploads to Cloudinary${isDryRun ? " (dry run)" : ""}…\n`);

  if (!isStorageConfigured()) {
    console.error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and\n" +
        "CLOUDINARY_API_SECRET in api/.env, then re-run.",
    );
    process.exit(1);
  }

  // Every EducationContent row whose thumbnail still points at the local
  // fallback — the only place these `/uploads/...` paths are referenced.
  const rows = await prisma.educationContent.findMany({
    where: { thumbnailUrl: { startsWith: "/uploads/" } },
    select: { id: true, slug: true, locale: true, thumbnailUrl: true },
  });

  if (rows.length === 0) {
    console.log("Nothing to migrate — no article points at a local upload.");
    return;
  }

  const uploaderId = await resolveUploaderId();
  let migrated = 0;

  for (const row of rows) {
    const localPath = row.thumbnailUrl!; // e.g. /uploads/education-thumbnail/2026/<uuid>.png
    const absPath = path.join(LOCAL_UPLOADS_ROOT, localPath.replace(/^\/uploads\//, ""));
    const ext = path.extname(absPath).toLowerCase();
    const contentType = CONTENT_TYPES[ext];
    if (!contentType) {
      console.warn(`  ? ${row.slug}.${row.locale}: unrecognised file type at ${absPath}, skipped`);
      continue;
    }

    let bytes: Buffer;
    try {
      bytes = await readFile(absPath);
    } catch {
      console.warn(`  ? ${row.slug}.${row.locale}: file missing at ${absPath}, skipped`);
      continue;
    }

    const sha = createHash("sha256").update(bytes).digest("hex");
    const key = `${KEY_PREFIX}/${sha}`;
    const publicUrl = publicUrlFor(key, ext);

    const existing = await prisma.mediaAsset.findUnique({ where: { key } });
    if (isDryRun) {
      console.log(`  » ${row.slug}.${row.locale}: ${localPath} → ${key}`);
      continue;
    }

    if (!existing) {
      await new Promise<void>((resolve, reject) => {
        const stream = client().uploader.upload_stream(
          { public_id: key, resource_type: "image", overwrite: true },
          (error) => (error ? reject(error) : resolve()),
        );
        stream.end(bytes);
      });
      await prisma.mediaAsset.create({
        data: {
          key,
          bucket: CLOUDINARY.cloudName!,
          url: publicUrl,
          kind: "IMAGE",
          purpose: "education-thumbnail",
          contentType,
          sizeBytes: bytes.byteLength,
          checksum: sha,
          uploadedById: uploaderId,
        },
      });
    }

    await prisma.educationContent.update({
      where: { id: row.id },
      data: { thumbnailUrl: publicUrl },
    });
    migrated++;
    console.log(`  ✓ ${row.slug}.${row.locale}: ${localPath} → ${publicUrl}`);
  }

  console.log(`\nDone. ${migrated} of ${rows.length} thumbnail(s) migrated.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
