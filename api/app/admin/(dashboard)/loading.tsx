import { PageContainer } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { ChartSkeleton, Skeleton, StatSkeleton } from "@/components/ui/states";

/**
 * Route-level loading state.
 *
 * A neutral approximation of a typical admin page — header, statistics, a
 * chart — so navigation never lands on a blank screen.
 */
export default function AdminLoading() {
  return (
    <PageContainer>
      <div className="mb-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-3.5 w-72" />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatSkeleton key={index} />
        ))}
      </div>

      <Card className="p-5">
        <ChartSkeleton />
      </Card>

      <span className="sr-only" role="status">
        Loading page…
      </span>
    </PageContainer>
  );
}
