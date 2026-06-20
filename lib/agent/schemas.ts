import { Type } from "@google/genai";

export const OUTLINE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    angle: {
      type: Type.STRING,
      description: "The unique angle / thesis of the post.",
    },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          heading: { type: Type.STRING },
          points: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["heading", "points"],
      },
    },
    researchQuestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Specific questions to research with web search.",
    },
  },
  required: ["title", "angle", "sections", "researchQuestions"],
};

export const DRAFT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    html: {
      type: Type.STRING,
      description:
        "The full blog body as clean semantic HTML (h2/h3, p, ul, ol, blockquote, a). No <html>/<head>/<body> wrappers, no inline styles.",
    },
    excerpt: {
      type: Type.STRING,
      description: "A 1–2 sentence meta description (max ~160 chars).",
    },
    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["title", "html", "excerpt", "tags"],
};

export const EVAL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    scores: {
      type: Type.OBJECT,
      properties: {
        accuracy: { type: Type.NUMBER },
        depth: { type: Type.NUMBER },
        originality: { type: Type.NUMBER },
        structure: { type: Type.NUMBER },
        skillAdherence: { type: Type.NUMBER },
        citations: { type: Type.NUMBER },
      },
      required: [
        "accuracy",
        "depth",
        "originality",
        "structure",
        "skillAdherence",
        "citations",
      ],
    },
    overall: {
      type: Type.NUMBER,
      description: "Overall quality from 0 to 1.",
    },
    feedback: {
      type: Type.STRING,
      description: "Specific, actionable critique for the next revision.",
    },
    gaps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Missing facts or claims that need more research.",
    },
  },
  required: ["scores", "overall", "feedback", "gaps"],
};
