import { Suspense } from "react";

import { DateRangePicker } from "@/components/admin/date-range-picker";
import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { SearchBox } from "@/components/admin/search-box";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/states";

/**
 * Shared frame for the seven "Health data" browse pages, so they share
 * header, search, period selection and loading behaviour.
 */
export function HealthPage({
  title,
  description,
  searchKey,
  children,
}: {
  title: string;
  description: string;
  searchKey: string;
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[{ label: "Health data" }, { label: title }]}
        actions={<DateRangePicker />}
      />

      <Card>
        <div className="border-line border-b p-4">
          <SearchBox placeholder="Search by participant code or name" />
        </div>

        <Suspense key={searchKey} fallback={<TableSkeleton rows={10} columns={6} />}>
          {children}
        </Suspense>
      </Card>
    </PageContainer>
  );
}
