import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { EducationForm } from "@/components/admin/content/education-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { getEducationById } from "@/lib/services/education";

export const metadata: Metadata = { title: "Edit article" };

export default async function EditEducationPage(
  props: PageProps<"/admin/content/education/[id]">,
) {
  const params = await props.params;

  const article = await getEducationById(params.id).catch(() => null);
  if (!article) notFound();

  return (
    <PageContainer>
      <PageHeader
        title={article.title}
        description={`/${article.slug} · ${article.locale === "EN" ? "English" : "Tamil"}`}
        breadcrumbs={[
          { label: "Content" },
          { label: "Education", href: "/admin/content/education" },
          { label: "Edit" },
        ]}
        actions={
          <DeleteButton
            resourceLabel="article"
            deleteUrl={`/api/admin/education/${article.id}`}
            redirectTo="/admin/content/education"
          />
        }
      />
      <EducationForm
        mode="edit"
        initial={{
          id: article.id,
          slug: article.slug,
          locale: article.locale,
          title: article.title,
          description: article.description ?? "",
          excerpt: article.excerpt ?? "",
          category: article.category,
          bodySource: article.bodySource ?? "",
          status: article.status,
          tags: article.tags.join(", "),
          sortOrder: article.sortOrder,
        }}
      />
    </PageContainer>
  );
}
