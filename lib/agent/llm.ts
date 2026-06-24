import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";
import type { Citation } from "@/lib/agent/types";

export interface JSONCallOptions {
  system: string;
  prompt: string;
  schema: unknown;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GroundedCallOptions {
  system: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

function stripFence(text: string): string {
  const t = text.trim();
  const fence = t.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return (fence ? fence[1] : t).trim();
}

/** Best-effort parse: strip code fences, else slice from the first { or [ to its match. */
function lenientParse<T>(text: string): T | null {
  const cleaned = stripFence(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall back to the largest {...} or [...] span in the text.
    const start = cleaned.search(/[{[]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        /* give up */
      }
    }
    return null;
  }
}

export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Retry on transient/rate errors only.
      if (!/429|503|500|deadline|unavailable|overloaded|timeout/i.test(msg)) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

/**
 * Structured-output call: returns parsed JSON validated against `schema`.
 *
 * Hardened against the common Gemini 2.5/3 failure where "thinking" tokens
 * consume the output budget and truncate the JSON (finishReason MAX_TOKENS),
 * yielding empty/partial text. We retry with a progressively larger budget,
 * parse leniently, and surface a diagnostic message on final failure.
 */
export async function generateJSON<T>(
  ai: GoogleGenAI,
  model: string,
  opts: JSONCallOptions,
): Promise<T> {
  const attempts = 3;
  let budget = opts.maxOutputTokens ?? 16384;
  let lastReason = "";
  let lastSnippet = "";

  for (let i = 0; i < attempts; i++) {
    const res = await withRetry(() =>
      ai.models.generateContent({
        model,
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          temperature: opts.temperature ?? 0.7,
          maxOutputTokens: budget,
          responseMimeType: "application/json",
          responseSchema: opts.schema as never,
        },
      }),
    );

    const finishReason = res.candidates?.[0]?.finishReason ?? "";
    const text = res.text ?? "";
    lastReason = String(finishReason);
    lastSnippet = text.slice(0, 200);

    if (text) {
      const parsed = lenientParse<T>(text);
      if (parsed !== null) return parsed;
    }

    // Truncated or unparseable — grow the budget and try again.
    budget = Math.min(budget * 2, 65536);
  }

  throw new Error(
    `Model did not return valid JSON after ${attempts} attempts` +
      (lastReason ? ` (finishReason: ${lastReason})` : "") +
      (lastSnippet ? `. Response began: ${JSON.stringify(lastSnippet)}` : ""),
  );
}

/** Grounded call with Google Search; returns text plus extracted source citations. */
export async function generateGrounded(
  ai: GoogleGenAI,
  model: string,
  opts: GroundedCallOptions,
): Promise<{ text: string; sources: Citation[] }> {
  const res = await withRetry(() =>
    ai.models.generateContent({
      model,
      contents: opts.prompt,
      config: {
        systemInstruction: opts.system,
        temperature: opts.temperature ?? 0.4,
        maxOutputTokens: opts.maxOutputTokens ?? 4096,
        tools: [{ googleSearch: {} }],
      },
    }),
  );
  return { text: res.text ?? "", sources: extractSources(res) };
}

function extractSources(res: GenerateContentResponse): Citation[] {
  const chunks =
    res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const out: Citation[] = [];
  const seen = new Set<string>();
  for (const c of chunks) {
    const web = (c as { web?: { uri?: string; title?: string } }).web;
    if (web?.uri && !seen.has(web.uri)) {
      seen.add(web.uri);
      out.push({ url: web.uri, title: web.title });
    }
  }
  return out;
}
