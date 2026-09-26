"use client";

import * as React from "react";
import { ImageUp, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The shape families' phones crop pictures to on the reading screen. Anything
 * uploaded is shown inside this ratio here, so an admin sees the framing
 * before they save rather than discovering it on a phone afterwards.
 */
export const PICTURE_RATIO = 3 / 2;

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm"];

/** How far from 3:2 a picture may be before it is worth mentioning. */
const RATIO_TOLERANCE = 0.18;

interface UploadResult {
  url: string;
  key: string;
}

interface UploadTicket {
  uploadUrl: string;
  method: "PUT" | "POST";
  key: string;
  publicUrl: string;
  requiredHeaders?: Record<string, string>;
  formFields?: Record<string, string>;
  fileField?: string;
}

/**
 * Uploads a file straight to object storage using a short-lived signed ticket
 * from the server, so the bytes never pass through the application.
 *
 * The local development fallback (no cloud storage configured) sends the raw
 * bytes as a PUT; Cloudinary is a signed POST with the file and a handful of
 * form fields alongside it — the ticket says which.
 */
async function uploadFile(
  file: File,
  purpose: "education-media" | "education-thumbnail",
): Promise<UploadResult> {
  const ticketResponse = await fetch("/api/admin/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      purpose,
      contentType: file.type,
      sizeBytes: file.size,
      filename: file.name,
    }),
  });

  const ticketBody = await ticketResponse.json();
  if (!ticketResponse.ok) {
    throw new Error(ticketBody?.error?.message ?? "This file could not be uploaded.");
  }
  const ticket = ticketBody.data as UploadTicket;

  const sent =
    ticket.method === "POST"
      ? await fetch(ticket.uploadUrl, { method: "POST", body: formDataFor(ticket, file) })
      : await fetch(ticket.uploadUrl, {
          method: "PUT",
          headers: ticket.requiredHeaders,
          body: file,
        });

  if (!sent.ok) {
    // Cloudinary's own rejection reason (wrong format, over the account's
    // plan limits, quota exhausted) is far more useful than a blanket "not
    // set up" message once the ticket itself was issued fine — that part
    // failing is what actually means storage has no credentials configured.
    const cloudinaryError =
      ticket.method === "POST" ? (await sent.json().catch(() => null))?.error?.message : null;
    throw new Error(
      cloudinaryError ??
        "The file could not be sent to storage. Picture storage may not be set up yet — ask whoever set up this system.",
    );
  }

  // Cloudinary's own response is the source of truth for the final URL —
  // the ticket's `publicUrl` is only a best guess made before the upload.
  if (ticket.method === "POST") {
    const uploaded = await sent.json().catch(() => null);
    if (uploaded?.secure_url) {
      return { url: uploaded.secure_url as string, key: ticket.key };
    }
  }

  return { url: ticket.publicUrl, key: ticket.key };
}

function formDataFor(ticket: UploadTicket, file: File): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(ticket.formFields ?? {})) {
    data.append(name, value);
  }
  data.append(ticket.fileField ?? "file", file);
  return data;
}

/** Reads a picture's own proportions, so a badly-shaped one can be flagged. */
function measureRatio(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : null);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

/**
 * Picture chooser.
 *
 * Shows the picture at the ratio the phone uses, warns (but does not refuse)
 * when the chosen file is a very different shape, and lets it be removed
 * again. A warning rather than a rejection on purpose: the admin may have
 * the only copy of that picture, and a slightly-off crop is far better than
 * no picture at all.
 */
export function PicturePicker({
  url,
  onChange,
  label = "Picture",
  purpose = "education-media",
}: {
  url: string | null;
  onChange: (result: { url: string; key: string } | null) => void;
  label?: string;
  purpose?: "education-media" | "education-thumbnail";
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [shapeWarning, setShapeWarning] = React.useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setShapeWarning(null);

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError("Choose a JPG, PNG or WebP picture.");
      return;
    }

    setBusy(true);
    try {
      const ratio = await measureRatio(file);
      if (ratio !== null && Math.abs(ratio - PICTURE_RATIO) > RATIO_TOLERANCE) {
        setShapeWarning(
          ratio > PICTURE_RATIO
            ? "This picture is wider than the space it goes in, so the sides will be trimmed."
            : "This picture is taller than the space it goes in, so the top and bottom will be trimmed.",
        );
      }
      const result = await uploadFile(file, purpose);
      onChange(result);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "This picture could not be uploaded.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {url ? (
        <div className="space-y-2">
          <div
            className="border-line bg-surface-sunken overflow-hidden rounded-md border"
            style={{ aspectRatio: String(PICTURE_RATIO) }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- author
                uploads of unknown dimensions, served from object storage. */}
            <img src={url} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
              Replace
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChange(null)} disabled={busy}>
              <Trash2 className="size-4" aria-hidden="true" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="border-line text-ink-muted hover:border-primary-border hover:bg-surface-hover flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed py-8 text-sm"
          style={{ aspectRatio: String(PICTURE_RATIO) }}
        >
          {busy ? (
            <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          ) : (
            <ImageUp className="size-6" aria-hidden="true" />
          )}
          <span>{busy ? "Uploading…" : `Choose a ${label.toLowerCase()}`}</span>
          <span className="text-ink-subtle text-xs">Best shape: landscape, 3 wide by 2 tall</span>
        </button>
      )}

      {shapeWarning ? (
        <p className="text-warning text-xs font-medium">{shapeWarning}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-danger text-xs font-semibold">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Video chooser. Same upload path as pictures; kept separate because the
 * size limits, accepted types and preview are all different, and mixing them
 * into one component made both harder to follow.
 */
export function VideoPicker({
  url,
  onChange,
}: {
  url: string | null;
  onChange: (result: { url: string; key: string } | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      setError("Choose an MP4 or WebM video.");
      return;
    }

    setBusy(true);
    try {
      const result = await uploadFile(file, "education-media");
      onChange(result);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "This video could not be uploaded.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_VIDEO_TYPES.join(",")}
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {url ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- captions
              are authored per topic, not available at upload time. */}
          <video src={url} controls className="border-line w-full rounded-md border" />
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
              Replace
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChange(null)} disabled={busy}>
              <Trash2 className="size-4" aria-hidden="true" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="border-line text-ink-muted hover:border-primary-border hover:bg-surface-hover flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed py-8 text-sm"
        >
          {busy ? (
            <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          ) : (
            <ImageUp className="size-6" aria-hidden="true" />
          )}
          <span>{busy ? "Uploading…" : "Choose a video"}</span>
          <span className="text-ink-subtle text-xs">MP4 or WebM</span>
        </button>
      )}

      {error ? (
        <p role="alert" className="text-danger text-xs font-semibold">
          {error}
        </p>
      ) : null}
    </div>
  );
}
