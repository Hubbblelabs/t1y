/**
 * Restructures every published Help Book topic from the reviewed plan in
 * `content/help-book-restructure.json`:
 *
 *   - at most five sections per topic, each with a heading, its text and one
 *     picture (the importer had left 30–390 one-paragraph slides per topic);
 *   - quiz, true/false and Q&A material removed from the reading text, along
 *     with duplicated paragraphs, PDF page headers and figure captions;
 *   - every section image replaced with one that actually illustrates it — the
 *     originals were mostly phone screenshots of whole magazine pages, and
 *     three topics pointed at a fallback file that never existed (404);
 *   - topics with nothing left after that (both `exercise` rows, a leftover
 *     test topic) are moved back to DRAFT, not deleted.
 *
 * The plan is data, produced by a reviewed analysis of the live content; this
 * script only renders the section pictures and writes the result.
 *
 * Run:
 *   npx tsx scripts/restructure-help-book.ts                 # dry run
 *   npx tsx scripts/restructure-help-book.ts --preview <dir> # render images only
 *   npx tsx scripts/restructure-help-book.ts --apply
 *
 * --apply first writes every EducationContent row to
 * content/backups/help-book-before-restructure-<timestamp>.json, which is
 * enough to restore the previous state row by row.
 */
import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ROOT = path.resolve(__dirname, "..");
const PLAN_PATH = path.join(ROOT, "content/help-book-restructure.json");
const KEY_PREFIX = "t1dpe/help-book";
const WIDTH = 1200;
const HEIGHT = 800;

type Locale = "EN" | "TA";

interface Plan {
  topics: Array<{
    slug: string;
    locale: Locale;
    title: string;
    cover: string;
    sections: Array<{ heading: string; paragraph: string; image: string }>;
  }>;
  unpublish: Array<{ slug: string; locale: Locale; reason: string }>;
  palettes: Record<string, [string, string, string, string]>;
  images: Record<string, { palette: string; type: "icons" | "figure"; src: string | string[] }>;
}

type IconNode = Array<[string, Record<string, string>]>;

async function iconMarkup(name: string): Promise<string> {
  const mod = (await import(`lucide-react/dist/esm/icons/${name}.mjs`)) as { __iconNode: IconNode };
  return mod.__iconNode
    .map(([tag, attrs]) => {
      const attributes = Object.entries(attrs)
        .filter(([k]) => k !== "key")
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      return `<${tag} ${attributes}/>`;
    })
    .join("");
}

function background(palette: [string, string, string, string]): string {
  const [from, to, accent] = palette;
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="14" stdDeviation="20" flood-color="#0D2A4A" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <circle cx="1090" cy="100" r="200" fill="${accent}" opacity="0.10"/>
  <circle cx="110" cy="730" r="240" fill="${accent}" opacity="0.08"/>
  <circle cx="1015" cy="700" r="28" fill="${accent}" opacity="0.22"/>
  <circle cx="175" cy="120" r="18" fill="${accent}" opacity="0.22"/>
  <circle cx="1120" cy="420" r="10" fill="${accent}" opacity="0.30"/>`;
}

async function renderIcons(palette: [string, string, string, string], icons: string[]): Promise<Buffer> {
  const [, , accent, ink] = palette;
  const [main, left, right] = await Promise.all(icons.map(iconMarkup));
  // Lucide icons are drawn on a 24-unit grid.
  const icon = (markup: string, cx: number, cy: number, size: number, color: string) =>
    `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 24})" fill="none" stroke="${color}"
        stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${markup}</g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  ${background(palette)}
  <circle cx="600" cy="400" r="210" fill="#FFFFFF" filter="url(#shadow)"/>
  ${icon(main!, 600, 400, 230, accent)}
  <circle cx="318" cy="245" r="96" fill="#FFFFFF" filter="url(#shadow)"/>
  ${icon(left!, 318, 245, 104, ink)}
  <circle cx="884" cy="570" r="96" fill="#FFFFFF" filter="url(#shadow)"/>
  ${icon(right!, 884, 570, 104, ink)}
</svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 88 }).toBuffer();
}

