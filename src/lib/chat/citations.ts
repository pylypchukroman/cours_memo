export type RetrievedChunk = {
  id: string;
  sourceFileId: string;
  text: string;
  startMs: number | null;
  endMs: number | null;
  originalName: string;
  lessonTitle: string | null;
};

export type ProposedCitation = {
  chunkId: string;
  excerpt: string;
};

export type ValidCitation = {
  chunkId: string;
  sourceFileId: string;
  lessonTitle: string;
  originalName: string;
  startMs: number | null;
  endMs: number | null;
  excerpt: string;
};

export const INSUFFICIENT_EVIDENCE_MESSAGE =
  "The course materials do not contain enough evidence to answer this question.";

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function validateCitations(
  proposed: ProposedCitation[],
  chunks: RetrievedChunk[],
): ValidCitation[] {
  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const seen = new Set<string>();
  const valid: ValidCitation[] = [];

  for (const citation of proposed) {
    const chunk = byId.get(citation.chunkId);
    const excerpt = collapse(citation.excerpt);
    if (!chunk || !excerpt || seen.has(chunk.id)) {
      continue;
    }

    if (!collapse(chunk.text).includes(excerpt)) {
      continue;
    }

    seen.add(chunk.id);
    valid.push({
      chunkId: chunk.id,
      sourceFileId: chunk.sourceFileId,
      lessonTitle: chunk.lessonTitle?.trim() || chunk.originalName,
      originalName: chunk.originalName,
      startMs: chunk.startMs,
      endMs: chunk.endMs,
      excerpt,
    });
  }

  return valid;
}
