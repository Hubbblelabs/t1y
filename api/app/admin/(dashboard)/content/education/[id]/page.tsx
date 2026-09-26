import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/admin/delete-button";
import { HelpBookTopicForm, type TopicBlock } from "@/components/admin/content/help-book-topic-form";
import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { isStorageConfigured } from "@/lib/env";
import { getEducationById } from "@/lib/services/education";

export const metadata: Metadata = { title: "Edit topic" };

export default async function EditHelpBookTopicPage(
  props: PageProps<"/admin/content/education/[id]">,
) {
  const params = await props.params;

  const topic = await getEducationById(params.id).catch(() => null);
  if (!topic) notFound();

  return (
    <PageContainer>
      <PageHeader
        title={topic.title}
        description={`${topic.locale === "EN" ? "English" : "Tamil"} version`}
        breadcrumbs={[
          { label: "What families see" },
          { label: "Help Book", href: "/admin/content/education" },
          { label: "Edit" },
        ]}
        actions={
          <DeleteButton
            resourceLabel="topic"
            deleteUrl={`/api/admin/education/${topic.id}`}
            redirectTo="/admin/content/education"
          />
        }
      />
      <HelpBookTopicForm
        mode="edit"
        initial={{
          id: topic.id,
          slug: topic.slug,
          locale: topic.locale,
          title: topic.title,
          description: topic.description ?? "",
          category: topic.category,
          status: topic.status,
          thumbnailUrl: topic.thumbnailUrl,
          blocks: toEditableBlocks(topic.contentBlocks),
        }}
        storageConfigured={isStorageConfigured()}
      />
    </PageContainer>
  );
}

/**
 * Normalises whatever is stored into the editor's block shape.
 *
 * Existing topics were written by the importer in an older, narrower shape —
 * `{paragraph, imageUrl}` with no `kind` and HTML rather than plain text in
 * the paragraph (see scripts/split-content-blocks.ts). Those rows must open
 * in this editor without a migration, so the kind is inferred from whichever
 * media field is present and the paragraph's markup is reduced to the text a
 * person actually wrote.
 */
function toEditableBlocks(stored: unknown): TopicBlock[] {
  if (!Array.isArray(stored) || stored.length === 0) {
    return [{ kind: "TEXT", heading: "", paragraph: "", imageUrl: null, imageKey: null, videoUrl: null }];
  }

  return stored.map((raw) => {
    const block = (raw ?? {}) as Record<string, unknown>;
    const imageUrl = typeof block.imageUrl === "string" && block.imageUrl ? block.imageUrl : null;
    const videoUrl = typeof block.videoUrl === "string" && block.videoUrl ? block.videoUrl : null;

    const kind: TopicBlock["kind"] =
      block.kind === "TEXT" || block.kind === "IMAGE" || block.kind === "VIDEO"
        ? block.kind
        : videoUrl
          ? "VIDEO"
          : imageUrl
            ? "IMAGE"
            : "TEXT";

    return {
      kind,
      heading: typeof block.heading === "string" ? block.heading : "",
      paragraph: htmlToPlainText(typeof block.paragraph === "string" ? block.paragraph : ""),
      imageUrl,
      imageKey: typeof block.imageKey === "string" ? block.imageKey : null,
      videoUrl,
    };
  });
}

/**
 * The editor holds plain text, not markup. Imported paragraphs may carry
 * simple HTML, so tags are dropped and the handful of entities the importer
 * can emit are decoded — anything richer was never authorable here anyway.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
