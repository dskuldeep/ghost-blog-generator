"use client";

import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">
      Loading editor…
    </div>
  ),
});

function languageFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "md":
    case "markdown":
      return "markdown";
    case "json":
      return "json";
    case "yaml":
    case "yml":
      return "yaml";
    case "js":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "html":
    case "htm":
      return "html";
    case "css":
      return "css";
    case "svg":
    case "xml":
      return "xml";
    case "py":
      return "python";
    default:
      return "plaintext";
  }
}

export function CodeEditor({
  path,
  value,
  onChange,
  readOnly,
}: {
  path: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <MonacoEditor
      language={languageFor(path)}
      value={value}
      onChange={(v) => onChange?.(v ?? "")}
      theme="vs"
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        wordWrap: "on",
        scrollBeyondLastLine: false,
        lineNumbers: "on",
        renderLineHighlight: "line",
        padding: { top: 12, bottom: 12 },
      }}
    />
  );
}
