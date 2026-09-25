import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CalculatorRunPanel } from "@/components/admin/content/calculator-run-panel";
import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { getCalculatorById } from "@/lib/services/calculators";
import type { CalculatorInput, CalculatorOutput } from "@/lib/services/calculators";

export const metadata: Metadata = { title: "Run a calculator" };

/**
 * Where staff run a calculator for one participant.
 *
 * This — not the phone — is the only place any calculator is ever run. See
 * lib/services/calculator-run.ts: a participant is picked, values are filled
 * in from their own records as of a chosen moment, and staff can override any
 * of them before seeing the result.
 */
export default async function CalculatorRunPage(
  props: PageProps<"/admin/content/calculators/[id]/run">,
) {
  const params = await props.params;
  const calculator = await getCalculatorById(params.id).catch(() => null);
  if (!calculator) notFound();

  return (
    <PageContainer>
      <PageHeader
        title={`Run: ${calculator.nameEn}`}
        description="Pick a participant, and change anything you need to before working it out."
        breadcrumbs={[
          { label: "Calculators", href: "/admin/content/calculators" },
          { label: calculator.nameEn, href: `/admin/content/calculators/${calculator.id}` },
          { label: "Run" },
        ]}
      />

      <CalculatorRunPanel
        calculatorId={calculator.id}
        inputs={calculator.inputs as unknown as CalculatorInput[]}
      />
    </PageContainer>
  );
}
