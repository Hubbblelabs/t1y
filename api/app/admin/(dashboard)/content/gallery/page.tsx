import type { Metadata } from "next";
import Link from "next/link";
import { Images, Plus, Play } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { listGalleryItems } from "@/lib/services/gallery";

export const metadata: Metadata = { title: "Gallery" };

/** The pictures and videos every family can browse in the app. */
export default async function GalleryPage() {
  const items = await listGalleryItems();

  return (
    <PageContainer>
      <PageHeader
        title="Gallery"
        description="Pictures and videos shown to every family in the app"
        breadcrumbs={[{ label: "What families see" }, { label: "Gallery" }]}
        actions={
          <Button asChild variant="primary">
            <Link href="/admin/content/gallery/new">
              <Plus className="size-4" aria-hidden="true" />
              Add picture or video
            </Link>
          </Button>
        }
      />

      <Card>
        {items.length === 0 ? (
          <EmptyState icon={Images} title="Nothing in the gallery yet" description="Add a picture or video and families will see it in the app." />
        ) : (
          <ul className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const still = item.kind === "IMAGE" ? item.url : item.thumbnailUrl;
              return (
                <li key={item.id}>
                  <Link href={`/admin/content/gallery/${item.id}`} className="border-line hover:bg-surface-hover block overflow-hidden rounded-lg border">
                    <div className="bg-surface-sunken relative flex aspect-[3/2] items-center justify-center">
                      {still ? (
                        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded media of unknown size
                        <img src={still} alt="" className="h-full w-full object-cover" />
                      ) : null}
                      {item.kind === "VIDEO" ? (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="rounded-full bg-black/55 p-3 text-white">
                            <Play className="size-5" aria-hidden="true" />
                          </span>
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 p-3">
                      <p className="text-ink min-w-0 flex-1 truncate text-sm font-medium">{item.title}</p>
                      <Badge tone="info">{item.kind === "IMAGE" ? "Picture" : "Video"}</Badge>
                      {!item.active ? <Badge tone="neutral">Hidden</Badge> : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </PageContainer>
  );
}
