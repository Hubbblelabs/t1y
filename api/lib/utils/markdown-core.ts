import { marked } from "marked";

import { sanitizeRichText } from "@/lib/utils/sanitize-core";

/**
 * Renders Markdown into the sanitised HTML actually stored and served. Split
 * out from `markdown.ts` (which carries a `server-only` guard) for the same
 * reason as `sanitize-core.ts` — `scripts/import-content.ts` needs the exact
 * same render path the admin CMS uses, run outside Next's server context.
 *
 * Markdown was chosen over a WYSIWYG editor specifically because CommonMark +
 * GFM cannot produce anything outside `sanitizeRichText`'s allowlist (no
 * `span`, `div`, or arbitrary attributes) — the sanitiser stays a safety net
 * here rather than silently discarding formatting an editor produced.
 */

marked.setOptions({ gfm: true, breaks: false });

/**
 * Demotes any `#`/`##` heading to `<h3>`/`<h4>` so an imported or authored
 * article body never emits an `<h1>` (which would compete with the page
 * title) or an `<h2>` (reserved for the mobile client's own section
 * headers). `sanitizeRichText` also strips `h1` outright, so an un-demoted
 * `# Heading` would silently vanish rather than error — demoting here gives
 * a predictable, visible result instead.
 */
function demoteHeadings(html: string): string {
  return html
    .replace(/<h1(\s[^>]*)?>/g, "<h3$1>")
    .replace(/<\/h1>/g, "</h3>")
    .replace(/<h2(\s[^>]*)?>/g, "<h4$1>")
    .replace(/<\/h2>/g, "</h4>");
}

export function renderMarkdown(markdown: string): string {
  const rawHtml = marked.parse(markdown, { async: false });
  return sanitizeRichText(demoteHeadings(rawHtml));
}
