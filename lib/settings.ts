import { db } from "@/lib/db";
import { decrypt, encrypt, maskSecret } from "@/lib/crypto";

export interface HeroStyle {
  palette: "indigo" | "slate" | "emerald" | "rose" | "amber";
  font: "sans" | "serif";
  brand?: string;
}

export const DEFAULT_HERO_STYLE: HeroStyle = {
  palette: "indigo",
  font: "sans",
  brand: "",
};

export interface ResolvedSettings {
  geminiApiKey: string | null;
  geminiModel: string;
  temperature: number;
  maxResearchCalls: number;
  maxReviseIterations: number;
  evalThreshold: number;
  ghostApiUrl: string | null;
  ghostAdminKey: string | null;
  heroStyle: HeroStyle;
}

/** Ensure the singleton settings row exists and return the raw record. */
export async function ensureSettings() {
  return db.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

/** Server-side settings with secrets decrypted. Use only on the server. */
export async function getResolvedSettings(): Promise<ResolvedSettings> {
  const s = await ensureSettings();
  return {
    geminiApiKey: decrypt(s.geminiApiKeyEnc),
    geminiModel: s.geminiModel,
    temperature: s.temperature,
    maxResearchCalls: s.maxResearchCalls,
    maxReviseIterations: s.maxReviseIterations,
    evalThreshold: s.evalThreshold,
    ghostApiUrl: s.ghostApiUrl,
    ghostAdminKey: decrypt(s.ghostAdminKeyEnc),
    heroStyle: { ...DEFAULT_HERO_STYLE, ...((s.heroStyle as object) ?? {}) },
  };
}

/** Client-safe view: secrets masked, never plaintext. */
export async function getClientSettings() {
  const s = await ensureSettings();
  return {
    geminiApiKeySet: !!s.geminiApiKeyEnc,
    geminiApiKeyMasked: maskSecret(decrypt(s.geminiApiKeyEnc) ?? ""),
    geminiModel: s.geminiModel,
    temperature: s.temperature,
    maxResearchCalls: s.maxResearchCalls,
    maxReviseIterations: s.maxReviseIterations,
    evalThreshold: s.evalThreshold,
    ghostApiUrl: s.ghostApiUrl ?? "",
    ghostAdminKeySet: !!s.ghostAdminKeyEnc,
    ghostAdminKeyMasked: maskSecret(decrypt(s.ghostAdminKeyEnc) ?? ""),
    heroStyle: { ...DEFAULT_HERO_STYLE, ...((s.heroStyle as object) ?? {}) },
  };
}

export interface UpdateSettingsInput {
  geminiApiKey?: string; // plaintext; "" clears, undefined leaves unchanged
  geminiModel?: string;
  temperature?: number;
  maxResearchCalls?: number;
  maxReviseIterations?: number;
  evalThreshold?: number;
  ghostApiUrl?: string;
  ghostAdminKey?: string; // plaintext; "" clears, undefined leaves unchanged
  heroStyle?: HeroStyle;
}

export async function updateSettings(input: UpdateSettingsInput) {
  await ensureSettings();
  const data: Record<string, unknown> = {};

  if (input.geminiModel !== undefined) data.geminiModel = input.geminiModel;
  if (input.temperature !== undefined) data.temperature = input.temperature;
  if (input.maxResearchCalls !== undefined)
    data.maxResearchCalls = input.maxResearchCalls;
  if (input.maxReviseIterations !== undefined)
    data.maxReviseIterations = input.maxReviseIterations;
  if (input.evalThreshold !== undefined)
    data.evalThreshold = input.evalThreshold;
  if (input.ghostApiUrl !== undefined)
    data.ghostApiUrl = input.ghostApiUrl || null;
  if (input.heroStyle !== undefined) data.heroStyle = input.heroStyle;

  // Secrets: only touch when a non-undefined value is provided.
  if (input.geminiApiKey !== undefined) {
    data.geminiApiKeyEnc = input.geminiApiKey
      ? encrypt(input.geminiApiKey)
      : null;
  }
  if (input.ghostAdminKey !== undefined) {
    data.ghostAdminKeyEnc = input.ghostAdminKey
      ? encrypt(input.ghostAdminKey)
      : null;
  }

  await db.settings.update({ where: { id: "singleton" }, data });
  return getClientSettings();
}
