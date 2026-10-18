"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/time";

type Citation = {
  chunkId: string;
  lessonTitle: string;
  originalName: string;
  startMs: number;
  endMs: number;
  excerpt: string;
};

type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "citations"; citations: Citation[] }
  | { type: "done"; status: "answered" | "insufficient_evidence" }
  | { type: "error"; message: string };

export function ChatPanel({ courseId }: { courseId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setAnswer("");
    setCitations([]);
    setStatus(null);
    setError(null);

    const response = await fetch(`/api/courses/${courseId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question }),
    });

    if (!response.ok || !response.body) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Could not get an answer.");
      setPending(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.split("\n").find((item) => item.startsWith("data: "));
        if (!line) {
          continue;
        }

        const payload = JSON.parse(line.slice(6)) as StreamEvent;
        if (payload.type === "delta") {
          setAnswer((current) => current + payload.text);
        } else if (payload.type === "citations") {
          setCitations(payload.citations);
        } else if (payload.type === "done") {
          setStatus(payload.status);
        } else if (payload.type === "error") {
          setError(payload.message);
        }
      }
    }

    setPending(false);
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={onSubmit} className="grid gap-3">
        <label className="grid gap-1 text-sm">
          Question
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            required
            maxLength={2000}
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <Button type="submit" disabled={pending}>
          Ask
        </Button>
      </form>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {answer ? <p className="whitespace-pre-wrap text-sm leading-6">{answer}</p> : null}
      {status === "insufficient_evidence" ? (
        <p className="text-sm text-muted-foreground">Answers without a confirmed citation are not shown.</p>
      ) : null}
      {citations.length > 0 ? (
        <ul className="grid gap-2">
          {citations.map((citation) => (
            <li key={citation.chunkId} className="rounded-lg border border-border px-3 py-2 text-sm">
              <p className="font-medium">
                {citation.lessonTitle} · {formatTimestamp(citation.startMs)}–{formatTimestamp(citation.endMs)}
              </p>
              <p className="text-muted-foreground">{citation.originalName}</p>
              <p className="mt-1">{citation.excerpt}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
