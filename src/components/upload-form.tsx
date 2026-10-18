"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UploadForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/courses/${courseId}/upload`, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Could not upload the file.");
        return;
      }

      form.reset();
      router.refresh();
    } catch {
      setError("Could not upload the file.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <label className="grid gap-1 text-sm">
        Lesson title
        <Input name="lessonTitle" maxLength={200} />
      </label>
      <label className="grid gap-1 text-sm">
        Lesson date
        <Input name="lessonDate" type="date" />
      </label>
      <label className="grid gap-1 text-sm">
        Timezone
        <Input name="timezone" defaultValue="Australia/Sydney" maxLength={64} />
      </label>
      <label className="grid gap-1 text-sm">
        Unit code
        <Input name="unitCode" maxLength={40} />
      </label>
      <label className="grid gap-1 text-sm">
        Subject
        <Input name="subject" maxLength={120} />
      </label>
      <label className="grid gap-1 text-sm">
        Transcript, .vtt or .txt, up to 5 MB
        <Input name="file" type="file" accept=".vtt,.txt,text/vtt,text/plain" required />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        Upload
      </Button>
    </form>
  );
}
