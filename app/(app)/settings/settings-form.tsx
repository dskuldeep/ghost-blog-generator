"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

interface ClientSettings {
  geminiApiKeySet: boolean;
  geminiApiKeyMasked: string;
  geminiModel: string;
  temperature: number;
  maxResearchCalls: number;
  maxReviseIterations: number;
  evalThreshold: number;
  ghostApiUrl: string;
  ghostAdminKeySet: boolean;
  ghostAdminKeyMasked: string;
  heroStyle: {
    brand?: string;
    generateBackground?: boolean;
    imageModel?: string;
  };
}

type TestState = { ok: boolean; message: string } | null;

export function SettingsForm({
  initial,
  models,
}: {
  initial: ClientSettings;
  models: string[];
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  // Secret inputs are write-only; empty means "leave unchanged".
  const [geminiKey, setGeminiKey] = useState("");
  const [ghostKey, setGhostKey] = useState("");

  const [model, setModel] = useState(initial.geminiModel);
  const [temperature, setTemperature] = useState(initial.temperature);
  const [maxResearchCalls, setMaxResearchCalls] = useState(
    initial.maxResearchCalls,
  );
  const [maxReviseIterations, setMaxReviseIterations] = useState(
    initial.maxReviseIterations,
  );
  const [evalThreshold, setEvalThreshold] = useState(initial.evalThreshold);
  const [ghostUrl, setGhostUrl] = useState(initial.ghostApiUrl);
  const [brand, setBrand] = useState(initial.heroStyle.brand ?? "");
  const [generateBackground, setGenerateBackground] = useState(
    initial.heroStyle.generateBackground !== false,
  );
  const [imageModel, setImageModel] = useState(
    initial.heroStyle.imageModel ?? "gemini-3.1-flash-image-preview",
  );

  const [geminiSet, setGeminiSet] = useState(initial.geminiApiKeySet);
  const [ghostSet, setGhostSet] = useState(initial.ghostAdminKeySet);

  const [geminiTest, setGeminiTest] = useState<TestState>(null);
  const [ghostTest, setGhostTest] = useState<TestState>(null);
  const [testingGemini, setTestingGemini] = useState(false);
  const [testingGhost, setTestingGhost] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        geminiModel: model,
        temperature: Number(temperature),
        maxResearchCalls: Number(maxResearchCalls),
        maxReviseIterations: Number(maxReviseIterations),
        evalThreshold: Number(evalThreshold),
        ghostApiUrl: ghostUrl,
        heroStyle: { brand, generateBackground, imageModel },
      };
      if (geminiKey) payload.geminiApiKey = geminiKey;
      if (ghostKey) payload.ghostAdminKey = ghostKey;

      await apiFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (geminiKey) setGeminiSet(true);
      if (ghostKey) setGhostSet(true);
      setGeminiKey("");
      setGhostKey("");
      toast("Settings saved.", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function testGemini() {
    setTestingGemini(true);
    setGeminiTest(null);
    try {
      const res = await apiFetch<TestState>("/api/settings/test-gemini", {
        method: "POST",
        body: JSON.stringify({ apiKey: geminiKey || undefined, model }),
      });
      setGeminiTest(res);
    } catch (e) {
      setGeminiTest({ ok: false, message: (e as Error).message });
    } finally {
      setTestingGemini(false);
    }
  }

  async function testGhost() {
    setTestingGhost(true);
    setGhostTest(null);
    try {
      const res = await apiFetch<TestState>("/api/settings/test-ghost", {
        method: "POST",
        body: JSON.stringify({ url: ghostUrl, key: ghostKey || undefined }),
      });
      setGhostTest(res);
    } catch (e) {
      setGhostTest({ ok: false, message: (e as Error).message });
    } finally {
      setTestingGhost(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Gemini */}
      <Card>
        <CardHeader>
          <CardTitle>Gemini AI</CardTitle>
          <CardDescription>
            API key and model used for the agentic blog writer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="geminiKey">API key</Label>
              {geminiSet ? (
                <Badge tone="success">
                  set · {initial.geminiApiKeyMasked}
                </Badge>
              ) : (
                <Badge tone="warning">not set</Badge>
              )}
            </div>
            <Input
              id="geminiKey"
              type="password"
              placeholder={geminiSet ? "•••••••• (leave blank to keep)" : "AIza…"}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                list="gemini-models"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
              <datalist id="gemini-models">
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="temperature">Temperature</Label>
              <Input
                id="temperature"
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={testGemini}
              loading={testingGemini}
            >
              Test connection
            </Button>
            {geminiTest && (
              <span
                className={`text-sm ${
                  geminiTest.ok
                    ? "text-[var(--color-success)]"
                    : "text-[var(--color-danger)]"
                }`}
              >
                {geminiTest.message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ghost */}
      <Card>
        <CardHeader>
          <CardTitle>Ghost publishing</CardTitle>
          <CardDescription>
            Admin API URL and key from a Ghost Custom Integration
            (Settings → Integrations).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ghostUrl">Admin API URL</Label>
            <Input
              id="ghostUrl"
              placeholder="https://your-blog.ghost.io"
              value={ghostUrl}
              onChange={(e) => setGhostUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="ghostKey">Admin API key</Label>
              {ghostSet ? (
                <Badge tone="success">set · {initial.ghostAdminKeyMasked}</Badge>
              ) : (
                <Badge tone="warning">not set</Badge>
              )}
            </div>
            <Input
              id="ghostKey"
              type="password"
              placeholder={
                ghostSet ? "•••••••• (leave blank to keep)" : "<id>:<secret>"
              }
              value={ghostKey}
              onChange={(e) => setGhostKey(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={testGhost}
              loading={testingGhost}
            >
              Test connection
            </Button>
            {ghostTest && (
              <span
                className={`text-sm ${
                  ghostTest.ok
                    ? "text-[var(--color-success)]"
                    : "text-[var(--color-danger)]"
                }`}
              >
                {ghostTest.message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agent behavior */}
      <Card>
        <CardHeader>
          <CardTitle>Agent behavior</CardTitle>
          <CardDescription>
            Controls the research depth and generate/evaluate loop.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="research">Max research calls</Label>
            <Input
              id="research"
              type="number"
              min="0"
              max="30"
              value={maxResearchCalls}
              onChange={(e) => setMaxResearchCalls(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="revise">Max revise iterations</Label>
            <Input
              id="revise"
              type="number"
              min="0"
              max="6"
              value={maxReviseIterations}
              onChange={(e) => setMaxReviseIterations(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="threshold">Eval threshold (0–1)</Label>
            <Input
              id="threshold"
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={evalThreshold}
              onChange={(e) => setEvalThreshold(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Hero image */}
      <Card>
        <CardHeader>
          <CardTitle>Hero image</CardTitle>
          <CardDescription>
            A topic-relevant isometric line-art background is generated with the
            image model, then the Flo logo and the post title are composited on
            top. Disable to use a plain branded cover.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={generateBackground}
              onChange={(e) => setGenerateBackground(e.target.checked)}
              className="h-4 w-4"
            />
            Generate an AI background image for each post
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="imageModel">Image model</Label>
              <Input
                id="imageModel"
                list="image-models"
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
                disabled={!generateBackground}
              />
              <datalist id="image-models">
                <option value="gemini-3.1-flash-image-preview" />
                <option value="gemini-3-pro-image-preview" />
                <option value="gemini-2.5-flash-image" />
              </datalist>
              <p className="text-xs text-[var(--color-muted)]">
                Default: gemini-3.1-flash-image-preview (Nano Banana 2).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brand">Footer label (optional)</Label>
              <Input
                id="brand"
                placeholder="flo.finance"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          Save settings
        </Button>
      </div>
    </div>
  );
}
