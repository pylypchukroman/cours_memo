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
    const formData = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const response = await fetch(`/api/courses/${courseId}/upload`, {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);

    if (!response.ok) {
      setError(payload?.error ?? "Could not upload the file.");
      return;
    }

    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <label className="grid gap-1 text-sm">
        Lesson title
        <Input name="lessonTitle" maxLength={200} />
      </label>
      <label className="grid gap-1 text-sm">
        VTT file, up to 5 MB
        <Input name="file" type="file" accept=".vtt,text/vtt" required />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        Upload
      </Button>
    </form>
  );
}
