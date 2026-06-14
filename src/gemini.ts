import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".bmp": "image/bmp",
  ".pdf": "application/pdf",
};

const DEFAULT_PROMPT =
  "Describe this image in detail. Call out any text, UI elements, error messages, " +
  "charts, and anything visually notable. Be precise and factual.";

export interface AnalyzeOptions {
  /** Absolute path to a local image file, or an http(s) URL. */
  image: string;
  prompt?: string;
  model?: string;
  apiKey?: string;
}

interface ImagePayload {
  mimeType: string;
  data: string; // base64
}

async function loadImage(image: string): Promise<ImagePayload> {
  if (/^https?:\/\//i.test(image)) {
    const res = await fetch(image);
    if (!res.ok) {
      throw new Error(`Failed to fetch image URL (${res.status} ${res.statusText})`);
    }
    const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
    const buf = Buffer.from(await res.arrayBuffer());
    return { mimeType, data: buf.toString("base64") };
  }

  const ext = extname(image).toLowerCase();
  const mimeType = MIME_BY_EXT[ext];
  if (!mimeType) {
    throw new Error(
      `Unsupported file extension "${ext || "(none)"}". Supported: ${Object.keys(MIME_BY_EXT).join(", ")}`,
    );
  }
  const buf = await readFile(image);
  return { mimeType, data: buf.toString("base64") };
}

/** Send one image + prompt to Gemini and return the model's text answer. */
export async function analyzeImage(opts: AnalyzeOptions): Promise<string> {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set (env or .env)");

  const model = opts.model?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest";
  const prompt = opts.prompt?.trim() || DEFAULT_PROMPT;
  const { mimeType, data } = await loadImage(opts.image);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Header form keeps the key out of the URL (and out of any request logs).
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        { parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data } }] },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 1000)}`);
  }

  const json = (await res.json()) as any;
  const parts = json?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((p: any) => p?.text ?? "").join("").trim()
    : "";

  if (!text) {
    const finish = json?.candidates?.[0]?.finishReason;
    throw new Error(
      `Empty Gemini response${finish ? ` (finishReason: ${finish})` : ""}: ${JSON.stringify(json).slice(0, 500)}`,
    );
  }
  return text;
}
