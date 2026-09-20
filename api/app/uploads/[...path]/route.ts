import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { LOCAL_KEY_PATTERN } from "@/lib/storage/r2";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
  ".mp3": "audio/mpeg",
};

/**
 * Serves files saved by the local upload fallback (see
 * app/api/admin/uploads/local). Only keys the upload endpoint could have
 * generated are readable, so this cannot be pointed at any other file.
 */
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const key = (await context.params).path.join("/");
  if (!LOCAL_KEY_PATTERN.test(key)) return new NextResponse("Not found", { status: 404 });

  const root = path.resolve(process.cwd(), ".local-uploads");
  const target = path.resolve(root, key);
  if (!target.startsWith(root + path.sep)) return new NextResponse("Not found", { status: 404 });

  try {
    const bytes = await readFile(target);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": TYPES[path.extname(target)] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
