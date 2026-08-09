"use client";

import * as React from "react";
import { AlertCircle, Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DATE_RANGE_LABELS, type DateRangePreset } from "@/lib/validation/common";

const DATASETS = [
  { value: "participant-summary", label: "Participant summary" },
  { value: "glucose", label: "Glucose readings" },
  { value: "medication-adherence", label: "Medication adherence" },
  { value: "exercise", label: "Exercise sessions" },
  { value: "hba1c", label: "HbA1c results" },
  { value: "health-metrics", label: "Health metrics" },
] as const;

const FORMATS = [
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "Excel (XLSX)" },
  { value: "pdf", label: "PDF report" },
] as const;

const RANGES: DateRangePreset[] = ["30d", "90d", "6m", "1y", "all"];

const ALL_PARTICIPANTS = "__all__";

/**
 * Requests an export and saves the returned file.
 *
 * The endpoint streams the bytes directly, so the response is read as a blob
 * and handed to the browser rather than round-tripping through storage.
 */
export function ExportForm({
  studies,
}: {
  studies: Array<{ id: string; code: string; title: string }>;
}) {
  const [datasetType, setDatasetType] = React.useState<string>("participant-summary");
  const [format, setFormat] = React.useState<string>("csv");
  const [range, setRange] = React.useState<string>("90d");
  const [studyId, setStudyId] = React.useState<string>(ALL_PARTICIPANTS);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  async function handleExport() {
    setPending(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetType,
          format,
          range,
          ...(studyId === ALL_PARTICIPANTS ? {} : { studyId }),
        }),
      });

      if (!response.ok) {
        // The API returns the standard error envelope; surface its message.
        const body = await response.json().catch(() => null);
        setError(
          body?.error?.message ??
            "The export could not be generated. Please try again.",
        );
        return;
      }

      const rowCount = response.headers.get("X-Row-Count");
      const truncated = response.headers.get("X-Truncated") === "true";
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename =
        /filename="([^"]+)"/.exec(disposition)?.[1] ?? `export.${format}`;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setNotice(
        truncated
          ? `Exported ${rowCount} rows — the dataset was truncated at the row limit. Narrow the period for a complete extract.`
          : `Exported ${rowCount} rows to ${filename}.`,
      );
    } catch {
      setError("The export could not be generated. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-ink text-sm font-semibold">Build an extract</h2>

      {error ? (
        <div
          role="alert"
          className="bg-danger-soft text-danger flex items-start gap-2 rounded-md p-3 text-[13px]"
        >
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          className="bg-success-soft text-success rounded-md p-3 text-[13px]"
        >
          {notice}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dataset" htmlFor="datasetType">
          <Select value={datasetType} onValueChange={setDatasetType}>
            <SelectTrigger id="datasetType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATASETS.map((dataset) => (
                <SelectItem key={dataset.value} value={dataset.value}>
                  {dataset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Study" htmlFor="studyId" hint="Leave unset to export the whole cohort.">
          <Select value={studyId} onValueChange={setStudyId}>
            <SelectTrigger id="studyId">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PARTICIPANTS}>All participants</SelectItem>
              {studies.map((study) => (
                <SelectItem key={study.id} value={study.id}>
                  {study.code} — {study.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Period" htmlFor="range">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger id="range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {DATE_RANGE_LABELS[preset]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Format" htmlFor="format">
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger id="format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div>
        <Button variant="primary" onClick={handleExport} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Generating…
            </>
          ) : (
            <>
              <Download className="size-4" aria-hidden="true" />
              Generate export
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
