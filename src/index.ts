#!/usr/bin/env node
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { analyzeImage, MEDIA_RESOLUTIONS, THINKING_LEVELS } from "./gemini.js";

// Load the repo's own .env so the server works regardless of the launcher's cwd.
// Falls back silently to ambient env (e.g. vars passed in the MCP client config).
try {
  process.loadEnvFile(join(import.meta.dirname, "..", ".env"));
} catch {
  /* no .env present — rely on ambient environment */
}

const server = new McpServer({ name: "gemini-image-mcp", version: "0.2.0" });

server.registerTool(
  "analyze_image",
  {
    title: "Analyze image(s) with Gemini",
    description:
      "Analyze one or more images with Google's Gemini vision models and return a text " +
      "answer. Pass a single image to read a screenshot/diagram/chart, or several to " +
      "compare them (e.g. before/after, spot-the-difference) — all without loading raw " +
      "image bytes into the calling agent's context. For fine detail (thin lines, small " +
      "text, dense diagrams, precise counts or spatial relationships), set " +
      'media_resolution: "high" and thinking: "high"; they cost more tokens and time but ' +
      "are markedly more accurate. Leave them unset for quick general descriptions.",
    inputSchema: {
      image: z
        .union([z.string(), z.array(z.string())])
        .describe(
          "Image(s) to analyze: a single local file path or http(s) URL, or an array of " +
            "them to reason about together. With multiple, each is labelled Image 1, Image 2, " +
            "… in order so your prompt can refer to them.",
        ),
      prompt: z
        .string()
        .optional()
        .describe(
          "Question/instruction. Defaults to a detailed description for one image, or a " +
            "comparison for several.",
        ),
      model: z
        .string()
        .optional()
        .describe(
          "Override the Gemini model (e.g. gemini-4-argon or gemini-pro-latest for harder " +
            "visual reasoning).",
        ),
      thinking: z
        .enum(THINKING_LEVELS)
        .optional()
        .describe(
          "How much the model reasons before answering. Use high for spatial reasoning, " +
            "counting, or reading subtle detail. Supported levels vary by model (Gemini 3+); " +
            "omit for the model's default.",
        ),
      media_resolution: z
        .enum(MEDIA_RESOLUTIONS)
        .optional()
        .describe(
          "How finely the image is tokenized. Use high for thin lines, small text, or small " +
            "features; low to save tokens on coarse images. Omit for the model's default.",
        ),
    },
  },
  async ({ image, prompt, model, thinking, media_resolution }) => {
    try {
      const text = await analyzeImage({
        image,
        prompt,
        model,
        thinking,
        mediaResolution: media_resolution,
      });
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  },
);

await server.connect(new StdioServerTransport());
