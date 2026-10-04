import type { Metadata } from "next";

import { HealthBrowserTable } from "@/components/admin/health/health-browser";
import { HealthPage } from "@/components/admin/health/health-page";
import { Badge } from "@/components/ui/badge";
import { requirePrincipal } from "@/lib/auth/session";
import { browseMeals } from "@/lib/services/health-browser";
import { formatNumber, humaniseEnum } from "@/lib/utils/format";
import { parseBrowseParams } from "@/lib/utils/browse-params";

export const metadata: Metadata = { title: "Meals" };

export default async function MealsPage(props: PageProps<"/admin/health/meals">) {
  const searchParams = await props.searchParams;
  const principal = await requirePrincipal();
  const params = parseBrowseParams(searchParams);

  const { items, total } = await browseMeals(principal, params);

  return (
    <HealthPage
      title="Meals"
      description="Logged meals. Nutrition values are participant-reported unless a validated database is named."
      searchKey={JSON.stringify(searchParams)}
    >
      <HealthBrowserTable
        page={params.page}
        pageSize={params.take}
        total={total}
        columns={[
          { label: "Meal" },
          { label: "Type" },
          { label: "Carbohydrate", align: "right" },
          { label: "Energy", align: "right" },
          { label: "Source" },
          { label: "Entered by" },
        ]}
        rows={items.map((item) => ({
          id: item.id,
          user: item.user,
          occurredAt: item.consumedAt,
          cells: [
            { label: "Meal", value: item.name ?? "—" },
            { label: "Type", value: humaniseEnum(item.mealType) },
            {
              label: "Carbohydrate",
              align: "right",
              value: formatNumber(item.totalCarbsGrams, { decimals: 1, unit: "g" }),
            },
            {
              label: "Energy",
              align: "right",
              value: formatNumber(item.totalCalories, { unit: "kcal" }),
            },
            {
              label: "Source",
              value: item.nutritionSource ? (
                <Badge tone="info">{item.nutritionSource}</Badge>
              ) : (
                <span className="text-ink-subtle text-xs">Self-reported</span>
              ),
            },
            { label: "Entered by", value: enteredByLabel(item.enteredBy) },
          ],
        }))}
        emptyTitle="No meals logged"
        emptyDescription="No meals were recorded in the selected period."
      />
    </HealthPage>
  );
}

/** Who recorded a row: the parent in the app, or a guardian through a shared link. */
function enteredByLabel(name: string | null): string {
  return name ? `Guardian: ${name}` : "Parent";
}
