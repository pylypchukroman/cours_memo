const PLACEHOLDER_KEYS = new Set(["", "sk-your-openai-key"]);

export type OpenAIEnv = {
  apiKey: string;
  extractionModel: string;
  embeddingModel: string;
};

export function getOpenAIEnv(): OpenAIEnv {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (PLACEHOLDER_KEYS.has(apiKey)) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  return {
    apiKey,
    extractionModel: process.env.OPENAI_EXTRACTION_MODEL?.trim() || "gpt-5.4-mini",
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
  };
}

export function hasOpenAIEnv(): boolean {
  try {
    getOpenAIEnv();
    return true;
  } catch {
    return false;
  }
}
