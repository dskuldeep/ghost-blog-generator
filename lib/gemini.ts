import { GoogleGenAI } from "@google/genai";

/** Curated default model choices for the Settings dropdown (user can also type a custom id). */
export const GEMINI_MODELS = [
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-pro",
  "gemini-3.5-flash",
];

export function getGeminiClient(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

export async function testGemini(
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const ai = getGeminiClient(apiKey);
    const res = await ai.models.generateContent({
      model,
      contents: "Reply with the single word: ok",
      config: { maxOutputTokens: 10, temperature: 0 },
    });
    const text = res.text?.trim() ?? "";
    return {
      ok: true,
      message: `Connected. Model "${model}" responded${
        text ? ` ("${text.slice(0, 40)}")` : ""
      }.`,
    };
  } catch (err) {
    return { ok: false, message: humanizeError(err) };
  }
}

function humanizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/api[_ ]?key|API_KEY_INVALID|permission/i.test(msg)) {
    return "Invalid or unauthorized API key.";
  }
  if (/not found|NOT_FOUND|model/i.test(msg)) {
    return "Model not found or not available for this key.";
  }
  return msg.slice(0, 200);
}
