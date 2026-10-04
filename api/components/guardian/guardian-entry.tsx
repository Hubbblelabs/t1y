"use client";

import * as React from "react";

import { TEXT, type Lang } from "@/components/guardian/guardian-text";
import {
  deriveSessionKeys,
  openJson,
  proofFor,
  sealJson,
  type SessionKeys,
} from "@/components/guardian/guardian-crypto-client";
import type { GlucoseSlotKey } from "@/lib/health-data-config";

interface Challenge {
  salt: string;
  iterations: number;
  nonce: string;
}

interface Form {
  nextSlot: GlucoseSlotKey | null;
  insulin: boolean;
  carbs: boolean;
  exercise: boolean;
  purpose?: string | null;
}

type Kind = "glucose" | "insulin" | "carbs" | "exercise";

type Stage =
  | { kind: "loading" }
  | { kind: "invalid"; message: string }
  | { kind: "code"; challenge: Challenge }
  | { kind: "form"; challenge: Challenge; keys: SessionKeys; form: Form }
  | { kind: "done" };

async function api<T>(path: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  try {
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, status: response.status, message: json?.error?.message ?? "Something went wrong." };
    }
    return { ok: true, data: json.data as T };
  } catch {
    return { ok: false, status: 0, message: "network" };
  }
}

/*
 * Look and feel: a web copy of the app's own data-entry screen (see
 * app/lib/screens/health/record_screen.dart and theme/app_theme.dart) — same
 * palette, Poppins, pill tab picker, white rounded card, big bold number field,
 * rounded deep-blue button and a Material-style confirm dialog. Colours are
 * fixed (not the dashboard's theme tokens) because the app is light-only.
 */
const C = {
  bg: "#F4F7FB",
  primary: "#2196F3",
  deep: "#0D47A1",
  lightest: "#E3F2FD",
  accent: "#90CAF9",
  ink: "#111827",
  inkSoft: "#374151",
  border: "#B6C7DC",
  danger: "#C62828",
  success: "#2E7D32",
};

const fieldClass =
  "w-full rounded-2xl border bg-white px-5 py-4 text-[#111827] outline-none placeholder:text-[#374151]/70 focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3]";

function Icon({ name, size = 20, color = "currentColor" }: { name: Kind | "pen" | "alert" | "check" | "globe"; size?: number; color?: string }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "glucose":
      return (
        <svg {...common}>
          <path d="M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3Z" />
        </svg>
      );
    case "insulin":
      return (
        <svg {...common}>
          <path d="m18 2 4 4M17 7l3-3M19 9l-8.7 8.7a2.5 2.5 0 0 1-3.5 0l-.5-.5a2.5 2.5 0 0 1 0-3.5L15 5M9 11l4 4M5 19l-3 3M14 4l6 6" />
        </svg>
      );
    case "carbs":
      return (
        <svg {...common}>
          <path d="M7 3v8a2 2 0 0 0 2 2v8M7 3v6M5 3v6a2 2 0 0 0 2 2M17 21V3c-2.5 1.5-4 4.5-4 8h4" />
        </svg>
      );
    case "exercise":
      return (
        <svg {...common}>
          <circle cx="14" cy="4.5" r="2" />
          <path d="m9 21 3-6-2.5-2 1.5-4 3 2.5 3 .5M6 12l3-3 3 1" />
        </svg>
      );
    case "pen":
      return (
        <svg {...common}>
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      );
    case "alert":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16.5v.01" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12.5 2.8 2.8L16 9.5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
      );
  }
}

/**
 * The page a guardian (a teacher, say) opens from the parent's link.
 *
 * Flow: the link loads → a pop-up asks for the 6-digit code → the page asks
 * only for what is still due today → a second pop-up asks them to double-check
 * every number → the entries are encrypted in the browser and sent → the link
 * is spent. Wire format: lib/guardian-crypto.ts.
 */
