// Direct end-to-end check of the Gemini call, bypassing the MCP stdio layer.
// Usage: npm run smoke -- "<prompt>" <image1> [image2 ...]
// Pass "" as the prompt to use the built-in default.
import { join } from "node:path";
import { analyzeImage } from "../src/gemini.js";

try {
  process.loadEnvFile(join(import.meta.dirname, "..", ".env"));
} catch {
  /* rely on ambient env */
}

const [prompt, ...images] = process.argv.slice(2);
if (images.length === 0) {
  console.error('Usage: npm run smoke -- "<prompt>" <image1> [image2 ...]');
  process.exit(1);
}

const text = await analyzeImage({ image: images, prompt });
console.log(text);
