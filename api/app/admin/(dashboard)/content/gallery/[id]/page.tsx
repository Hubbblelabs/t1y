import type { Metadata } from "next";

import { GalleryItemForm } from "@/components/admin/content/gallery-item-form";
import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { getGalleryItem } from "@/lib/services/gallery";

export const metadata: Metadata = { title: "Edit gallery item" };

export default async function EditGalleryItemPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const item = await getGalleryItem(id);

  return (
    <PageContainer>
      <PageHeader
        title={item.title}
        breadcrumbs={[{ label: "What families see" }, { label: "Gallery", href: "/admin/content/gallery" }, { label: item.title }]}
      />
      <GalleryItemForm
        itemId={id}
        initial={{
          kind: item.kind,
          url: item.url,
          thumbnailUrl: item.thumbnailUrl ?? "",
          title: item.title,
          titleTa: item.titleTa ?? "",
          caption: item.caption ?? "",
          captionTa: item.captionTa ?? "",
          active: item.active,
        }}
      />
    </PageContainer>
  );
}
