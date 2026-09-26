import "server-only";

import { randomUUID } from "node:crypto";

import { v2 as cloudinary } from "cloudinary";

import { ServiceUnavailableError, ValidationError } from "@/lib/api/errors";
import { env, isStorageConfigured } from "@/lib/env";

/**
 * Cloudinary media storage.
 *
 * Large media never passes through a Vercel function. The browser asks this
 * module for a short-lived *signed upload* — a set of form fields Cloudinary
 * will accept, valid for a few minutes — and POSTs the file straight to
 * Cloudinary with them. Only the resulting metadata is written to Postgres.
 *
 *   Admin → request upload ticket → API signs it → browser POSTs the file
 *         directly to Cloudinary → API records the metadata
 *
 * Unlike S3-compatible storage, a Cloudinary object's public URL is fully
 * determined by its cloud name, resource type and public ID — there is no
 * separate "public base URL" to configure, and nothing to get out of sync.
 */

const UPLOAD_URL_TTL_SECONDS = 15 * 60;

/** Only formats the platform actually renders are accepted. */
const ALLOWED_CONTENT_TYPES: Record<
  string,
  { kind: AssetKindValue; maxBytes: number; resourceType: "image" | "video" | "raw" }
> = {
  "image/jpeg": { kind: "IMAGE", maxBytes: 10 * 1024 * 1024, resourceType: "image" },
  "image/png": { kind: "IMAGE", maxBytes: 10 * 1024 * 1024, resourceType: "image" },
  "image/webp": { kind: "IMAGE", maxBytes: 10 * 1024 * 1024, resourceType: "image" },
  "image/avif": { kind: "IMAGE", maxBytes: 10 * 1024 * 1024, resourceType: "image" },
  "video/mp4": { kind: "VIDEO", maxBytes: 500 * 1024 * 1024, resourceType: "video" },
  "video/webm": { kind: "VIDEO", maxBytes: 500 * 1024 * 1024, resourceType: "video" },
  "application/pdf": { kind: "PDF", maxBytes: 50 * 1024 * 1024, resourceType: "raw" },
  "audio/mpeg": { kind: "AUDIO", maxBytes: 100 * 1024 * 1024, resourceType: "video" }, // Cloudinary treats audio as "video".
};

export type AssetKindValue = "IMAGE" | "VIDEO" | "PDF" | "AUDIO" | "OTHER";

export const UPLOAD_PURPOSES = [
  "education-media",
  "education-thumbnail",
  "exercise-video",
  "exercise-image",
  "export",
] as const;

/** Keys this module generates for the *local* dev fallback: purpose/year/uuid.ext. */
export const LOCAL_KEY_PATTERN =
  /^(education-media|education-thumbnail|exercise-video|exercise-image|export)\/\d{4}\/[0-9a-f-]{36}\.[a-z0-9]{2,4}$/;

export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

let configured = false;

