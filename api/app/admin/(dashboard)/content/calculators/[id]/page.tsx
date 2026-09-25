import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Play, Repeat } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCalculatorById } from "@/lib/services/calculators";
import { listCatalogueVariables } from "@/lib/services/health-data-catalogue";
import type { CalculatorInput, CalculatorOutput } from "@/lib/services/calculators";
import { formatDate } from "@/lib/utils/format";
import { humaniseExpression } from "@/lib/utils/expression-display";

export const metadata: Metadata = { title: "Calculator" };

/**
 * A saved calculator, shown read-only.
 *
 * Nothing on this page can be changed — no fields, no switches. The sums are
 * fixed once saved so that an answer a family was given cannot change
 * retrospectively, and a page that let anyone flip something here would
 * undercut that. Showing or hiding a calculator is done from the list; a
 * corrected version is made with "Make a replacement".
 */
export default async function CalculatorDetailPage(
  props: PageProps<"/admin/content/calculators/[id]">,
) {
  const params = await props.params;
  const calculator = await getCalculatorById(params.id).catch(() => null);
  if (!calculator) notFound();

  const inputs = (calculator.inputs ?? []) as unknown as CalculatorInput[];
  const outputs = (calculator.outputs ?? []) as unknown as CalculatorOutput[];

  // A formula is stored in short names; shown here in the words whoever
  // wrote it chose, so it can be checked without decoding anything.
  const labels: Record<string, string> = {};
  for (const input of inputs) labels[input.key] = input.labelEn;
  for (const output of outputs) labels[output.key] = output.labelEn;

  // A data source is stored as a code ("glucose_latest"); show what it is.
  const catalogue = await listCatalogueVariables();
  const sourceName = (key: string | null | undefined): string =>
    catalogue.find((variable) => variable.key === key)?.labelEn ?? "our records";

  return (
    <PageContainer>
      <PageHeader
        title={calculator.nameEn}
        description={calculator.descriptionEn ?? undefined}
        breadcrumbs={[
          { label: "What families see" },
          { label: "Calculators", href: "/admin/content/calculators" },
          { label: calculator.nameEn },
        ]}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="primary">
              <Link href={`/admin/content/calculators/${calculator.id}/run`}>
                <Play className="size-4" aria-hidden="true" />
                Run for a participant
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/admin/content/calculators/new?replaces=${calculator.id}`}>
                <Repeat className="size-4" aria-hidden="true" />
                Make a replacement
              </Link>
            </Button>
          </div>
        }
      />

      <div className="bg-warning-soft text-ink mb-4 rounded-md p-3 text-sm">
        This is not shown to families — only staff run a calculator, for one participant at a time,
        from "Run for a participant". It cannot be changed; if a sum needs correcting, make a
        replacement, which hides this one while keeping both on the record.
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-ink mb-1 font-semibold">What it collects</h2>
          <p className="text-ink-muted mb-3 text-sm">
            Where each number comes from, and the unit it is in.
          </p>
          <dl className="divide-line divide-y">
            {inputs.map((input) => (
              <div key={input.key} className="py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink text-sm">
                    {input.labelEn}
                  </dt>
                  <dd className="text-ink-muted shrink-0 text-sm">{input.unit}</dd>
                </div>
                <p className="text-ink-subtle mt-0.5 text-xs">
                  {input.source === "DATA"
                    ? `Filled in from ${sourceName(input.sourceKey)}, and staff can override it`
                    : "Typed in by staff when they run it"}
                  {input.min != null || input.max != null
                    ? ` · allowed ${input.min ?? "any"} to ${input.max ?? "any"}`
                    : ""}
                </p>
                {input.helpEn ? (
                  <p className="text-ink-muted mt-0.5 text-xs">{input.helpEn}</p>
                ) : null}
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-4">
          <h2 className="text-ink mb-1 font-semibold">The formulas behind it</h2>
          <p className="text-ink-muted mb-3 text-sm">
            Worked out on the server when staff run this calculator.
          </p>
          <dl className="divide-line divide-y">
            {outputs.map((output) => (
              <div key={output.key} className="py-2">
                <dt className="text-ink text-sm font-medium">
                  {output.labelEn} ({output.unit})
                </dt>
                <dd className="text-ink mt-1 text-sm">
                  <span className="text-ink-subtle">= </span>
                  {humaniseExpression(output.expression, labels)}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      {calculator.noteEn ? (
        <Card className="mt-4 p-4">
          <h2 className="text-ink mb-1 font-semibold">Note shown with the answer</h2>
          <p className="text-ink-muted text-sm">{calculator.noteEn}</p>
        </Card>
      ) : null}

      <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-ink-subtle text-sm">
          Added {formatDate(calculator.createdAt)} by {calculator.createdBy.name}
        </p>
        <Badge tone={calculator.active ? "success" : "neutral"}>
          {calculator.active ? "Available to run" : "Hidden"}
        </Badge>
      </Card>
    </PageContainer>
  );
}
