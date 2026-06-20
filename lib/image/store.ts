import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

function heroDir(): string {
  const dir = process.env.HERO_IMAGE_DIR || "storage/hero-images";
  return path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
}

export function heroPathFor(blogId: string): string {
  return path.join(heroDir(), `${blogId}.png`);
}

export async function writeHero(blogId: string, buffer: Buffer): Promise<string> {
  const dir = heroDir();
  await mkdir(dir, { recursive: true });
  const filePath = heroPathFor(blogId);
  await writeFile(filePath, buffer);
  return filePath;
}

export async function readHero(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}
