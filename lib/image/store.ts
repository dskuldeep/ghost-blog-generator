import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

/**
 * Hero images are stored as bytes in the DB (shared across the web + worker
 * containers). For uploads that require a file path (e.g. the Ghost Admin API),
 * spill the bytes to a temp file and return its path.
 */
export async function heroTempFile(blogId: string, bytes: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "flo-hero-"));
  const filePath = path.join(dir, `${blogId}.png`);
  await writeFile(filePath, bytes);
  return filePath;
}
