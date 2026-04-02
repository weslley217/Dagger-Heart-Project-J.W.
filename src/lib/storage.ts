import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { slugify } from "@/lib/utils";

const storageRoot = path.join(process.cwd(), "storage");
const referenceRoot = path.join(storageRoot, "reference");

export async function ensureStorage() {
  await mkdir(referenceRoot, { recursive: true });
}

export function buildStoredFileKey(name: string, prefix = "asset") {
  const ext = path.extname(name) || ".bin";
  const base = slugify(path.basename(name, ext)) || "arquivo";
  return `${prefix}-${base}-${Date.now()}${ext}`;
}

export async function saveReferenceFile(fileKey: string, buffer: Buffer) {
  await ensureStorage();
  const target = path.join(referenceRoot, path.basename(fileKey));
  await writeFile(target, buffer);
  return target;
}

export function resolveReferenceFile(fileKey: string) {
  return path.join(referenceRoot, path.basename(fileKey));
}
