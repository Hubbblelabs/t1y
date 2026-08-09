import "server-only";

import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { ServiceUnavailableError, ValidationError } from "@/lib/api/errors";
import { env, isStorageConfigured } from "@/lib/env";

/**
 * Cloudflare R2 object storage.
 *
 * Large media never passes through a Vercel function. The browser asks this
 * module for a short-lived presigned PUT URL and uploads straight to R2; only
 * the resulting metadata is written to Postgres.
 *
 *   Admin → request upload URL → API → presigned R2 URL
 *         → browser PUTs bytes directly to R2 → API records metadata
 */

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 60 * 60;

/** Only formats the platform actually renders are accepted. */
const ALLOWED_CONTENT_TYPES: Record<string, { kind: AssetKindValue; maxBytes: number }> = {
  "image/jpeg": { kind: "IMAGE", maxBytes: 10 * 1024 * 1024 },
  "image/png": { kind: "IMAGE", maxBytes: 10 * 1024 * 1024 },
  "image/webp": { kind: "IMAGE", maxBytes: 10 * 1024 * 1024 },
  "image/avif": { kind: "IMAGE", maxBytes: 10 * 1024 * 1024 },
  "video/mp4": { kind: "VIDEO", maxBytes: 500 * 1024 * 1024 },
  "video/webm": { kind: "VIDEO", maxBytes: 500 * 1024 * 1024 },
  "application/pdf": { kind: "PDF", maxBytes: 50 * 1024 * 1024 },
  "audio/mpeg": { kind: "AUDIO", maxBytes: 100 * 1024 * 1024 },
};

export type AssetKindValue = "IMAGE" | "VIDEO" | "PDF" | "AUDIO" | "OTHER";

export const UPLOAD_PURPOSES = [
  "education-media",
  "education-thumbnail",
  "exercise-video",
  "exercise-image",
  "export",
] as const;

export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

let client: S3Client | null = null;

function s3(): S3Client {
  if (!isStorageConfigured()) {
    throw new ServiceUnavailableError("File storage");
  }

  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
  });

  return client;
}

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  kind: AssetKindValue;
  expiresInSeconds: number;
  /** The browser must send exactly these headers with the PUT. */
  requiredHeaders: Record<string, string>;
}

/**
 * Issues a presigned PUT URL.
 *
 * The object key is generated server-side from a UUID — a caller-supplied
 * filename is only used for its extension, so a crafted name cannot traverse
 * paths or overwrite an existing object.
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

  const extension = safeExtension(params.filename, params.contentType);
  const key = `${params.purpose}/${new Date().getFullYear()}/${randomUUID()}${extension}`;

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ContentType: params.contentType,
    ContentLength: params.sizeBytes,
  });

  const uploadUrl = await getSignedUrl(s3(), command, {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  });

  return {
    uploadUrl,
    key,
    publicUrl: publicUrlFor(key),
    kind: rules.kind,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    requiredHeaders: {
      "Content-Type": params.contentType,
      "Content-Length": String(params.sizeBytes),
    },
  };
}

/** Time-limited read URL, for private objects such as generated exports. */
export async function createPresignedDownload(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key });
  return getSignedUrl(s3(), command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
}

/** Server-side upload. Reserved for small generated files such as exports. */
export async function putObject(params: {
  key: string;
  body: Uint8Array;
  contentType: string;
}): Promise<string> {
  await s3().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
  return params.key;
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }));
}

export function publicUrlFor(key: string): string {
  const base = env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  return base ? `${base}/${key}` : key;
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
