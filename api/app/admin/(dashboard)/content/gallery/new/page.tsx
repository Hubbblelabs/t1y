import type { Metadata } from "next";

import { GalleryItemForm } from "@/components/admin/content/gallery-item-form";
import { PageContainer, PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Add to gallery" };

export default function NewGalleryItemPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Add to gallery"
        breadcrumbs={[{ label: "What families see" }, { label: "Gallery", href: "/admin/content/gallery" }, { label: "Add" }]}
      />
      <GalleryItemForm />
    </PageContainer>
  );
}