export function GuardianEntry({ token }: { token: string }) {
  const [lang, setLang] = React.useState<Lang>("en");
  const t = TEXT[lang];
  const [stage, setStage] = React.useState<Stage>({ kind: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    api<Challenge & { expiresAt: string }>(`/api/guardian/${token}`).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setStage({ kind: "invalid", message: result.message === "network" ? TEXT.en.network : result.message });
      } else {
        setStage({ kind: "code", challenge: result.data });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main style={{ background: C.bg, color: C.ink, colorScheme: "light" }} className="min-h-dvh">
      <header className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 pt-5 pb-2">
        <h1 style={{ color: C.deep }} className="text-xl leading-tight font-semibold">
          {t.title}
        </h1>
        <div className="flex shrink-0 gap-1" role="group" aria-label="Language">
          {(["en", "ta"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              style={lang === l ? { background: C.deep, borderColor: C.deep, color: "#fff" } : { borderColor: C.border, color: C.inkSoft, background: "#fff" }}
              className="rounded-full border px-3 py-1 text-xs font-semibold"
            >
              {l === "en" ? "EN" : "தமிழ்"}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pb-10">
        <p style={{ color: C.inkSoft }} className="mb-4 text-sm leading-relaxed">
          {t.intro}
        </p>

        {stage.kind === "loading" ? (
          <p style={{ color: C.inkSoft }} className="text-sm">
            {t.loading}
          </p>
        ) : null}

        {stage.kind === "invalid" ? <Banner tone="error" title={t.badLinkTitle} message={stage.message} /> : null}

        {stage.kind === "code" ? (
          <CodeDialog
            t={t}
            challenge={stage.challenge}
            token={token}
            onOpened={(keys, form) => setStage({ kind: "form", challenge: stage.challenge, keys, form })}
            onDead={(message) => setStage({ kind: "invalid", message })}
          />
        ) : null}

        {stage.kind === "form" ? (
          <EntryForm
            t={t}
            token={token}
            challenge={stage.challenge}
            keys={stage.keys}
            form={stage.form}
            onDone={() => setStage({ kind: "done" })}
            onDead={(message) => setStage({ kind: "invalid", message })}
          />
        ) : null}

        {stage.kind === "done" ? <Banner tone="success" title={t.doneTitle} message={t.doneBody} /> : null}
      </div>
    </main>
  );
}

function Banner({ tone, title, message }: { tone: "error" | "success"; title?: string; message: string }) {
  const color = tone === "error" ? C.danger : C.success;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{ background: tone === "error" ? "#FDECEA" : "#E8F5E9", color }}
      className="flex items-start gap-3 rounded-[14px] p-4 text-sm"
    >
      <span className="mt-0.5 shrink-0">
        <Icon name={tone === "error" ? "alert" : "check"} color={color} />
      </span>
      <div>
        {title ? <p className="mb-0.5 font-semibold">{title}</p> : null}
        <p className="leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

/** The app's white rounded card with its soft blue shadow. */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      style={{ boxShadow: "0 6px 16px rgba(13,71,161,0.06)" }}
      className={`rounded-[22px] bg-white p-[18px] ${className}`}
    >
      {children}
    </section>
  );
}

/** Material-style alert dialog, as the app shows. */
function Dialog({ title, labelledBy, children }: { title: string; labelledBy: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}
        className="w-full max-w-sm rounded-[28px] bg-white p-6"
      >
        <h2 id={labelledBy} className="mb-3 text-[22px] leading-snug font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{ background: C.deep }}
      className="h-[58px] w-full rounded-[28px] px-6 text-[17px] font-bold text-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function CodeDialog({
  t,
  challenge,
  token,
  onOpened,
  onDead,
}: {
  t: (typeof TEXT)["en"];
  challenge: Challenge;
  token: string;
  onOpened: (keys: SessionKeys, form: Form) => void;
  onDead: (message: string) => void;
}) {
  const [digits, setDigits] = React.useState<string[]>(["", "", "", "", "", ""]);
  const boxes = React.useRef<Array<HTMLInputElement | null>>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const code = digits.join("");

  /** Puts `text` (digits only) into the boxes starting at `from`, then focuses the next empty one. */
  function fill(from: number, text: string) {
    const only = text.replace(/\D/g, "");
    if (!only) return;
    const next = [...digits];
    let i = from;
    for (const ch of only) {
      if (i > 5) break;
      next[i] = ch;
      i += 1;
    }
    setDigits(next);
    boxes.current[Math.min(i, 5)]?.focus();
  }

  function onKeyDown(i: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = [...digits];
      if (next[i]) {
        next[i] = "";
        setDigits(next);
      } else if (i > 0) {
        next[i - 1] = "";
        setDigits(next);
        boxes.current[i - 1]?.focus();
      }
    } else if (event.key === "ArrowLeft" && i > 0) {
      boxes.current[i - 1]?.focus();
    } else if (event.key === "ArrowRight" && i < 5) {
      boxes.current[i + 1]?.focus();
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError(t.codeHelp);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const keys = await deriveSessionKeys(code, challenge.salt, challenge.iterations);
      const result = await api<{ iv: string; ct: string }>(`/api/guardian/${token}/open`, {
        nonce: challenge.nonce,
        proof: await proofFor(keys, challenge.nonce),
      });
      if (!result.ok) {
        if (result.status === 403 && !/locked/i.test(result.message)) setError(result.message);
        else if (result.status === 0) setError(t.network);
        else onDead(result.message);
        return;
      }
      onOpened(keys, await openJson<Form>(result.data, keys, challenge.nonce));
    } catch {
      setError(t.network);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title={t.codeTitle} labelledBy="code-title">
      <form onSubmit={submit} className="space-y-4">
        <p style={{ color: C.inkSoft }} className="text-sm leading-relaxed">
          {t.codeHelp}
        </p>
        <div role="group" aria-label={t.codeLabel}>
          <p className="mb-2 text-xs font-medium" style={{ color: C.inkSoft }}>
            {t.codeLabel}
          </p>
          <div className="flex justify-between gap-2">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                aria-label={`${t.codeLabel} ${i + 1}`}
                inputMode="numeric"
                pattern="[0-9]*"
                // The first box carries the autofill hint, so a code that
                // arrives by message can be dropped into all six at once.
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={6}
                value={digit}
                autoFocus={i === 0}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => fill(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onPaste={(e) => {
                  e.preventDefault();
                  fill(i, e.clipboardData.getData("text"));
                }}
                style={{
                  borderColor: digit ? C.deep : C.border,
                  background: digit ? C.lightest : "#fff",
                  color: C.deep,
                }}
                className="h-14 w-full min-w-0 rounded-[14px] border text-center text-2xl font-bold outline-none focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/30"
              />
            ))}
          </div>
        </div>
        {error ? <Banner tone="error" message={error} /> : null}
        <PrimaryButton type="submit" disabled={busy || code.length !== 6}>
          {busy ? t.checking : t.unlock}
        </PrimaryButton>
      </form>
    </Dialog>
  );
}

