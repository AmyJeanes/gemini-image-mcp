// Direct end-to-end check of the Gemini call, bypassing the MCP stdio layer.
// Usage: npm run smoke -- [--model M] [--thinking L] [--media-resolution R] [--usage] "<prompt>" <image1> [image2 ...]
// Pass "" as the prompt to use the built-in default.
import { join } from "node:path";
import { parseArgs } from "node:util";
import { analyzeImage, type MediaResolution, type ThinkingLevel } from "../src/gemini.js";

try {
  process.loadEnvFile(join(import.meta.dirname, "..", ".env"));
} catch {
  /* rely on ambient env */
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: "string" },
    thinking: { type: "string" },
    "media-resolution": { type: "string" },
    usage: { type: "boolean" },
  },
});

const [prompt, ...images] = positionals;
if (images.length === 0) {
  console.error(
    'Usage: npm run smoke -- [--model M] [--thinking L] [--media-resolution R] [--usage] "<prompt>" <image1> [image2 ...]',
  );
  process.exit(1);
}

const text = await analyzeImage({
  image: images,
  prompt,
  model: values.model,
  thinking: values.thinking as ThinkingLevel | undefined,
  mediaResolution: values["media-resolution"] as MediaResolution | undefined,
  reportUsage: values.usage || undefined,
});
console.log(text);
