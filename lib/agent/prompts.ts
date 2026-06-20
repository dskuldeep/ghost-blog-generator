import type { Citation, EvalResult, Outline, SkillContext } from "@/lib/agent/types";

const MAX_REFERENCE_CHARS = 24000;

/** Build the system instruction from the skill (SKILL.md + reference files). */
export function buildSystemPrompt(skill: SkillContext): string {
  let refs = "";
  let used = 0;
  for (const f of skill.files) {
    const block = `\n\n----- FILE: ${f.path} -----\n${f.content}`;
    if (used + block.length > MAX_REFERENCE_CHARS) {
      refs += `\n\n----- FILE: ${f.path} (truncated) -----\n${f.content.slice(
        0,
        Math.max(0, MAX_REFERENCE_CHARS - used),
      )}`;
      break;
    }
    refs += block;
    used += block.length;
  }

  return `You are an expert blog writer operating as an autonomous agent. You follow the SKILL definition below exactly — its voice, rules, structure, and constraints take priority over generic writing habits.

When writing, be specific and authentic. Avoid generic AI filler, hedging, and clichés. Ground non-obvious claims in real, cited sources. Prefer concrete examples and data.

================= SKILL DEFINITION (SKILL.md) =================
${skill.skillMd}
${refs ? `\n================= REFERENCE FILES =================${refs}` : ""}
==============================================================`;
}

export function outlinePrompt(topic: {
  title: string;
  brief?: string | null;
}): string {
  return `Plan a blog post for this topic.

TOPIC: ${topic.title}
${topic.brief ? `BRIEF: ${topic.brief}` : ""}

Produce a strong, specific outline that follows the SKILL. Choose a clear angle/thesis. Break the post into logical sections with concrete talking points. Then list 3–7 specific research questions whose answers (facts, data, examples, recent developments) would make the post authoritative and well-sourced.`;
}

export function researchPrompt(
  topic: string,
  question: string,
): string {
  return `You are researching for a blog post on "${topic}".

Use web search to answer this research question with up-to-date, accurate information:

QUESTION: ${question}

Return a concise briefing: the key facts, figures, names, dates, and noteworthy findings. Attribute claims to their sources inline. Only include information you actually found via search.`;
}

export function draftPrompt(
  topic: { title: string; brief?: string | null },
  outline: Outline,
  research: string,
): string {
  return `Write the full blog post now, following the SKILL precisely.

TOPIC: ${topic.title}
${topic.brief ? `BRIEF: ${topic.brief}` : ""}

APPROVED OUTLINE:
Title: ${outline.title}
Angle: ${outline.angle}
${outline.sections
  .map(
    (s, i) =>
      `${i + 1}. ${s.heading}\n${s.points.map((p) => `   - ${p}`).join("\n")}`,
  )
  .join("\n")}

RESEARCH NOTES (use these facts; weave citations naturally as links where appropriate):
${research}

Write a complete, detailed, publication-ready post as clean semantic HTML. Use the research to support claims. Match the SKILL's voice and structure. Do not invent statistics or sources.`;
}

export function evalPrompt(
  topic: string,
  html: string,
  hasCitations: boolean,
): string {
  return `Critically evaluate this draft blog post about "${topic}" against the SKILL and general standards of excellent, authentic, well-researched writing.

Score each dimension from 0 to 1:
- accuracy: factual correctness and absence of fabrication
- depth: substance, specificity, and insight (not surface-level)
- originality: fresh angle and voice (not generic AI writing)
- structure: organization, flow, headings, readability
- skillAdherence: how well it follows the SKILL definition
- citations: are claims grounded in/linked to credible sources${
    hasCitations ? "" : " (note: no sources were provided to the writer)"
  }

Set "overall" as a holistic 0–1 score. Give specific, actionable "feedback" for the next revision, and list any "gaps" — missing facts or claims that need more web research.

DRAFT HTML:
${html}`;
}

export function revisePrompt(
  feedback: EvalResult,
  currentHtml: string,
  extraResearch: string,
): string {
  return `Revise the blog post to address this critique. Keep what works; fix what's flagged. Follow the SKILL.

CRITIQUE: ${feedback.feedback}
${feedback.gaps.length ? `GAPS TO CLOSE: ${feedback.gaps.join("; ")}` : ""}
${extraResearch ? `\nADDITIONAL RESEARCH:\n${extraResearch}` : ""}

CURRENT DRAFT HTML:
${currentHtml}

Return the improved full post as clean semantic HTML.`;
}

/** Optionally append a Sources section to the HTML when citations exist. */
export function appendSources(html: string, citations: Citation[]): string {
  if (!citations.length) return html;
  const items = citations
    .map(
      (c) =>
        `<li><a href="${escapeAttr(c.url)}" rel="noopener noreferrer">${escapeHtml(
          c.title || c.url,
        )}</a></li>`,
    )
    .join("");
  return `${html}\n<h2>Sources</h2>\n<ul>${items}</ul>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
