import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, Plus } from "lucide-react";

import { CalculatorVisibilityToggle } from "@/components/admin/content/calculator-visibility-toggle";
import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { listCalculatorsForAdmin } from "@/lib/services/calculators";
import type { CalculatorInput, CalculatorOutput } from "@/lib/services/calculators";
import { humaniseExpression } from "@/lib/utils/expression-display";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Calculators" };

/**
 * This app tracks glucose, insulin and carbohydrates only — no medications,
 * exercise, weight or HbA1c logging exists here (see docs/UNUSED-BACKEND.md).
 * A calculator that draws on anything else would only ever show "missing a
 * value" for every participant, so it's kept out of the list entirely rather
 * than left there to look broken. Only a DATA-sourced input has a definite
 * domain to check (see lib/services/health-data-catalogue.ts); an ASK input
 * is always fine here; it's just a number staff type in.
 */
function isInsulinGlucoseOrCarbCalculator(inputs: CalculatorInput[]): boolean {
  return inputs.every(
    (input) =>
      input.source !== "DATA" ||
      !input.sourceKey ||
      input.sourceKey.startsWith("glucose_") ||
      input.sourceKey.startsWith("insulin_") ||
      input.sourceKey.startsWith("carb"),
  );
}

export default async function CalculatorsPage() {
  const allCalculators = await listCalculatorsForAdmin();
  const calculators = allCalculators.filter((calculator) =>
    isInsulinGlucoseOrCarbCalculator((calculator.inputs ?? []) as unknown as CalculatorInput[]),
  );

  return (
    <PageContainer>
      <PageHeader
        title="Calculators"
        description="Staff-only working-out tools — run one for a participant to see what it gives them"
        breadcrumbs={[{ label: "Calculators" }]}
        actions={
          <Button asChild variant="primary">
            <Link href="/admin/content/calculators/new">
              <Plus className="size-4" aria-hidden="true" />
              New calculator
            </Link>
          </Button>
        }
      />

      <Card>
        {calculators.length === 0 ? (
          <EmptyState
            icon={Calculator}
            title="No calculators yet"
            description="Add one to give families a tool for working out doses and carbohydrates."
          />
        ) : (
          <ul className="divide-line divide-y">
            {calculators.map((calculator) => {
              const outputs = (calculator.outputs ?? []) as unknown as CalculatorOutput[];
              const inputs = (calculator.inputs ?? []) as unknown as CalculatorInput[];
              const labels: Record<string, string> = {};
              for (const row of inputs) labels[row.key] = row.labelEn;
              for (const row of outputs) labels[row.key] = row.labelEn;
              return (
                <li
                  key={calculator.id}
                  className="hover:bg-surface-hover relative flex items-start gap-4 px-4 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/content/calculators/${calculator.id}`}
                        className="text-ink font-medium after:absolute after:inset-0 hover:underline"
                      >
                        {calculator.nameEn}
                      </Link>
                      <Badge tone={calculator.active ? "success" : "neutral"}>
                        {calculator.active ? "Available to run" : "Hidden"}
                      </Badge>
                    </div>

                    {calculator.descriptionEn ? (
                      <p className="text-ink-muted mt-0.5 text-sm">{calculator.descriptionEn}</p>
                    ) : null}

                    <ul className="text-ink-subtle mt-2 space-y-0.5 text-xs">
                      {outputs.map((output) => (
                        <li key={output.key}>
                          {output.labelEn} = {humaniseExpression(output.expression, labels)}
                        </li>
                      ))}
                    </ul>

                    <p className="text-ink-subtle mt-2 text-xs">
                      Added {formatDate(calculator.createdAt)} by {calculator.createdBy.name}
                    </p>
                  </div>

                  <div className="relative z-10 flex flex-col items-end gap-2">
                    <Button asChild variant="secondary" size="sm">
                      <Link href={`/admin/content/calculators/${calculator.id}/run`}>
                        <Calculator className="size-3.5" aria-hidden="true" />
                        Run for a participant
                      </Link>
                    </Button>
                    <CalculatorVisibilityToggle id={calculator.id} active={calculator.active} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </PageContainer>
  );
}
