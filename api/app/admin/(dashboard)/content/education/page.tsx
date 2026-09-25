import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";

import { HelpBookTopicList } from "@/components/admin/content/help-book-topic-list";
import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { listHelpBookTopics } from "@/lib/services/education";
import { formatNumber } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Help Book" };

/**
 * The Help Book library.
 *
 * One row per topic, not per stored row: a topic exists in English and Tamil,
 * and showing those as two separate entries made the library look twice as
 * long as it is and hid which topics were still missing a translation.
 */
export default async function HelpBookPage() {
  const topics = await listHelpBookTopics();

  const live = topics.filter(
    (topic) => topic.versions.EN?.status === "PUBLISHED" || topic.versions.TA?.status === "PUBLISHED",
  ).length;
  const missingTamil = topics.filter((topic) => !topic.versions.TA).length;

  return (
    <PageContainer>
      <PageHeader
        title="Help Book"
        description="The reading topics families see in the app, in the order they see them"
        breadcrumbs={[{ label: "What families see" }, { label: "Help Book" }]}
        actions={
          <Button asChild variant="primary">
            <Link href="/admin/content/education/new">
              <Plus className="size-4" aria-hidden="true" />
              New topic
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Topics" value={formatNumber(topics.length)} />
        <StatCard label="Live in the app" value={formatNumber(live)} />
        <StatCard label="Still need Tamil" value={formatNumber(missingTamil)} />
      </div>

      <Card>
        {topics.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No topics yet"
            description="Add your first topic to start building the Help Book families read."
          />
        ) : (
          <HelpBookTopicList initial={topics.map(toRow)} />
        )}
      </Card>
    </PageContainer>
  );
}

function toRow(topic: Awaited<ReturnType<typeof listHelpBookTopics>>[number]) {
  return {
    slug: topic.slug,
    category: topic.category,
    displayTitle: topic.displayTitle,
    versions: {
      EN: topic.versions.EN
        ? {
            id: topic.versions.EN.id,
            title: topic.versions.EN.title,
            status: topic.versions.EN.status,
            thumbnailUrl: topic.versions.EN.thumbnailUrl,
            viewCount: topic.versions.EN.viewCount,
            blockCount: topic.versions.EN.blockCount,
          }
        : null,
      TA: topic.versions.TA
        ? {
            id: topic.versions.TA.id,
            title: topic.versions.TA.title,
            status: topic.versions.TA.status,
            thumbnailUrl: topic.versions.TA.thumbnailUrl,
            viewCount: topic.versions.TA.viewCount,
            blockCount: topic.versions.TA.blockCount,
          }
        : null,
    },
  };
}
