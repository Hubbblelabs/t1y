import type { Metadata } from "next";
import { BookOpen } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SearchBox } from "@/components/admin/search-box";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from "@/components/ui/table";
import { buildPagination } from "@/lib/api/response";
import { listEducationForAdmin, getEducationStats } from "@/lib/services/education";
import { formatDate, formatNumber, humaniseEnum } from "@/lib/utils/format";
import { educationListQuerySchema } from "@/lib/validation/admin";

export const metadata: Metadata = { title: "Education" };

/** Education content library. */
export default async function EducationPage(
  props: PageProps<"/admin/content/education">,
) {
  const searchParams = await props.searchParams;
  const parsed = educationListQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : educationListQuerySchema.parse({});

  const [{ items, total }, stats] = await Promise.all([
    listEducationForAdmin({
      status: query.status,
      category: query.category,
      search: query.search,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    getEducationStats(),
  ]);

  const pagination = buildPagination(query.page, query.pageSize, total);

  return (
    <PageContainer>
      <PageHeader
        title="Education"
        description="Articles and media shown to participants in the mobile application"
        breadcrumbs={[{ label: "Content" }, { label: "Education" }]}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total articles" value={formatNumber(stats.total)} />
        <StatCard label="Published" value={formatNumber(stats.published)} />
        <StatCard label="Drafts" value={formatNumber(stats.draft)} />
        <StatCard label="Archived" value={formatNumber(stats.archived)} />
      </div>

      <Card>
        <div className="border-line border-b p-4">
          <SearchBox placeholder="Search by title or slug" />
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={query.search ? "No articles match your search" : "No articles yet"}
            description={
              query.search
                ? "Try a different search term or clear the filters."
                : "Create an article to start building the education library."
            }
          />
        ) : (
          <>
            <TableScroll label="Education content">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Media</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((article) => (
                    <TableRow key={article.id}>
                      <TableCell className="max-w-72">
                        <span className="text-ink block truncate font-medium">
                          {article.title}
                        </span>
                        <span className="text-ink-subtle block truncate text-xs">
                          /{article.slug}
                        </span>
                      </TableCell>
                      <TableCell className="text-ink-muted whitespace-nowrap">
                        {humaniseEnum(article.category)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          tone={
                            article.status === "PUBLISHED"
                              ? "success"
                              : article.status === "DRAFT"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {humaniseEnum(article.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-ink-muted">
                        {article.mediaType === "NONE" ? "—" : humaniseEnum(article.mediaType)}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatNumber(article.viewCount)}
                      </TableCell>
                      <TableCell className="text-ink-muted max-w-36 truncate">
                        {article.author.name}
                      </TableCell>
                      <TableCell className="text-ink-muted whitespace-nowrap">
                        {formatDate(article.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>

            <div className="border-line border-t px-4 py-3">
              <Pagination pagination={pagination} />
            </div>
          </>
        )}
      </Card>
    </PageContainer>
  );
}
