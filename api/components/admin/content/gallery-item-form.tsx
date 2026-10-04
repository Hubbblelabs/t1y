"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { PicturePicker, VideoPicker } from "@/components/admin/content/media-picker";
import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";

export interface GalleryValues {
  kind: "IMAGE" | "VIDEO";
  url: string;
  thumbnailUrl: string;
  title: string;
  titleTa: string;
  caption: string;
  captionTa: string;
  active: boolean;
}

const EMPTY: GalleryValues = {
  kind: "IMAGE",
  url: "",
  thumbnailUrl: "",
  title: "",
  titleTa: "",
  caption: "",
  captionTa: "",
  active: true,
};

/** Adds or edits one Gallery picture or video, with optional Tamil wording. */
export function GalleryItemForm({ itemId, initial }: { itemId?: string; initial?: GalleryValues }) {
  const router = useRouter();
  const [values, setValues] = React.useState<GalleryValues>(initial ?? EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function set<K extends keyof GalleryValues>(key: K, value: GalleryValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(itemId ? `/api/admin/gallery/${itemId}` : "/api/admin/gallery", {
        method: itemId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          thumbnailUrl: values.kind === "VIDEO" && values.thumbnailUrl ? values.thumbnailUrl : null,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error?.issues?.[0]?.message ?? body?.error?.message ?? "Could not save this.");
        return;
      }
      router.push("/admin/content/gallery");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-5">
      <Card className="space-y-4 p-4">
        <fieldset className="flex gap-4 text-xs">
          <legend className="text-ink mb-1.5 font-medium">What is it?</legend>
          {(["IMAGE", "VIDEO"] as const).map((kind) => (
            <label key={kind} className="flex items-center gap-2">
              <input
                type="radio"
                name="kind"
                className="accent-primary"
                checked={values.kind === kind}
                onChange={() => setValues((prev) => ({ ...prev, kind, url: "", thumbnailUrl: "" }))}
              />
              {kind === "IMAGE" ? "Picture" : "Video"}
            </label>
          ))}
        </fieldset>

        {values.kind === "IMAGE" ? (
          <PicturePicker url={values.url || null} onChange={(r) => set("url", r?.url ?? "")} label="Picture" />
        ) : (
          <>
            <VideoPicker url={values.url || null} onChange={(r) => set("url", r?.url ?? "")} />
            <div className="space-y-1.5">
              <Label>Cover picture (optional)</Label>
              <PicturePicker
                url={values.thumbnailUrl || null}
                onChange={(r) => set("thumbnailUrl", r?.url ?? "")}
                label="Cover picture"
                purpose="education-thumbnail"
              />
            </div>
          </>
        )}
      </Card>

      <Card className="space-y-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="g-title">Title</Label>
          <Input id="g-title" value={values.title} maxLength={120} onChange={(e) => set("title", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-title-ta">Title in Tamil (optional)</Label>
          <Input id="g-title-ta" value={values.titleTa} maxLength={120} onChange={(e) => set("titleTa", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-caption">Caption (optional)</Label>
          <Textarea id="g-caption" value={values.caption} maxLength={500} onChange={(e) => set("caption", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-caption-ta">Caption in Tamil (optional)</Label>
          <Textarea id="g-caption-ta" value={values.captionTa} maxLength={500} onChange={(e) => set("captionTa", e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" className="accent-primary size-3.5" checked={values.active} onChange={(e) => set("active", e.target.checked)} />
          Show in the app
        </label>
      </Card>

      {error ? (
        <div role="alert" className="bg-danger-soft text-danger flex items-start gap-2 rounded-md p-2.5 text-xs">
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={busy || !values.url}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {itemId ? "Save changes" : "Add to gallery"}
        </Button>
        {itemId ? (
          <DeleteButton resourceLabel="gallery item" deleteUrl={`/api/admin/gallery/${itemId}`} redirectTo="/admin/content/gallery" />
        ) : null}
      </div>
    </form>
  );
}
