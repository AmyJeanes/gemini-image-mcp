import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

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

const DEFAULT_PROMPT_SINGLE =
  "Describe this image in detail. Call out any text, UI elements, error messages, " +
  "charts, and anything visually notable. Be precise and factual.";

const DEFAULT_PROMPT_MULTI =
  "Compare these images. Describe what each one shows, then call out the key " +
  "similarities and differences between them. Be precise and factual.";

export interface AnalyzeOptions {
  /** One image, or several to reason about together — each a local path or http(s) URL. */
  image: string | string[];
  prompt?: string;
  model?: string;
  apiKey?: string;
}

interface ImagePayload {
  mimeType: string;
  data: string; // base64
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

/** A short human-readable label for an image, used to tag it in multi-image prompts. */
function labelFor(image: string): string {
  if (/^https?:\/\//i.test(image)) {
    try {
      return basename(new URL(image).pathname) || image;
    } catch {
      return image;
    }
  }
  return basename(image);
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

/** Send one or more images + a prompt to Gemini and return the model's text answer. */
export async function analyzeImage(opts: AnalyzeOptions): Promise<string> {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set (env or .env)");

  const images = (Array.isArray(opts.image) ? opts.image : [opts.image]).filter(
    (s) => typeof s === "string" && s.trim() !== "",
  );
  if (images.length === 0) throw new Error("No image provided");

  const model = opts.model?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest";
  const prompt =
    opts.prompt?.trim() || (images.length > 1 ? DEFAULT_PROMPT_MULTI : DEFAULT_PROMPT_SINGLE);

  const loaded = await Promise.all(images.map(loadImage));

  // Prompt first, then each image. With more than one, prefix each with an
  // "Image N" label so the prompt can refer to them unambiguously.
  const parts: Part[] = [{ text: prompt }];
  loaded.forEach((img, i) => {
    if (loaded.length > 1) parts.push({ text: `Image ${i + 1} (${labelFor(images[i])}):` });
    parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Header form keeps the key out of the URL (and out of any request logs).
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({ contents: [{ parts }] }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 1000)}`);
  }

  const json = (await res.json()) as any;
  const responseParts = json?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(responseParts)
    ? responseParts.map((p: any) => p?.text ?? "").join("").trim()
    : "";

  if (!text) {
    const finish = json?.candidates?.[0]?.finishReason;
    throw new Error(
      `Empty Gemini response${finish ? ` (finishReason: ${finish})` : ""}: ${JSON.stringify(json).slice(0, 500)}`,
    );
  }
  return text;
}
