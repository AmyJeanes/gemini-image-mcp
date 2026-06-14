# gemini-image-mcp

A tiny [MCP](https://modelcontextprotocol.io) server that analyzes images with Google's
Gemini vision models. It exposes one tool, `analyze_image`, that takes a local image path
(or URL) plus an optional prompt and returns Gemini's text answer.

**Why:** it lets an agent (e.g. Claude Code) read screenshots, diagrams, charts, or UI
states *by reference* — the raw image bytes go to Gemini, and only the text answer comes
back, so they never bloat the calling agent's context window.

It talks straight to the Gemini REST API (`generativelanguage.googleapis.com`) with `fetch` —
no Google SDK, no `gemini-cli`, nothing tied to the deprecated consumer CLI.

## Setup

```sh
npm install
npm run build
cp .env.example .env   # then put your key in .env
```

Get an API key at <https://aistudio.google.com/apikey>.

### Configuration

Set via `.env` (loaded automatically from the repo root) or ambient environment:

| Variable         | Required | Default               | Notes                                              |
| ---------------- | -------- | --------------------- | -------------------------------------------------- |
| `GEMINI_API_KEY` | yes      | —                     | Your AI Studio key. Never commit it.               |
| `GEMINI_MODEL`   | no       | `gemini-flash-latest` | Use `gemini-pro-latest` for harder visual reasoning. |

The key is sent as an `x-goog-api-key` header (kept out of URLs/logs) and is never written
to a tracked file — `.env` is gitignored.

## Use with Claude Code

```sh
claude mcp add gemini-image -- node /absolute/path/to/gemini-image-mcp/dist/index.js
```

The server loads its own `.env`, so no key needs to live in Claude's config. Restart Claude
Code, then it can call `analyze_image` with an image path and an optional prompt.

## Tool: `analyze_image`

| Argument | Type   | Required | Description                                                        |
| -------- | ------ | -------- | ------------------------------------------------------------------ |
| `image`  | string | yes      | Absolute path to a local image file, or an `http(s)` URL.          |
| `prompt` | string | no       | What to ask about the image. Defaults to a detailed description.   |
| `model`  | string | no       | Per-call model override.                                           |

Supported inputs: PNG, JPEG, WebP, GIF, BMP, HEIC/HEIF, and PDF.

## Smoke test

Verify the key + API + image path end to end, without the MCP layer:

```sh
npm run smoke -- ./test/sample.png "What does this image say?"
```

## License

MIT
