const PLACEHOLDER_KEYS = new Set(["", "sk-your-openai-key"]);

export type OpenAIEnv = {
  apiKey: string;
  chatModel: string;
  extractionModel: string;
  classifierModel: string;
  embeddingModel: string;
};

export function getOpenAIEnv(): OpenAIEnv {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (PLACEHOLDER_KEYS.has(apiKey)) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  return {
    apiKey,
    chatModel: process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-5.4-mini",
    extractionModel: process.env.OPENAI_EXTRACTION_MODEL?.trim() || "gpt-5.4-mini",
    classifierModel: process.env.OPENAI_CLASSIFIER_MODEL?.trim() || "gpt-5.4-nano",
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