async function renderFigure(palette: [string, string, string, string], src: string): Promise<Buffer> {
  const figure = sharp(await readFile(path.join(ROOT, src)));
  const meta = await figure.metadata();
  // Small source figures — shown at no more than twice their own size, on a
  // card, rather than stretched edge to edge and blurred.
  const scale = Math.min(2, 900 / meta.width!, 560 / meta.height!);
  const w = Math.round(meta.width! * scale);
  const h = Math.round(meta.height! * scale);
  const pad = 44;
  const cardW = w + pad * 2;
  const cardH = h + pad * 2;
  const cardX = Math.round((WIDTH - cardW) / 2);
  const cardY = Math.round((HEIGHT - cardH) / 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  ${background(palette)}
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="36" fill="#FFFFFF" filter="url(#shadow)"/>
</svg>`;
  const resized = await figure
    .resize(w, h, { kernel: "lanczos3" })
    .flatten({ background: "#FFFFFF" })
    .toBuffer();
  return sharp(Buffer.from(svg))
    .composite([{ input: resized, left: cardX + pad, top: cardY + pad }])
    .webp({ quality: 88 })
    .toBuffer();
}

async function renderAll(plan: Plan): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>();
  for (const [slot, spec] of Object.entries(plan.images)) {
    const palette = plan.palettes[spec.palette]!;
    out.set(
      slot,
      spec.type === "icons"
        ? await renderIcons(palette, spec.src as string[])
        : await renderFigure(palette, spec.src as string),
    );
  }
  return out;
}

async function uploadAll(images: Map<string, Buffer>): Promise<Map<string, { key: string; url: string }>> {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary credentials are missing from .env — images cannot be published.");
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  const uploader = await resolveUploaderId();
  const out = new Map<string, { key: string; url: string }>();
  for (const [slot, bytes] of images) {
    const sha = createHash("sha256").update(bytes).digest("hex");
    const key = `${KEY_PREFIX}/${slot}-${sha.slice(0, 16)}`;
    const existing = await prisma.mediaAsset.findUnique({ where: { key } });
    if (existing) {
      out.set(slot, { key, url: existing.url });
      continue;
    }
    const url = await new Promise<string>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ public_id: key, resource_type: "image", overwrite: true }, (error, result) =>
          error || !result ? reject(error ?? new Error("empty upload result")) : resolve(result.secure_url),
        )
        .end(bytes);
    });
    await prisma.mediaAsset.create({
      data: {
        key,
        bucket: CLOUDINARY_CLOUD_NAME,
        url,
        kind: "IMAGE",
        purpose: "education-media",
        contentType: "image/webp",
        sizeBytes: bytes.byteLength,
        checksum: sha,
        uploadedById: uploader,
      },
    });
    console.log(`  ✓ uploaded ${slot}`);
    out.set(slot, { key, url });
  }
  return out;
}

async function resolveUploaderId(): Promise<string> {
  const email = process.env.IMPORT_AUTHOR_EMAIL;
  const user = email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
    : await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true }, orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("No admin account to attribute the uploaded images to (set IMPORT_AUTHOR_EMAIL).");
  return user.id;
}

function bodyFor(sections: Plan["topics"][number]["sections"]): string {
  return sections.map((s) => `<h3>${escapeHtml(s.heading)}</h3>\n${s.paragraph}`).join("\n");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function readingMinutes(html: string, locale: Locale): number {
  const words = html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / (locale === "TA" ? 120 : 200)));
}

async function main() {
  const apply = process.argv.includes("--apply");
  const previewIndex = process.argv.indexOf("--preview");
  const plan = JSON.parse(await readFile(PLAN_PATH, "utf8")) as Plan;

  const rows = await prisma.educationContent.findMany({
    orderBy: [{ slug: "asc" }, { locale: "asc" }],
  });
  const bySlugLocale = new Map(rows.map((r) => [`${r.slug}|${r.locale}`, r]));

  for (const t of plan.topics) {
    const row = bySlugLocale.get(`${t.slug}|${t.locale}`);
    if (!row) throw new Error(`No EducationContent row for ${t.slug} (${t.locale}).`);
    const before = Array.isArray(row.contentBlocks) ? row.contentBlocks.length : 0;
    console.log(
      `${t.slug} (${t.locale}): ${before} → ${t.sections.length} sections` +
        (row.title !== t.title ? `, title "${row.title}" → "${t.title}"` : ""),
    );
  }
  for (const u of plan.unpublish) {
    const row = bySlugLocale.get(`${u.slug}|${u.locale}`);
    console.log(`${u.slug} (${u.locale}): ${row ? `${row.status} → DRAFT` : "not found, skipped"} — ${u.reason}`);
  }

  const images = await renderAll(plan);
  console.log(`\nRendered ${images.size} images.`);

  if (previewIndex !== -1) {
    const dir = path.resolve(process.argv[previewIndex + 1] ?? "help-book-preview");
    await mkdir(dir, { recursive: true });
    for (const [slot, bytes] of images) await writeFile(path.join(dir, `${slot}.webp`), bytes);
    console.log(`Preview images written to ${dir}. Nothing uploaded or saved.`);
    return;
  }
  if (!apply) {
    console.log("\nDry run — nothing uploaded or saved. Re-run with --apply.");
    return;
  }

  const backupDir = path.join(ROOT, "content/backups");
  await mkdir(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `help-book-before-restructure-${Date.now()}.json`);
  await writeFile(backupPath, JSON.stringify(rows, null, 1));
  console.log(`Backup of ${rows.length} rows written to ${backupPath}`);

  const uploaded = await uploadAll(images);

  // Seventeen large JSON writes over a remote connection take longer than
  // Prisma's 5-second interactive-transaction default.
  await prisma.$transaction(
    async (tx) => {
      for (const t of plan.topics) {
        const row = bySlugLocale.get(`${t.slug}|${t.locale}`)!;
        const body = bodyFor(t.sections);
        const cover = uploaded.get(t.cover)!;
        await tx.educationContent.update({
          where: { id: row.id },
          data: {
            title: t.title,
            body,
            contentBlocks: t.sections.map((s) => {
              const image = uploaded.get(s.image)!;
              return {
                kind: "IMAGE",
                heading: s.heading,
                paragraph: s.paragraph,
                imageUrl: image.url,
                imageKey: image.key,
                videoUrl: null,
              };
            }),
            thumbnailUrl: cover.url,
            readingTimeMinutes: readingMinutes(body, t.locale),
            version: { increment: 1 },
          },
        });
      }
      for (const u of plan.unpublish) {
        const row = bySlugLocale.get(`${u.slug}|${u.locale}`);
        if (!row) continue;
        await tx.educationContent.update({
          where: { id: row.id },
          data: { status: "DRAFT", publishedAt: null, version: { increment: 1 } },
        });
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  const fallback = uploaded.get("fallback");
  console.log(`\nDone. ${plan.topics.length} topics rewritten, ${plan.unpublish.length} moved to DRAFT.`);
  if (fallback) console.log(`Generic Help Book fallback image: ${fallback.url}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
