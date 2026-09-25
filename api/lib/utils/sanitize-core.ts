import sanitizeHtml from "sanitize-html";

/**
 * Sanitises administrator-authored rich text. Split out from `sanitize.ts`
 * (which carries a `server-only` guard) so this exact logic is also usable
 * from `scripts/import-content.ts`, which runs under plain Node/tsx outside
 * Next's server-component context — `server-only` throws unconditionally
 * there. Everything under app/ and lib/services should keep importing from
 * `sanitize.ts`, not this file, so the server-only guard still applies to
 * request-handling code.
 *
 * Education articles and exercise instructions are stored as HTML and rendered
 * by both the dashboard and the Flutter client, so unsanitised input would be
 * a stored-XSS vector reaching every participant. Sanitising happens on write
 * rather than on render, so the stored value is safe for any consumer.
 */

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "blockquote",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "a",
  "code",
  "pre",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "img",
  "figure",
  "figcaption",
];

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    },
    // No `javascript:` or `data:` URLs.
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    transformTags: {
      // External links must not be able to reach back into the opener.
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.target === "_blank" ? { rel: "noopener noreferrer" } : {}),
        },
      }),
    },
    disallowedTagsMode: "discard",
  });
}

/** Strips all markup, for excerpts and plain-text exports. */
export function toPlainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalises a title into a URL-safe slug. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
