import type { Metadata } from "next";

import { HelpBookTopicForm } from "@/components/admin/content/help-book-topic-form";
import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { isStorageConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "New topic" };

/**
 * Writing a topic, or adding its second language.
 *
 * The `topic` and `language` search params are set by the "Add Tamil" /
 * "Add English" buttons on the library screen. They carry the existing
 * topic's identity so the new version pairs with it rather than becoming an
 * unrelated topic that happens to have a similar title.
 */
export default async function NewHelpBookTopicPage(
  props: PageProps<"/admin/content/education/new">,
) {
  const searchParams = await props.searchParams;

  const slug = typeof searchParams.topic === "string" ? searchParams.topic : undefined;
  const language: "EN" | "TA" | undefined =
    searchParams.language === "TA" ? "TA" : searchParams.language === "EN" ? "EN" : undefined;
  const addingLanguageTo = slug && language ? { slug, language } : undefined;

  return (
    <PageContainer>
      <PageHeader
        title={addingLanguageTo ? `Add the ${addingLanguageTo.language === "TA" ? "Tamil" : "English"} version` : "New topic"}
        description={
          addingLanguageTo
            ? "Write this topic in the second language. Nobody sees it until you set it live."
            : "Write a new Help Book topic. Nobody sees it until you set it live."
        }
        breadcrumbs={[
          { label: "What families see" },
          { label: "Help Book", href: "/admin/content/education" },
          { label: addingLanguageTo ? "Add a language" : "New topic" },
        ]}
      />
      <HelpBookTopicForm
        mode="create"
        addingLanguageTo={addingLanguageTo}
        storageConfigured={isStorageConfigured()}
      />
    </PageContainer>
  );
}