function client() {
  if (!isStorageConfigured()) {
    throw new ServiceUnavailableError("File storage");
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

export interface PresignedUpload {
  /** Where the browser POSTs the file — the local fallback route, or Cloudinary's upload endpoint. */
  uploadUrl: string;
  /** "PUT" for the local dev fallback (raw bytes); "POST" for Cloudinary (multipart form). */
  method: "PUT" | "POST";
  key: string;
  publicUrl: string;
  kind: AssetKindValue;
  expiresInSeconds: number;
  /** PUT case only: headers the browser must send with the raw body. */
  requiredHeaders?: Record<string, string>;
  /**
   * POST case only: form fields the browser must send alongside the file —
   * the field named by `fileField` is where the file itself goes.
   */
  formFields?: Record<string, string>;
  fileField?: string;
}

/**
 * Issues a signed upload ticket.
 *
 * The object's identifier (Cloudinary's `public_id`) is generated
 * server-side from a UUID — a caller-supplied filename is only used for its
 * extension, so a crafted name cannot traverse paths or overwrite an
 * existing object.
 */
export async function createPresignedUpload(params: {
  purpose: UploadPurpose;
  contentType: string;
  sizeBytes: number;
  filename?: string;
}): Promise<PresignedUpload> {
  const rules = ALLOWED_CONTENT_TYPES[params.contentType];
  if (!rules) {
    throw new ValidationError("This file type is not supported.", [
      { field: "contentType", message: `Unsupported type: ${params.contentType}` },
    ]);
  }

  if (params.sizeBytes <= 0 || params.sizeBytes > rules.maxBytes) {
    throw new ValidationError("This file is too large.", [
      {
        field: "sizeBytes",
        message: `Maximum size for this type is ${Math.round(rules.maxBytes / 1024 / 1024)} MB.`,
      },
    ]);
  }

  const id = randomUUID();
  const key = `${params.purpose}/${new Date().getFullYear()}/${id}`;

  // No cloud storage set up (a laptop, or a demo): keep the file in
  // `.local-uploads` and serve it from /uploads, so pictures and videos can
  // still be added and shown.
  if (!isStorageConfigured()) {
    const extension = safeExtension(params.filename, params.contentType);
    const localKey = `${key}${extension}`;
    return {
      uploadUrl: `/api/admin/uploads/local?key=${encodeURIComponent(localKey)}`,
      method: "PUT",
      key: localKey,
      publicUrl: `/uploads/${localKey}`,
      kind: rules.kind,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
      requiredHeaders: { "Content-Type": params.contentType },
    };
  }

  const folder = `t1dpe/${params.purpose}`;
  const publicId = `${folder}/${id}`;
  const timestamp = Math.floor(Date.now() / 1000);

  // Only the parameters actually sent are signed — Cloudinary rejects the
  // request if the browser's form fields don't match what was signed here.
  const paramsToSign: Record<string, string | number> = { folder, public_id: id, timestamp };
  const signature = client().utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET!);

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${rules.resourceType}/upload`,
    method: "POST",
    key: publicId,
    publicUrl: publicUrlFor(publicId, rules.resourceType, params.contentType),
    kind: rules.kind,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    formFields: {
      api_key: env.CLOUDINARY_API_KEY!,
      timestamp: String(timestamp),
      signature,
      folder,
      public_id: id,
    },
    fileField: "file",
  };
}

/** Server-side upload. Used by the content importer and for small generated files (exports). */
export async function putObject(params: {
  key: string;
  body: Uint8Array;
  contentType: string;
}): Promise<string> {
  const rules = ALLOWED_CONTENT_TYPES[params.contentType];
  const resourceType = rules?.resourceType ?? "auto";

  await new Promise<void>((resolve, reject) => {
    const stream = client().uploader.upload_stream(
      { public_id: params.key, resource_type: resourceType, overwrite: true },
      (error) => (error ? reject(error) : resolve()),
    );
    stream.end(Buffer.from(params.body));
  });

  return params.key;
}

/**
 * Deletes an object. The resource type (image/video/raw) isn't recorded
 * anywhere the caller has to hand, so this tries each in turn — a Cloudinary
 * "not found" for the wrong type is harmless and expected.
 */
export async function deleteObject(key: string): Promise<void> {
  for (const resourceType of ["image", "video", "raw"] as const) {
    try {
      const result = await client().uploader.destroy(key, { resource_type: resourceType });
      if (result.result === "ok") return;
    } catch {
      // Try the next resource type.
    }
  }
}

/**
 * The public URL for a Cloudinary object, from its `public_id` alone — no
 * separate "public base URL" setting, unlike S3-compatible storage.
 */
export function publicUrlFor(
  publicId: string,
  resourceType: "image" | "video" | "raw" = "image",
  contentType?: string,
): string {
  const extension = contentType ? safeExtension(undefined, contentType) : "";
  return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload/${publicId}${extension}`;
}

/** Derives an extension from the declared content type, ignoring the filename's own. */
function safeExtension(filename: string | undefined, contentType: string): string {
  const byType: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "application/pdf": ".pdf",
    "audio/mpeg": ".mp3",
  };

  return byType[contentType] ?? "";
}
