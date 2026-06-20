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

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
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

/** Structured-output call: returns parsed JSON validated against `schema`. */
export async function generateJSON<T>(
  ai: GoogleGenAI,
  model: string,
  opts: JSONCallOptions,
): Promise<T> {
  const res = await withRetry(() =>
    ai.models.generateContent({
      model,
      contents: opts.prompt,
      config: {
        systemInstruction: opts.system,
        temperature: opts.temperature ?? 0.7,
        maxOutputTokens: opts.maxOutputTokens ?? 8192,
        responseMimeType: "application/json",
        responseSchema: opts.schema as never,
      },
    }),
  );
  const text = res.text ?? "";
  if (!text) throw new Error("Empty model response");
  try {
    return JSON.parse(stripFence(text)) as T;
  } catch {
    throw new Error("Model did not return valid JSON.");
  }
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
