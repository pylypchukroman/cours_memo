import { getOpenAIEnv } from "@/lib/openai/env";

type JsonSchema = Record<string, unknown>;

type Usage = {
  inputTokens: number;
  outputTokens: number;
};

export class OpenAIRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAIRequestError";
  }
}

async function postOpenAI(path: string, body: unknown): Promise<unknown> {
  const { apiKey } = getOpenAIEnv();
  const response = await fetch(`https://api.openai.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new OpenAIRequestError(`OpenAI request failed with status ${response.status}`);
  }

  return response.json();
}

function readUsage(payload: unknown): Usage {
  const usage = (payload as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  };
}

function readOutputText(payload: unknown): string {
  const output = (payload as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }).output ?? [];
  const text = output
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" && part.text)
    .map((part) => part.text)
    .join("");

  if (!text) {
    throw new OpenAIRequestError("OpenAI response did not include output text");
  }

  return text;
}

export async function embedTexts(inputs: string[]): Promise<{ vectors: number[][]; usage: Usage }> {
  const { embeddingModel } = getOpenAIEnv();
  const vectors: number[][] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };

  for (let index = 0; index < inputs.length; index += 64) {
    const batch = inputs.slice(index, index + 64);
    const payload = await postOpenAI("/embeddings", {
      model: embeddingModel,
      input: batch,
    });
    const data = (payload as { data?: Array<{ embedding: number[]; index: number }> }).data ?? [];
    const ordered = [...data].sort((left, right) => left.index - right.index);
    if (ordered.length !== batch.length) {
      throw new OpenAIRequestError("OpenAI embeddings response was incomplete");
    }
    vectors.push(...ordered.map((item) => item.embedding));
    const batchUsage = readUsage(payload);
    usage.inputTokens += batchUsage.inputTokens;
    usage.outputTokens += batchUsage.outputTokens;
  }

  return { vectors, usage };
}

export async function createStructuredResponse<T>(options: {
  model: string;
  schemaName: string;
  schema: JsonSchema;
  instructions: string;
  input: string;
  maxOutputTokens?: number;
}): Promise<{ data: T; usage: Usage; model: string }> {
  const payload = await postOpenAI("/responses", {
    model: options.model,
    store: false,
    max_output_tokens: options.maxOutputTokens ?? 2000,
    instructions: options.instructions,
    input: options.input,
    text: {
      format: {
        type: "json_schema",
        name: options.schemaName,
        strict: true,
        schema: options.schema,
      },
    },
  });

  const text = readOutputText(payload);
  return {
    data: JSON.parse(text) as T,
    usage: readUsage(payload),
    model: options.model,
  };
}
