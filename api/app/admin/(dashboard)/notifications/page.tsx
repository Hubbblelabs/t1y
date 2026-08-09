import type { Metadata } from "next";
import { Bell } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
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
import { listCampaigns } from "@/lib/services/notifications";
import { formatDateTime, formatNumber, humaniseEnum } from "@/lib/utils/format";
import { campaignListQuerySchema } from "@/lib/validation/admin";

export const metadata: Metadata = { title: "Notifications" };

/**
 * Notification campaigns.
 *
 * Message bodies are validated to exclude specific health values, because push
 * previews are visible on a locked device.
 */
export default async function NotificationsPage(
  props: PageProps<"/admin/notifications">,
) {
  const searchParams = await props.searchParams;
  const parsed = campaignListQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : campaignListQuerySchema.parse({});

  const { items, total } = await listCampaigns({
    status: query.status,
    type: query.type,
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });

  const pagination = buildPagination(query.page, query.pageSize, total);

  return (
    <PageContainer>
      <PageHeader
        title="Notifications"
        description="Scheduled and sent messages to participants"
      />

      <Card className="mb-6 p-4">
        <p className="text-ink-muted text-[13px] leading-relaxed">
          Notification text must not contain specific measurements. Push
          previews appear on lock screens, so a message naming a glucose value or
          dose would disclose health information without the participant
          unlocking their device.
        </p>
      </Card>

      <Card>
        {items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="Create a notification to send a reminder or announcement to participants."
          />
        ) : (
          <>
            <TableScroll label="Notification campaigns">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Recipients</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Created by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="max-w-64">
                        <span className="text-ink block truncate font-medium">
                          {campaign.title}
                        </span>
                        <span className="text-ink-subtle block truncate text-xs">
                          {campaign.body}
                        </span>
                      </TableCell>
                      <TableCell className="text-ink-muted whitespace-nowrap">
                        {humaniseEnum(campaign.type)}
                      </TableCell>
                      <TableCell className="text-ink-muted whitespace-nowrap">
                        {campaign.targetStudy
                          ? campaign.targetStudy.code
                          : humaniseEnum(campaign.targetType)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          tone={
                            campaign.status === "SENT"
                              ? "success"
                              : campaign.status === "SCHEDULED"
                                ? "info"
                                : campaign.status === "CANCELLED" ||
                                    campaign.status === "FAILED"
                                  ? "danger"
                                  : "neutral"
                          }
                        >
                          {humaniseEnum(campaign.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatNumber(campaign.totalRecipients)}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatNumber(campaign.deliveredCount)}
                      </TableCell>
                      <TableCell className="text-ink-muted whitespace-nowrap">
                        {campaign.scheduledAt
                          ? formatDateTime(campaign.scheduledAt)
                          : campaign.sentAt
                            ? formatDateTime(campaign.sentAt)
                            : "—"}
                      </TableCell>
                      <TableCell className="text-ink-muted max-w-36 truncate">
                        {campaign.createdBy.name}
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
