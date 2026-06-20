import type { ResolvedSettings } from "@/lib/settings";

export type EventLevel = "info" | "success" | "warn" | "error";

export interface AgentEvent {
  type: string; // stage | search | fetch | reference | draft | evaluate | revise | done | error
  level?: EventLevel;
  message: string;
  data?: unknown;
}

export type EventSink = (e: AgentEvent) => Promise<void> | void;

export interface SkillContext {
  skillMd: string;
  files: { path: string; content: string }[];
}

export interface AgentInput {
  topic: { title: string; brief?: string | null };
  skill: SkillContext;
  settings: ResolvedSettings;
}

export interface Citation {
  url: string;
  title?: string;
}

export interface EvalScores {
  accuracy: number;
  depth: number;
  originality: number;
  structure: number;
  skillAdherence: number;
  citations: number;
}

export interface EvalResult {
  scores: EvalScores;
  overall: number;
  feedback: string;
  gaps: string[];
}

export interface AgentResult {
  title: string;
  html: string;
  markdown?: string;
  excerpt: string;
  tags: string[];
  evalScore: number;
  evalData: EvalResult;
  citations: Citation[];
}

export interface Outline {
  title: string;
  angle: string;
  sections: { heading: string; points: string[] }[];
  researchQuestions: string[];
}
