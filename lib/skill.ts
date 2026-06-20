import JSZip from "jszip";
import { slugify } from "@/lib/utils";

export interface ParsedSkill {
  name: string;
  description: string;
  skillMd: string;
  files: { path: string; content: string }[];
}

const TEXT_EXT =
  /\.(md|markdown|txt|json|ya?ml|csv|tsv|html?|xml|js|ts|jsx|tsx|py|css|svg)$/i;

/** Extract `name` and `description` from a SKILL.md YAML frontmatter block. */
export function parseFrontmatter(md: string): {
  name?: string;
  description?: string;
} {
  const match = md.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const out: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (m) {
      out[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return { name: out.name, description: out.description };
}

/** Parse a .skill (zip) buffer into SKILL.md + reference files. */
export async function parseSkillZip(buffer: Buffer): Promise<ParsedSkill> {
  const zip = await JSZip.loadAsync(buffer);

  // Locate SKILL.md (case-insensitive); pick the shallowest match.
  const entries = Object.values(zip.files).filter(
    (f) => !f.dir && !f.name.includes("__MACOSX") && !f.name.startsWith("."),
  );
  const skillEntries = entries.filter(
    (f) => f.name.split("/").pop()?.toLowerCase() === "skill.md",
  );
  if (skillEntries.length === 0) {
    throw new Error("No SKILL.md found in the uploaded .skill archive.");
  }
  skillEntries.sort(
    (a, b) => a.name.split("/").length - b.name.split("/").length,
  );
  const skillEntry = skillEntries[0];
  const rootDir = skillEntry.name.includes("/")
    ? skillEntry.name.slice(0, skillEntry.name.lastIndexOf("/") + 1)
    : "";

  const skillMd = await skillEntry.async("string");

  const files: { path: string; content: string }[] = [];
  for (const f of entries) {
    if (f === skillEntry) continue;
    if (rootDir && !f.name.startsWith(rootDir)) continue;
    const rel = rootDir ? f.name.slice(rootDir.length) : f.name;
    if (!rel) continue;
    if (!TEXT_EXT.test(rel)) continue; // skip binaries for the text editor
    files.push({ path: rel, content: await f.async("string") });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));

  const fm = parseFrontmatter(skillMd);
  return {
    name: fm.name || "Untitled skill",
    description: fm.description || "",
    skillMd,
    files,
  };
}

/** Pack a skill version into a .skill (zip) buffer with a single root folder. */
export async function packSkillZip(input: {
  name: string;
  skillMd: string;
  files: { path: string; content: string }[];
}): Promise<Buffer> {
  const zip = new JSZip();
  const root = slugify(input.name) || "skill";
  const folder = zip.folder(root)!;
  folder.file("SKILL.md", input.skillMd);
  for (const f of input.files) {
    folder.file(f.path, f.content);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

export const STARTER_SKILL_MD = `---
name: Blog Writer
description: Writes authentic, well-researched blog posts.
---

# Blog Writer

You are an expert blog writer. Write detailed, authentic, well-researched
posts that are genuinely useful to the reader.

## Voice & style
- Clear, confident, and concrete. Avoid filler and generic AI phrasing.
- Use specific examples, data, and named sources.
- Vary sentence length. Prefer active voice.

## Structure
- A compelling, specific title.
- A hook that states the value in the first two sentences.
- Well-organized sections with descriptive H2/H3 headings.
- A short, memorable conclusion.

## Research
- Ground every non-obvious claim in a real, citeable source.
- Prefer primary sources and recent data.

## Reference files
- See \`references/\` for additional context and examples.
`;
