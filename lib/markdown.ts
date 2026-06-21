import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

marked.setOptions({ gfm: true, breaks: false });

let turndown: TurndownService | null = null;
function td(): TurndownService {
  if (!turndown) {
    turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
      emDelimiter: "*",
    });
    // Adds GFM support so HTML <table>/strikethrough/task lists convert to
    // Markdown instead of being flattened into loose lines.
    turndown.use(gfm);
  }
  return turndown;
}

/** Render Markdown to clean HTML (used for preview and Ghost publishing). */
export function markdownToHtml(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

/** Convert HTML to Markdown (used to seed the editor for HTML-only blogs). */
export function htmlToMarkdown(html: string): string {
  return td().turndown(html ?? "");
}
