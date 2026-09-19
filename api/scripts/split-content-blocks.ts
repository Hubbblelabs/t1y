/**
 * Splits each EducationContent row's already-imported `body` HTML into
 * `contentBlocks` — an ordered `{paragraph, imageUrl, imageKey}[]` — for the
 * Help Book's slideshow reading layout: one block per slide, each its own
 * image and paragraph. A paragraph's `<img>` is always pulled out into its
 * block's `imageUrl` and never left inline — a slide's text is text only,
 * never an image sitting mid-paragraph.
 *
 * Source of truth: the sanitised `body` HTML already in the database (not
 * the original .docx — that HTML is itself derived losslessly from the
 * source document by scripts/import-content.ts, and re-parsing it here
 * keeps this script independent of docx internals). No paragraph text is
 * reworded — each block's `paragraph` is the exact original HTML fragment
 * for that element.
 *
 * Two things are stripped out of the block flow entirely, not just left in
 * place:
 *
 *   1. Q&A paragraph pairs ("Q. ..." immediately followed by "Ans. ...") —
 *      these are FAQ-style content, not part of the linear narrative, and
 *      belong in the Quizzes feature instead. They're written to
 *      content/extracted-qa.json for a follow-up quiz-authoring pass (see
 *      scripts/author-quizzes-from-qa.ts) rather than converted
 *      automatically — turning an open Q&A into a graded multiple-choice
 *      question requires writing plausible wrong answers, which is judgment
 *      this script shouldn't exercise silently.
 *
 * Image association: every `<img>` found in the source — whether it was
 * alone in its own `<p>` or sitting inline next to text — is removed from
 * the paragraph and becomes the "current image", applied to that block (if
 * any text remains after removing the image) and every following block
 * until the next image, matching how a figure introduces the passage below
 * it in the source documents. A block with no image yet at its position
 * falls back to that topic's `thumbnailUrl`, then to a generic fallback —
 * so `imageUrl` is never empty.
 *
 * Run: npx tsx scripts/split-content-blocks.ts [--apply]
 * Without --apply, prints a dry-run summary and writes nothing.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { Parser } from "htmlparser2";
import { DomHandler, type ChildNode, type Element } from "domhandler";
import { textContent } from "domutils";
import render from "dom-serializer";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const FALLBACK_IMAGE = "/content/fallback-topic.webp";

interface ContentBlock {
  paragraph: string;
  imageUrl: string | null;
  imageKey: string | null;
}

interface QaPair {
  slug: string;
  locale: string;
  question: string;
  answer: string;
}

const BLOCK_TAGS = new Set(["p", "h2", "h3", "h4", "ul", "ol", "blockquote", "table", "figure", "hr"]);

/** htmlparser2's Parser.write/end resolve the DomHandler callback
 *  synchronously, so this can be called and used like a normal sync
 *  function despite DomHandler's callback-based API. */
function parseSync(html: string): ChildNode[] {
  let result: ChildNode[] | null = null;
  let err: Error | null = null;
  const handler = new DomHandler((error, dom) => {
    err = error;
    result = dom;
  });
  const parser = new Parser(handler);
  parser.write(html);
  parser.end();
  if (err) throw err;
  return result ?? [];
}

function isElement(node: ChildNode): node is Element {
  return node.type === "tag";
}

/**
 * Removes every `<img>` anywhere inside `el` (mutates its children in
 * place) and returns their `src`s in document order. Images never stay
 * inline in a paragraph's text — every one becomes a slide's own picture
 * instead, never something that scrolls past mid-sentence.
 */
function stripImages(el: Element): string[] {
  const found: string[] = [];
  el.children = el.children.filter((child) => {
    if (isElement(child)) {
      if (child.tagName === "img") {
        const src = child.attribs.src as string | undefined;
        if (src) found.push(src);
        return false;
      }
      found.push(...stripImages(child));
    }
    return true;
  });
  return found;
}

function imageKeyFromUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/^\/content\//, "");
}

