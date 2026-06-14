// Direct end-to-end check of the Gemini call, bypassing the MCP stdio layer.
// Usage: npm run smoke -- <image-path-or-url> ["prompt"]
import { join } from "node:path";
import { analyzeImage } from "../src/gemini.js";

try {
  process.loadEnvFile(join(import.meta.dirname, "..", ".env"));
} catch {
  /* rely on ambient env */
}

const [image, prompt] = process.argv.slice(2);
if (!image) {
  console.error('Usage: npm run smoke -- <image-path-or-url> ["prompt"]');
  process.exit(1);
}

const text = await analyzeImage({ image, prompt });
console.log(text);
