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

| Variable                  | Required | Default               | Notes                                                                    |
| ------------------------- | -------- | --------------------- | ------------------------------------------------------------------------ |
| `GEMINI_API_KEY`          | yes      | —                     | Your AI Studio key. Never commit it.                                     |
| `GEMINI_MODEL`            | no       | `gemini-flash-latest` | Cheap and fast. Use `gemini-4-argon` for the highest accuracy.           |
| `GEMINI_THINKING`         | no       | model default         | Default `thinking` level: `minimal`, `low`, `medium` or `high`.          |
| `GEMINI_MEDIA_RESOLUTION` | no       | model default         | Default `media_resolution`: `low`, `medium` or `high`.                   |
| `GEMINI_REPORT_USAGE`     | no       | off                   | Set to `1` to append a `[usage: …]` token-count line to each answer.     |

A per-call tool argument overrides the matching env default. An invalid env value is an error
rather than being silently ignored.

The key is sent as an `x-goog-api-key` header (kept out of URLs/logs) and is never written
to a tracked file — `.env` is gitignored.

## Use with Claude Code

```sh
claude mcp add gemini-image -- node /absolute/path/to/gemini-image-mcp/dist/index.js
```

The server loads its own `.env`, so no key needs to live in Claude's config. Restart Claude
Code, then it can call `analyze_image` with an image path and an optional prompt.

## Tool: `analyze_image`

| Argument | Type              | Required | Description                                                                                   |
| -------- | ----------------- | -------- | --------------------------------------------------------------------------------------------- |
| `image`  | string \| string[] | yes      | A single local file path or `http(s)` URL, or an array of them to compare/reason about together. |
| `prompt` | string            | no       | What to ask. Defaults to a detailed description (one image) or a comparison (several).         |
| `model`  | string            | no       | Per-call model override.                                                                       |
| `thinking` | `minimal` \| `low` \| `medium` \| `high` | no | How much the model reasons before answering. Omit for the model's default. |
| `media_resolution` | `low` \| `medium` \| `high` | no | How finely images are tokenized. Omit for the model's default. |

Pass several images to compare them (before/after, spot-the-difference, "do these match"). Each is
labelled `Image 1`, `Image 2`, … in order, so the prompt can refer to them. All images ride in a single
Gemini request.

### Accuracy vs cost

The defaults are tuned for quick, cheap descriptions and lose accuracy on thin lines, small text
and fine spatial detail. For those, pass `media_resolution: "high"` and `thinking: "high"`, and
consider `model: "gemini-4-argon"`. On a 124-question test of reading thin road markings from
top-down images, `gemini-pro-latest` with defaults scored 75%; `gemini-4-argon` with both set
to `high` scored 93%.

`thinking` maps to `generationConfig.thinkingConfig.thinkingLevel`, which needs a Gemini 3 or
later model; supported levels vary by model (for example, `gemini-4-argon` accepts `low`,
`medium` and `high` but not `minimal`), and an unsupported one returns the API's error.
`media_resolution` maps to `generationConfig.mediaResolution` (`MEDIA_RESOLUTION_*`). Thought
parts are never included in the returned answer.

Supported inputs: PNG, JPEG, WebP, GIF, BMP, HEIC/HEIF, and PDF.

## Smoke test

Verify the key + API + image path end to end, without the MCP layer. The prompt comes
first (pass `""` for the default), then one or more images:

```sh
npm run smoke -- "What does this image say?" ./test/sample.png
npm run smoke -- "What changed between these?" ./before.png ./after.png
npm run smoke -- --model gemini-4-argon --thinking high --media-resolution high --usage "Read the text." ./test/sample.png
```

`--model`, `--thinking`, `--media-resolution` and `--usage` mirror the tool arguments and
`GEMINI_REPORT_USAGE`.

## License

MIT