function splitBody(
  bodyHtml: string,
  slug: string,
  locale: string,
  thumbnailUrl: string | null,
): { blocks: ContentBlock[]; qaPairs: QaPair[] } {
  const dom = parseSync(bodyHtml);
  const topLevel = dom.filter(isElement).filter((el) => BLOCK_TAGS.has(el.tagName));

  type RawBlock = { html: string; text: string };
  const rawBlocks: RawBlock[] = [];
  let currentImage: string | null = null;
  const imageAtIndex = new Map<number, string>(); // rawBlocks index -> image active at that point

  for (const el of topLevel) {
    const images = stripImages(el); // mutates el, removing every <img>
    if (images.length > 0) currentImage = images[images.length - 1]!;

    const text = textContent(el).trim();
    if (text === "") continue; // was image-only (or now-empty after stripping)

    rawBlocks.push({ html: render(el), text });
    if (currentImage) imageAtIndex.set(rawBlocks.length - 1, currentImage);
  }

  // Strip Q&A pairs: a block whose text opens with a question marker
  // immediately followed by one opening with an answer marker. English
  // content uses "Q." / "Ans."; the Tamil translations use "கே." (question)
  // / "பதில்" (answer) instead of translating the Latin abbreviations.
  const Q_MARKER = /^(Q[.\s]|கே\.)/;
  const A_MARKER = /^(Ans[.\s]?|பதில்[:.\s]?)/;
  const qaPairs: QaPair[] = [];
  const keepIndices: boolean[] = rawBlocks.map(() => true);
  for (let i = 0; i < rawBlocks.length - 1; i++) {
    const q = rawBlocks[i]!;
    const a = rawBlocks[i + 1]!;
    if (Q_MARKER.test(q.text) && A_MARKER.test(a.text)) {
      keepIndices[i] = false;
      keepIndices[i + 1] = false;
      qaPairs.push({
        slug,
        locale,
        question: q.text.replace(Q_MARKER, "").trim(),
        answer: a.text.replace(A_MARKER, "").trim(),
      });
      i++; // skip the answer block too
    }
  }

  // Forward-fill image association, falling back to the topic thumbnail
  // (then a generic placeholder) for any block before the first image.
  let lastImage: string | null = null;
  const blocks: ContentBlock[] = [];
  for (let i = 0; i < rawBlocks.length; i++) {
    if (!keepIndices[i]) continue;
    const assigned = imageAtIndex.get(i);
    if (assigned) lastImage = assigned;
    const imageUrl = lastImage ?? thumbnailUrl ?? FALLBACK_IMAGE;
    blocks.push({
      paragraph: rawBlocks[i]!.html,
      imageUrl,
      imageKey: imageKeyFromUrl(imageUrl),
    });
  }

  return { blocks, qaPairs };
}

async function main() {
  const apply = process.argv.includes("--apply");

  const rows = await prisma.educationContent.findMany({
    select: { id: true, slug: true, locale: true, body: true, thumbnailUrl: true, status: true },
    orderBy: [{ slug: "asc" }, { locale: "asc" }],
  });

  const allQaPairs: QaPair[] = [];
  let totalBlocks = 0;

  for (const row of rows) {
    const { blocks, qaPairs } = splitBody(row.body, row.slug, row.locale, row.thumbnailUrl);
    totalBlocks += blocks.length;
    allQaPairs.push(...qaPairs);

    console.log(
      `${row.slug} (${row.locale}): ${blocks.length} blocks, ${qaPairs.length} Q&A pairs stripped`,
    );

    if (apply) {
      await prisma.educationContent.update({
        where: { id: row.id },
        data: { contentBlocks: blocks as unknown as object },
      });
    }
  }

  console.log(`\n${rows.length} topics processed, ${totalBlocks} total blocks, ${allQaPairs.length} Q&A pairs found.`);

  writeFileSync("content/extracted-qa.json", JSON.stringify(allQaPairs, null, 2));
  console.log(`Q&A pairs written to content/extracted-qa.json for the quiz-authoring pass.`);

  if (!apply) {
    console.log(`\nDry run — nothing written to the database. Re-run with --apply to save contentBlocks.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
