#!/usr/bin/env node
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { analyzeImage } from "./gemini.js";

// Load the repo's own .env so the server works regardless of the launcher's cwd.
// Falls back silently to ambient env (e.g. vars passed in the MCP client config).
try {
  process.loadEnvFile(join(import.meta.dirname, "..", ".env"));
} catch {
  /* no .env present — rely on ambient environment */
}

const server = new McpServer({ name: "gemini-image-mcp", version: "0.1.0" });

server.registerTool(
  "analyze_image",
  {
    title: "Analyze image(s) with Gemini",
    description:
      "Analyze one or more images with Google's Gemini vision models and return a text " +
      "answer. Pass a single image to read a screenshot/diagram/chart, or several to " +
      "compare them (e.g. before/after, spot-the-difference) — all without loading raw " +
      "image bytes into the calling agent's context.",
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
        .describe("Override the Gemini model (e.g. gemini-pro-latest for harder visual reasoning)."),
    },
  },
  async ({ image, prompt, model }) => {
    try {
      const text = await analyzeImage({ image, prompt, model });
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
