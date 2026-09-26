/**
 * Uploads the locally-extracted content figures to Cloudinary and repoints
 * every article at the CDN.
 *
 * The content importer writes figures to `public/content/<slug>-<locale>/`
 * and references them as site-relative `/content/...` paths. That works for
 * development — Next serves them straight off disk — but ships ~3.5 MB of
 * images inside the app's API host and gives no CDN, no caching headers and
 * no edge locations for participants on 3G in Coimbatore.
 *
 * This script is the migration to Cloudinary. It is safe to run repeatedly:
 *
 *   - The object key is the image's own sha256 (already the filename), so an
 *     unchanged image maps to the same key and re-uploading is a no-op write.
 *   - A `MediaAsset` row is recorded per object; `key` is unique, so the
 *     second run skips anything already uploaded rather than re-sending it.
 *   - Body/thumbnail rewriting is idempotent: URLs already pointing at
 *     Cloudinary are left alone.
 *
 * Requires the Cloudinary credentials in `.env`:
 *
 *   CLOUDINARY_CLOUD_NAME=…
 *   CLOUDINARY_API_KEY=…
 *   CLOUDINARY_API_SECRET=…
 *
 * Run with:  npx tsx scripts/upload-content-images.ts [--dry-run]
 *
 * NOTE: the local files under `public/content/` are deliberately NOT deleted.
 * They stay as the offline/initial-install fallback described in the build
 * plan, and as a recovery path if the bucket is ever lost.
 */

import "dotenv/config";

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { v2 as cloudinary } from "cloudinary";

import { PrismaClient } from "../generated/prisma/client";

// `lib/env.ts` and `lib/storage/cloudinary.ts` both import "server-only",
// which throws outside Next's react-server condition — so this script reads
// the same environment variables and configures its own Cloudinary client
// rather than reusing them. Same pattern as scripts/import-content.ts.
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

async function putObject(params: { key: string; body: Buffer }): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const stream = client().uploader.upload_stream(
      { public_id: params.key, resource_type: "image", overwrite: true },
      (error) => (error ? reject(error) : resolve()),
    );
    stream.end(params.body);
  });
}

function publicUrlFor(key: string, extension: string): string {
  return `https://res.cloudinary.com/${CLOUDINARY.cloudName}/image/upload/${key}${extension}`;
}

const CONTENT_ROOT = path.join(process.cwd(), "public", "content");
/** Key prefix inside Cloudinary; keeps study assets separate from admin uploads. */
const KEY_PREFIX = "t1dpe/content";

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

interface UploadedImage {
  /** Site-relative path as written by the importer, e.g. /content/foo-en/ab12.webp */
  localPath: string;
  key: string;
  publicUrl: string;
  bytes: number;
  contentType: string;
}

async function collectImages(): Promise<
  { localPath: string; absPath: string; contentType: string }[]
> {
  const out: { localPath: string; absPath: string; contentType: string }[] = [];

  let dirs: string[];
  try {
    dirs = await readdir(CONTENT_ROOT);
  } catch {
    console.error(
      `No local content directory at ${CONTENT_ROOT}. Run scripts/import-content.ts first.`,
    );
    process.exit(1);
  }

  for (const dir of dirs) {
    const abs = path.join(CONTENT_ROOT, dir);
    if (!(await stat(abs)).isDirectory()) continue;
    for (const file of await readdir(abs)) {
      const ext = path.extname(file).toLowerCase();
      const contentType = CONTENT_TYPES[ext];
      if (!contentType) {
        console.warn(`  ? skipping ${dir}/${file}: unrecognised extension`);
        continue;
      }
      out.push({
        localPath: `/content/${dir}/${file}`,
        absPath: path.join(abs, file),
        contentType,
      });
    }
  }
  return out;
}

/** MediaAsset.uploadedById is required — attribute these to the import author. */
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
    console.error(
      "No uploader found. Set IMPORT_AUTHOR_EMAIL in api/.env to an existing admin's " +
        "email, or seed an admin account first.",
    );
    process.exit(1);
  }
  return user.id;
}

