"use client";

import * as React from "react";
import { Loader2, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type FieldType = "TEXT" | "NUMBER" | "DATE" | "CHOICE";

interface ChoiceOption {
  value: string;
  labelEn: string;
  labelTa?: string;
}

export interface ProfileFieldRow {
  id: string;
  key: string;
  fieldType: FieldType;
  section: string;
  required: boolean;
  active: boolean;
  sortOrder: number;
  labelEn: string;
  labelTa: string | null;
  hintEn: string | null;
  hintTa: string | null;
  options: ChoiceOption[] | null;
  createdAt: string;
  updatedAt: string;
}

const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  TEXT: "Text",
  NUMBER: "Number",
  DATE: "Date",
  CHOICE: "Choice",
};

/**
 * Admin CRUD for the extra fields shown on a parent's profile form.
 *
 * There is no delete button here on purpose — see the field's own doc
 * comment in lib/services/profile-fields.ts. Turning "Active" off is how a
 * field is retired, and the server forces "Required" off in that same
 * write, so a retired field can never leave an existing profile looking
 * incomplete for a question it will no longer be asked.
 */
export function ProfileFieldsPanel({ initial }: { initial: ProfileFieldRow[] }) {
  const [fields, setFields] = React.useState(initial);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showAdd, setShowAdd] = React.useState(false);

  async function patchField(id: string, body: Record<string, unknown>) {
    setPendingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/profile-fields/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json?.error?.message ?? "Could not update that field.");
        return;
      }
      setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...json.data } : f)));
    } catch {
      setError("Could not update that field. Check your connection and try again.");
    } finally {
      setPendingId(null);
    }
  }

  function onCreated(field: ProfileFieldRow) {
    setFields((prev) => [...prev, field].sort((a, b) => a.sortOrder - b.sortOrder));
    setShowAdd(false);
  }

  const bySection = React.useMemo(() => {
    const groups = new Map<string, ProfileFieldRow[]>();
    for (const field of fields) {
      const list = groups.get(field.section) ?? [];
      list.push(field);
      groups.set(field.section, list);
    }
    return groups;
  }, [fields]);

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div role="alert" className="bg-danger-soft text-danger rounded-md p-3 text-[13px]">
          {error}
        </div>
      ) : null}

      {fields.length === 0 && !showAdd ? (
        <Card className="text-ink-muted p-6 text-center text-[13px]">
          No extra fields defined yet — the profile form shows only its built-in fields.
        </Card>
      ) : null}

      {[...bySection.entries()].map(([section, rows]) => (
        <div key={section} className="flex flex-col gap-2">
          <h3 className="text-ink-subtle text-xs font-semibold tracking-wide uppercase">
            {section}
          </h3>
          {rows
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                pending={pendingId === field.id}
                onPatch={(body) => patchField(field.id, body)}
              />
            ))}
        </div>
      ))}

      {showAdd ? (
        <AddFieldForm onCancel={() => setShowAdd(false)} onCreated={onCreated} />
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)} className="self-start">
          <Plus className="size-3.5" />
          Add field
        </Button>
      )}
    </div>
  );
}

function FieldRow({
  field,
  pending,
  onPatch,
}: {
  field: ProfileFieldRow;
  pending: boolean;
  onPatch: (body: Record<string, unknown>) => void;
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-ink text-sm font-medium">{field.labelEn}</span>
          <Badge tone="neutral">{FIELD_TYPE_LABEL[field.fieldType]}</Badge>
          {field.required ? <Badge tone="warning">Required</Badge> : null}
          {!field.active ? <Badge tone="neutral">Inactive</Badge> : null}
        </div>
        <p className="text-ink-subtle font-mono text-xs">{field.key}</p>
        {field.labelTa ? <p className="text-ink-muted text-xs">{field.labelTa}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-5">
        {pending ? <Loader2 className="text-ink-subtle size-4 animate-spin" /> : null}

        <label className="flex items-center gap-2 text-xs">
          <span className="text-ink-muted">Required</span>
          <Switch
            checked={field.required}
            disabled={pending || !field.active}
            onCheckedChange={(checked) => onPatch({ required: checked })}
            aria-label={`Require ${field.labelEn}`}
          />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <span className="text-ink-muted">Active</span>
          <Switch
            checked={field.active}
            disabled={pending}
            onCheckedChange={(checked) => onPatch({ active: checked })}
            aria-label={`Toggle ${field.labelEn} active`}
          />
        </label>
      </div>
    </Card>
  );
}

function AddFieldForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (field: ProfileFieldRow) => void;
}) {
  const [key, setKey] = React.useState("");
  const [fieldType, setFieldType] = React.useState<FieldType>("TEXT");
  const [section, setSection] = React.useState("Additional details");
  const [labelEn, setLabelEn] = React.useState("");
  const [labelTa, setLabelTa] = React.useState("");
  const [required, setRequired] = React.useState(false);
  const [options, setOptions] = React.useState<ChoiceOption[]>([
    { value: "", labelEn: "", labelTa: "" },
  ]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/profile-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: key.trim(),
          fieldType,
          section: section.trim() || undefined,
          labelEn: labelEn.trim(),
          labelTa: labelTa.trim() || undefined,
          required,
          options:
            fieldType === "CHOICE"
              ? options
                  .filter((o) => o.value.trim() && o.labelEn.trim())
                  .map((o) => ({
                    value: o.value.trim(),
                    labelEn: o.labelEn.trim(),
                    labelTa: o.labelTa?.trim() || undefined,
                  }))
              : undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json?.error?.message ?? "Could not create that field.");
        return;
      }
      onCreated(json.data);
    } catch {
      setError("Could not create that field. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h3 className="text-ink text-sm font-medium">New field</h3>
      {error ? (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-muted">
            Key <span className="text-ink-subtle">(e.g. schoolName — cannot be changed later)</span>
          </span>
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="schoolName" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-muted">Type</span>
          <Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FIELD_TYPE_LABEL) as FieldType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {FIELD_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-muted">English label</span>
          <Input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} placeholder="School name" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-muted">Tamil label (optional)</span>
          <Input value={labelTa} onChange={(e) => setLabelTa(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-muted">Section</span>
          <Input value={section} onChange={(e) => setSection(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={required} onCheckedChange={setRequired} />
          <span className="text-ink-muted">Required on the form</span>
        </label>
      </div>

      {fieldType === "CHOICE" ? (
        <div className="flex flex-col gap-2">
          <span className="text-ink-muted text-xs">Options</span>
          {options.map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="value"
                value={option.value}
                onChange={(e) =>
                  setOptions((prev) =>
                    prev.map((o, idx) => (idx === i ? { ...o, value: e.target.value } : o)),
                  )
                }
                className="w-28"
              />
              <Input
                placeholder="English label"
                value={option.labelEn}
                onChange={(e) =>
                  setOptions((prev) =>
                    prev.map((o, idx) => (idx === i ? { ...o, labelEn: e.target.value } : o)),
                  )
                }
              />
              <Input
                placeholder="Tamil label (optional)"
                value={option.labelTa ?? ""}
                onChange={(e) =>
                  setOptions((prev) =>
                    prev.map((o, idx) => (idx === i ? { ...o, labelTa: e.target.value } : o)),
                  )
                }
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                disabled={options.length === 1}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => setOptions((prev) => [...prev, { value: "", labelEn: "", labelTa: "" }])}
          >
            <Plus className="size-3.5" />
            Add option
          </Button>
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={submit}
          disabled={saving || !key.trim() || !labelEn.trim()}
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Create field"}
        </Button>
      </div>
    </Card>
  );
}
