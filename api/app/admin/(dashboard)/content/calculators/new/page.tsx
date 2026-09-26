import type { Metadata } from "next";

import { CalculatorBuilder } from "@/components/admin/content/calculator-builder";
import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { getCalculatorById } from "@/lib/services/calculators";

export const metadata: Metadata = { title: "New calculator" };

/**
 * Builds a calculator, optionally as the replacement for an existing one.
 *
 * "Replacing" is how a calculator is ever corrected: the old row keeps its
 * formulas and is hidden, the new one takes over, and both stay on the
 * record. `?replaces=<id>` carries which one is being superseded.
 */
export default async function NewCalculatorPage(
  props: PageProps<"/admin/content/calculators/new">,
) {
  const searchParams = await props.searchParams;
  const replacesId = typeof searchParams.replaces === "string" ? searchParams.replaces : null;

  const replaced = replacesId ? await getCalculatorById(replacesId).catch(() => null) : null;

  return (
    <PageContainer>
      <PageHeader
        title={replaced ? "Replace a calculator" : "New calculator"}
        description="Set out the numbers to ask for, and the sums that turn them into answers"
        breadcrumbs={[
          { label: "Calculators", href: "/admin/content/calculators" },
          { label: replaced ? "Replace" : "New" },
        ]}
      />
      <CalculatorBuilder
        supersedes={replaced ? { id: replaced.id, name: replaced.nameEn } : undefined}
      />
    </PageContainer>
  );
}