function EntryForm({
  t,
  token,
  challenge,
  keys,
  form,
  onDone,
  onDead,
}: {
  t: (typeof TEXT)["en"];
  token: string;
  challenge: Challenge;
  keys: SessionKeys;
  form: Form;
  onDone: () => void;
  onDead: (message: string) => void;
}) {
  const kinds = React.useMemo<Kind[]>(
    () => [
      ...(form.nextSlot ? (["glucose"] as const) : []),
      ...(form.insulin ? (["insulin"] as const) : []),
      ...(form.carbs ? (["carbs"] as const) : []),
      ...(form.exercise ? (["exercise"] as const) : []),
    ],
    [form],
  );

  const [kind, setKind] = React.useState<Kind>(kinds[0] ?? "glucose");
  const [name, setName] = React.useState("");
  const [glucose, setGlucose] = React.useState("");
  const [insulin, setInsulin] = React.useState("");
  const [carbs, setCarbs] = React.useState("");
  const [food, setFood] = React.useState("");
  const [exercise, setExercise] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  function num(text: string): number | undefined {
    const n = Number(text.trim().replace(",", "."));
    return text.trim() !== "" && Number.isFinite(n) ? n : undefined;
  }

  function build() {
    return {
      glucose: form.nextSlot && glucose.trim() ? { value: num(glucose), slot: form.nextSlot } : undefined,
      insulinUnits: insulin.trim() ? num(insulin) : undefined,
      carbs: carbs.trim() ? { grams: num(carbs), food: food.trim() || undefined } : undefined,
      exerciseMinutes: exercise.trim() ? num(exercise) : undefined,
    };
  }

  const filled: Record<Kind, boolean> = {
    glucose: glucose.trim() !== "",
    insulin: insulin.trim() !== "",
    carbs: carbs.trim() !== "",
    exercise: exercise.trim() !== "",
  };

  function review(event: React.FormEvent) {
    event.preventDefault();
    const e = build();
    if (name.trim().length < 2) return setError(t.needName);
    if (!e.glucose && e.insulinUnits === undefined && !e.carbs && e.exerciseMinutes === undefined) return setError(t.needValue);
    if (
      (glucose.trim() && e.glucose?.value === undefined) ||
      (insulin.trim() && e.insulinUnits === undefined) ||
      (carbs.trim() && e.carbs?.grams === undefined) ||
      (exercise.trim() && e.exerciseMinutes === undefined)
    ) {
      return setError(t.badNumber);
    }
    setError(null);
    setConfirming(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const e = build();
      const sealed = await sealJson({ guardianName: name.trim(), ...e }, keys, challenge.nonce);
      const result = await api<{ saved: true }>(`/api/guardian/${token}/submit`, {
        nonce: challenge.nonce,
        proof: await proofFor(keys, challenge.nonce),
        ...sealed,
      });
      if (result.ok) return onDone();
      setConfirming(false);
      if (result.status === 0) setError(t.network);
      else if (result.status === 409 && /link|open too long/i.test(result.message)) onDead(result.message);
      else setError(result.message);
    } catch {
      setConfirming(false);
      setError(t.network);
    } finally {
      setBusy(false);
    }
  }

  const e = build();
  const reviewRows: Array<[string, string]> = [];
  if (e.glucose?.value !== undefined && form.nextSlot) reviewRows.push([`${t.fields.glucose.replace(/ \(.*\)$/, "")} · ${t.slot[form.nextSlot]}`, `${e.glucose.value} ${t.units.mgdl}`]);
  if (e.insulinUnits !== undefined) reviewRows.push([t.values.insulin, `${e.insulinUnits} ${t.units.units}`]);
  if (e.carbs?.grams !== undefined) reviewRows.push([t.values.carbs, `${e.carbs.grams} ${t.units.grams}`]);
  if (e.carbs?.food) reviewRows.push([t.values.food, e.carbs.food]);
  if (e.exerciseMinutes !== undefined) reviewRows.push([t.values.exercise, `${e.exerciseMinutes} ${t.units.minutes}`]);
  reviewRows.push([t.values.by, name.trim()]);

  if (kinds.length === 0) {
    return <Banner tone="success" message={t.nothingDue} />;
  }

  const labelStyle = { color: C.inkSoft };

  return (
    <>
      <form onSubmit={review} className="space-y-4">
        {form.purpose ? (
          <div style={{ background: C.lightest, color: C.deep }} className="rounded-[14px] p-4 text-sm leading-relaxed">
            <p className="mb-0.5 text-xs font-bold tracking-wide uppercase">{t.parentNote}</p>
            <p>{form.purpose}</p>
          </div>
        ) : null}
        <Card>
          <label className="block text-xs font-medium" style={labelStyle}>
            {t.yourName}
            <input
              style={{ borderColor: C.border }}
              className={`${fieldClass} mt-1.5 text-base`}
              value={name}
              maxLength={80}
              onChange={(ev) => setName(ev.target.value)}
              autoComplete="name"
            />
          </label>
          <p style={labelStyle} className="mt-1.5 text-xs">
            {t.yourNameHelp}
          </p>
        </Card>

        {kinds.length > 1 ? (
          <div role="tablist" style={{ borderColor: C.border }} className="flex rounded-[18px] border bg-white p-1">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                onClick={() => setKind(k)}
                style={kind === k ? { background: C.deep, color: "#fff" } : { color: C.inkSoft }}
                className="relative flex min-w-0 flex-1 flex-col items-center gap-[3px] rounded-[14px] py-2.5 transition-colors"
              >
                <Icon name={k} />
                <span className="max-w-full truncate px-0.5 text-[12.5px] font-bold">{t.kinds[k]}</span>
                {filled[k] && kind !== k ? (
                  <span style={{ background: C.primary }} className="absolute top-1.5 right-2 size-2 rounded-full" aria-hidden="true" />
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        <Card>
          <p style={labelStyle} className="mb-4 text-sm leading-[1.4]">
            {t.hints[kind]}
          </p>

          {kind === "glucose" && form.nextSlot ? (
            <div className="mb-4">
              <p className="mb-2 text-[13px] font-bold">{t.whichReading}</p>
              <span
                style={{ background: C.deep, color: "#fff" }}
                className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium"
              >
                {t.slot[form.nextSlot]}
              </span>
            </div>
          ) : null}

          {kind === "glucose" ? (
            <NumberField label={t.fields.glucose} icon="glucose" value={glucose} onChange={setGlucose} decimal />
          ) : null}
          {kind === "insulin" ? (
            <NumberField label={t.fields.insulin} icon="insulin" value={insulin} onChange={setInsulin} decimal />
          ) : null}
          {kind === "carbs" ? (
            <div className="space-y-3.5">
              <NumberField label={t.fields.carbs} icon="carbs" value={carbs} onChange={setCarbs} decimal />
              <label className="block text-xs font-medium" style={labelStyle}>
                {t.carbsFood}
                <textarea
                  style={{ borderColor: C.border }}
                  className={`${fieldClass} mt-1.5 text-base`}
                  rows={2}
                  maxLength={200}
                  placeholder={t.carbsFoodHint}
                  value={food}
                  onChange={(ev) => setFood(ev.target.value)}
                />
                <span className="block text-right text-xs font-normal">{food.length}/200</span>
              </label>
            </div>
          ) : null}
          {kind === "exercise" ? (
            <NumberField label={t.fields.exercise} icon="exercise" value={exercise} onChange={setExercise} />
          ) : null}

          {error && !confirming ? (
            <div className="mt-4">
              <Banner tone="error" message={error} />
            </div>
          ) : null}

          <div className="mt-[18px]">
            <PrimaryButton type="submit">{t.save}</PrimaryButton>
          </div>
        </Card>
      </form>

      {confirming ? (
        <Dialog title={t.checkTitle} labelledBy="check-title">
          <p style={labelStyle} className="mb-4 text-[13.5px] leading-[1.4]">
            {t.checkBody}
          </p>
          <div className="mb-5 space-y-2.5">
            {reviewRows.map(([label, value]) => (
              <div key={label}>
                <p style={labelStyle} className="text-[13px] font-semibold">
                  {label}
                </p>
                <p style={{ color: C.deep }} className="text-xl leading-snug font-extrabold break-words">
                  {value}
                </p>
              </div>
            ))}
          </div>
          {error ? (
            <div className="mb-3">
              <Banner tone="error" message={error} />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              style={{ color: C.primary }}
              className="rounded-full px-4 py-2.5 text-sm font-semibold"
            >
              {t.goBack}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              style={{ background: C.deep }}
              className="rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? t.saving : t.confirm}
            </button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

/** The app's big bold number field with its blue prefix icon and label. */
function NumberField({
  label,
  icon,
  value,
  onChange,
  decimal = false,
}: {
  label: string;
  icon: Kind;
  value: string;
  onChange: (v: string) => void;
  decimal?: boolean;
}) {
  const id = React.useId();
  return (
    <div>
      <label htmlFor={id} style={{ color: C.inkSoft }} className="mb-1.5 block text-xs font-medium">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2" style={{ color: C.primary }}>
          <Icon name={icon} size={22} color={C.primary} />
        </span>
        <input
          id={id}
          style={{ borderColor: C.border }}
          className={`${fieldClass} pl-12 text-2xl font-bold`}
          inputMode={decimal ? "decimal" : "numeric"}
          value={value}
          onChange={(ev) => onChange(decimal ? ev.target.value.replace(/[^0-9.,]/g, "") : ev.target.value.replace(/\D/g, ""))}
        />
      </div>
    </div>
  );
}
