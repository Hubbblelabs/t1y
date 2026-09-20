import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { ForbiddenError, ValidationError } from "@/lib/api/errors";
import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { noContent } from "@/lib/api/response";
import { Capability } from "@/lib/permissions/roles";
import { isStorageConfigured } from "@/lib/env";
import { LOCAL_KEY_PATTERN } from "@/lib/storage/r2";

const MAX_BYTES = 500 * 1024 * 1024;

/**
 * PUT /api/admin/uploads/local?key=…
 *
 * For demos and development. With no cloud storage set up, uploads land in
 * `.local-uploads` and are served from /uploads, so the pictures and videos an
 * administrator adds still work. It refuses to run once cloud storage is set
 * up, and it only writes keys the upload endpoint itself generated, so a
 * crafted key cannot reach outside the folder.
 */
export const PUT = defineRoute({
  capability: Capability.STORAGE_UPLOAD,
  rateLimit: RateLimits.adminWrite,
  handler: async ({ request }) => {
    if (isStorageConfigured()) {
      throw new ForbiddenError("Local uploads are only used when cloud storage is not set up.");
    }

    const key = request.nextUrl.searchParams.get("key") ?? "";
    if (!LOCAL_KEY_PATTERN.test(key)) {
      throw new ValidationError("That upload key is not valid.");
    }

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
      throw new ValidationError("This file is empty or too large.");
    }

    const root = path.resolve(process.cwd(), ".local-uploads");
    const target = path.resolve(root, key);
    if (!target.startsWith(root + path.sep)) {
      throw new ValidationError("That upload key is not valid.");
    }

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    return noContent();
  },
});
