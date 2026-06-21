import { getGeminiClient } from "@/lib/gemini";
import { generateGrounded, generateJSON } from "@/lib/agent/llm";
import { DRAFT_SCHEMA, EVAL_SCHEMA, OUTLINE_SCHEMA } from "@/lib/agent/schemas";
import {
  appendSources,
  buildSystemPrompt,
  draftPrompt,
  evalPrompt,
  outlinePrompt,
  researchPrompt,
  revisePrompt,
} from "@/lib/agent/prompts";
import type {
  AgentInput,
  AgentResult,
  Citation,
  EvalResult,
  EventSink,
  Outline,
} from "@/lib/agent/types";

interface DraftShape {
  title: string;
  html: string;
  excerpt: string;
  tags: string[];
}

function mergeCitations(into: Citation[], more: Citation[]) {
  const seen = new Set(into.map((c) => c.url));
  for (const c of more) {
    if (!seen.has(c.url)) {
      seen.add(c.url);
      into.push(c);
    }
  }
}

function wordCount(html: string): number {
  return html
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * The agentic blog pipeline:
 * outline → grounded research → draft → evaluate → (research gaps → revise → evaluate)* → finalize.
 */
export async function runAgent(
  input: AgentInput,
  emit: EventSink,
): Promise<AgentResult> {
  const { settings, skill, topic } = input;
  if (!settings.geminiApiKey) {
    throw new Error("Gemini API key is not configured (see Settings).");
  }
  const ai = getGeminiClient(settings.geminiApiKey);
  const model = settings.geminiModel;
  const system = buildSystemPrompt(skill);
  const temperature = settings.temperature;

  // 1. Outline
  await emit({ type: "stage", message: `Planning the post for "${topic.title}"…` });
  const outline = await generateJSON<Outline>(ai, model, {
    system,
    prompt: outlinePrompt(topic),
    schema: OUTLINE_SCHEMA,
    temperature,
  });
  await emit({
    type: "stage",
    level: "success",
    message: `Outline ready: "${outline.title}" — ${outline.sections.length} sections, ${outline.researchQuestions.length} research questions.`,
    data: { outline },
  });

  // 2. Research (grounded with Google Search)
  const citations: Citation[] = [];
  const notes: string[] = [];
  const questions = outline.researchQuestions.slice(
    0,
    settings.maxResearchCalls,
  );
  await emit({
    type: "stage",
    message: `Researching ${questions.length} questions with web search…`,
  });
  for (const q of questions) {
    await emit({ type: "search", message: `Searching: ${q}` });
    try {
      const { text, sources } = await generateGrounded(ai, model, {
        system,
        prompt: researchPrompt(topic.title, q),
      });
      notes.push(`Q: ${q}\n${text}`);
      mergeCitations(citations, sources);
      await emit({
        type: "fetch",
        message: `Found ${sources.length} source(s).`,
        data: { sources },
      });
    } catch (err) {
      await emit({
        type: "search",
        level: "warn",
        message: `Search failed for "${q}": ${
          err instanceof Error ? err.message : "error"
        }`,
      });
    }
  }
  const research =
    notes.join("\n\n---\n\n") || "(No research notes were gathered.)";

  // 3. Draft
  await emit({ type: "stage", message: "Writing the first draft…" });
  let draft = await generateJSON<DraftShape>(ai, model, {
    system,
    prompt: draftPrompt(topic, outline, research),
    schema: DRAFT_SCHEMA,
    temperature,
    maxOutputTokens: 16384,
  });
  await emit({
    type: "draft",
    level: "success",
    message: `Draft complete (~${wordCount(draft.html)} words).`,
  });

  // 4. Evaluate
  async function evaluate(html: string): Promise<EvalResult> {
    return generateJSON<EvalResult>(ai, model, {
      system,
      prompt: evalPrompt(topic.title, html, citations.length > 0),
      schema: EVAL_SCHEMA,
      temperature: 0.2,
    });
  }

  await emit({ type: "stage", message: "Evaluating the draft…" });
  let evalResult = await evaluate(draft.html);
  await emit({
    type: "evaluate",
    message: `Score ${(evalResult.overall * 100).toFixed(0)}/100. ${evalResult.feedback.slice(0, 160)}`,
    data: { eval: evalResult },
  });

  // 5. Revise loop
  let iteration = 0;
  while (
    evalResult.overall < settings.evalThreshold &&
    iteration < settings.maxReviseIterations
  ) {
    iteration++;
    await emit({
      type: "revise",
      message: `Revising (iteration ${iteration}/${settings.maxReviseIterations})…`,
    });

    // Close gaps with extra grounded research.
    let extra = "";
    const gapQs = evalResult.gaps.slice(
      0,
      Math.max(1, Math.ceil(settings.maxResearchCalls / 2)),
    );
    for (const g of gapQs) {
      await emit({ type: "search", message: `Researching gap: ${g}` });
      try {
        const { text, sources } = await generateGrounded(ai, model, {
          system,
          prompt: researchPrompt(topic.title, g),
        });
        extra += `\nGAP: ${g}\n${text}\n`;
        mergeCitations(citations, sources);
      } catch {
        /* tolerate gap-research failures */
      }
    }

    draft = await generateJSON<DraftShape>(ai, model, {
      system,
      prompt: revisePrompt(evalResult, draft.html, extra),
      schema: DRAFT_SCHEMA,
      temperature,
      maxOutputTokens: 16384,
    });
    evalResult = await evaluate(draft.html);
    await emit({
      type: "evaluate",
      message: `Re-scored ${(evalResult.overall * 100).toFixed(0)}/100.`,
      data: { eval: evalResult },
    });
  }

  // 6. Finalize
  await emit({ type: "stage", message: "Finalizing…" });
  const html = appendSources(draft.html, citations);
  const result: AgentResult = {
    title: draft.title || outline.title,
    html,
    excerpt: draft.excerpt,
    tags: draft.tags ?? [],
    evalScore: evalResult.overall,
    evalData: evalResult,
    citations,
  };
  await emit({
    type: "done",
    level: "success",
    message: `Done. Final score ${(evalResult.overall * 100).toFixed(0)}/100, ${citations.length} sources.`,
  });
  return result;
}