async function uploadAll(uploaderId: string): Promise<UploadedImage[]> {
  const images = await collectImages();
  console.log(`Found ${images.length} local image(s).`);

  const uploaded: UploadedImage[] = [];

  for (const image of images) {
    const bytes = await readFile(image.absPath);
    // The importer already names files by content hash, but hashing here
    // keeps the key correct even if a file was replaced by hand.
    const sha = createHash("sha256").update(bytes).digest("hex");
    const dir = path.basename(path.dirname(image.absPath));
    const extension = path.extname(image.absPath);
    const key = `${KEY_PREFIX}/${dir}/${sha}`;
    const publicUrl = publicUrlFor(key, extension);

    const existing = await prisma.mediaAsset.findUnique({ where: { key } });
    if (existing) {
      console.log(`  = ${image.localPath}: already uploaded`);
      uploaded.push({
        localPath: image.localPath,
        key,
        publicUrl,
        bytes: bytes.byteLength,
        contentType: image.contentType,
      });
      continue;
    }

    if (isDryRun) {
      console.log(`  » ${image.localPath} → ${key} (${(bytes.byteLength / 1024).toFixed(0)} KB)`);
      uploaded.push({
        localPath: image.localPath,
        key,
        publicUrl,
        bytes: bytes.byteLength,
        contentType: image.contentType,
      });
      continue;
    }

    await putObject({ key, body: bytes });
    await prisma.mediaAsset.create({
      data: {
        key,
        bucket: CLOUDINARY.cloudName!,
        url: publicUrl,
        kind: "IMAGE",
        purpose: "education-media",
        contentType: image.contentType,
        sizeBytes: bytes.byteLength,
        checksum: sha,
        uploadedById: uploaderId,
      },
    });
    console.log(`  ✓ ${image.localPath} → ${key}`);
    uploaded.push({
      localPath: image.localPath,
      key,
      publicUrl,
      bytes: bytes.byteLength,
      contentType: image.contentType,
    });
  }

  return uploaded;
}

/** Repoints article bodies and thumbnails from /content/... to the CDN. */
async function rewriteReferences(uploaded: UploadedImage[]): Promise<void> {
  const byLocalPath = new Map(uploaded.map((u) => [u.localPath, u.publicUrl]));
  const articles = await prisma.educationContent.findMany({
    select: { id: true, slug: true, locale: true, body: true, thumbnailUrl: true },
  });

  let changed = 0;
  for (const article of articles) {
    let body = article.body;
    let thumbnailUrl = article.thumbnailUrl;

    for (const [localPath, publicUrl] of byLocalPath) {
      if (body.includes(localPath)) body = body.split(localPath).join(publicUrl);
      if (thumbnailUrl === localPath) thumbnailUrl = publicUrl;
    }

    if (body === article.body && thumbnailUrl === article.thumbnailUrl) continue;
    changed++;
    if (isDryRun) {
      console.log(`  » ${article.slug}.${article.locale}: would rewrite image URLs`);
      continue;
    }
    await prisma.educationContent.update({
      where: { id: article.id },
      data: { body, thumbnailUrl },
    });
    console.log(`  ✓ ${article.slug}.${article.locale}: image URLs repointed to Cloudinary`);
  }

  if (changed === 0) console.log("  = no article needed rewriting");
}

async function main() {
  console.log(`Uploading content images to Cloudinary${isDryRun ? " (dry run)" : ""}…\n`);

  if (!isStorageConfigured()) {
    console.error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and\n" +
        "CLOUDINARY_API_SECRET in api/.env, then re-run.\n\n" +
        "Until then the app serves these images from the API host at /content/... ,\n" +
        "which works but has no CDN in front of it.",
    );
    process.exit(1);
  }

  const uploaderId = await resolveUploaderId();
  const uploaded = await uploadAll(uploaderId);
  console.log(`\nRewriting article references…`);
  await rewriteReferences(uploaded);

  const totalMb = uploaded.reduce((sum, u) => sum + u.bytes, 0) / 1024 / 1024;
  console.log(
    `\nDone. ${uploaded.length} image(s), ${totalMb.toFixed(1)} MB.` +
      (isDryRun ? " (dry run — nothing was written)" : ""),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
