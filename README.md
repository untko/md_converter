# MD Converter

MD Converter is a single-page React + Vite application that runs entirely in the browser to turn PDF or HTML files into well-structured Markdown. It extracts inline images, calls the Gemini API for markdown reconstruction, and lets you review, edit, and download the output without uploading the source documents to a server.

## Highlights

- **Client-side PDF + HTML ingestion** – `App.tsx` lets you drop a file and chooses the right conversion pipeline based on its MIME type. PDFs get parsed with `pdf.js`, while HTML is streamed to Gemini as-is.
- **Live Gemini model discovery** – `getAvailableModels` calls `https://generativelanguage.googleapis.com/v1beta/models` with your API key so the "AI Model" dropdown only shows text-capable models exposed by the current key.
- **PDF image extraction + contact sheets** – `imageProcessor.ts` walks the PDF operator list to rebuild every embedded image, filters/resizes them with the advanced settings, and `imageGrouper.ts` optionally builds 2×2 contact sheets when there are 5+ images so a single Gemini request still has the right visual context.
- **Adaptive chunking for long documents** – `contentChunker.ts` splits very long text streams and groups inline images into the fewest possible Gemini API calls while staying within each model’s input-token limit. A secondary byte budget keeps the base64 inline images under ~3 MB per request, so PDFs full of screenshots no longer exceed Gemini’s payload cap. The progress modal now surfaces an estimated token count for each chunk so you can see how much budget every Gemini call consumes.
- **Rate-limit aware streaming** – `generateMarkdownStream` listens for Gemini’s `RetryInfo` payloads when you hit the per-minute quota, automatically waits the requested number of seconds (up to three retries), and echoes the delay inside the progress modal so large jobs resume without manual intervention.
- **Progressive UX** – `ProgressModal`, `SettingsPanel`, `Dropzone`, and `ResultsView` work together to show upload state, conversion progress, and a markdown editor + preview with copy/download buttons. The processor now marks jobs as "completed" so the modal reaches a success state before handing off to the results screen.
- **Optional support widget** – the Ko-fi floating chat launcher in `index.html` offers an unobtrusive way for users to leave a tip without blocking downloads or editing.
- **Reset-friendly dropzone** – the drag-and-drop card now exposes an explicit "Clear File" action and clears the hidden `<input>` whenever you replace a file, so re-uploading the same PDF/HTML works without a refresh.
- **Corrected image-handling toggles** – PDFs always embed images inline (so the "preserve links" radio stays disabled), while HTML files can freely switch between ignoring images, asking Gemini for descriptions, or keeping the original links intact.

## Conversion workflow

### PDFs
1. **Read & parse** – `processPdf` loads the file into `pdf.js`, iterates every page, and accumulates text runs plus `ExtractedImage` objects.
2. **Image grouping** – once all images are collected, `groupImages` may build contact sheets so the Gemini request stays compact.
3. **Gemini call** – the PDF text plus each (grouped) image is split into token-aware chunks before streaming through `generateMarkdownStream`. The chunk-aware system prompt keeps numbering and structure consistent even if multiple API calls are required.
4. **Assembly** – placeholders are replaced either with base64 data URIs (standalone `.md`) or relative `./assets/...` paths (for the `.zip`).

### HTML
1. **Read** – the file is loaded as UTF-8 text, split into manageable parts, and chunked if necessary before `generateMarkdownStream` applies the HTML-specific system prompt (image preservation/description rules respect the UI setting).
2. **Assemble** – the returned markdown is displayed in the editor/preview split-view, ready for copy or download.

## Architecture

```
md_converter/
├── App.tsx              # Main UI state machine (file selection → progress → results)
├── components/          # Dropzone, SettingsPanel, ProgressModal, modals, etc.
├── hooks/useLocalStorage.ts
├── services/
│   ├── fileProcessor.ts     # Chooses PDF vs HTML pipeline and orchestrates Gemini calls
│   ├── geminiService.ts     # Wraps @google/genai streaming + model discovery
│   ├── contentChunker.ts    # Splits long text + image payloads into model-sized chunks
│   ├── promptBuilder.ts     # Builds the system prompt Gemini uses for Markdown conversion (chunk-aware)
│   ├── imageProcessor.ts    # Pulls embedded PDF images via pdf.js
│   ├── imageGrouper.ts      # Builds contact sheets for many images
├── assets/              # Static imagery for the landing UI
├── index.tsx            # React entry point
├── index.html           # Vite mount point
├── package.json         # Scripts + dependencies
└── vite.config.ts       # Vite + env injection for GEMINI_API_KEY
```

> The folder tree above reflects the working implementation (no `src/` nesting yet), which differs from the aspirational plan that used `src/components`, `context/`, etc.

## Development

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Run the dev server**
   ```bash
   npm run dev
   ```
   Vite listens on http://localhost:3000 per `vite.config.ts`.
3. **Build for production**
   ```bash
   npm run build
   ```
4. **Preview the build**
   ```bash
   npm run preview
   ```

### Environment variables
- `GEMINI_API_KEY` – optional but recommended. Define it in a `.env` file so Vite exposes it as `process.env.GEMINI_API_KEY`. Otherwise, the UI will prompt the user on first launch.

### Scripts & tooling
- `npm run lint` / `pnpm lint` – type-check the project via `tsc --noEmit`.
- `npm test` / `pnpm test` – currently runs the same type-check pass. Extend this script with Vitest once you add runtime tests.

## Prompt customization

Fine-tune how Gemini restructures documents by editing `services/promptBuilder.ts`. The helper centralizes the shared rules (headers, citations, math handling) and exposes separate code paths for PDFs and HTML sources. Updating the prompt builder immediately affects every conversion request without touching the streaming service code.

## Handling model limits & troubleshooting
- **Automatic chunking** – When the estimated token count of the extracted text + inline images would exceed the selected model’s input limit, `contentChunker.ts` splits the payload into as few API calls as possible (usually only one). If a model never reports its limit, the helper falls back to a conservative ceiling so the request is still pre-split before hitting Gemini’s hard cap. The progress modal now displays the approximate token usage for each chunk (plus the total estimate) so you can see how much quota every call consumes.
- **Quota retries** – Gemini returns `RESOURCE_EXHAUSTED` (HTTP 429) when you exhaust your per-minute token budget. Instead of failing immediately, the streaming helper reads the `RetryInfo.retryDelay` field (or the “Please retry in Ns” hint), updates the progress modal with the pause duration, waits automatically, and retries the chunk up to three times before surfacing an error.
- **Oversized images** – Each inline image is budgeted twice: by a token estimate and by an approximate byte size. If a single grouped image is still too large for the model, the processor surfaces an explicit error so you can reduce the max dimension/quality in the Advanced Image Settings before retrying.
- **Missing models?** Ensure the API key has access to Gemini text-capable models. Errors from `getAvailableModels` bubble up to the Settings panel for quick debugging.
- **PDF images look off?** Tweak the advanced image settings (format, quality, min/max dimensions) or disable grouping by keeping the total count below 5 images.


### Inspecting model token limits

Google’s Python SDK exposes the exact `input_token_limit` and `output_token_limit` for every model tied to your key. Run the snippet below (replace the API key with your own) to confirm the ceilings that the UI enforces while chunking:

```python
import google.generativeai as genai

genai.configure(api_key="<YOUR_KEY>")

print("--- Available Models and Input Limits ---")
for model in genai.list_models():
    if 'generateContent' in model.supported_generation_methods:
        print(f"Model: {model.display_name}")
        print(f"  Name: {model.name}")
        print(f"  Input Limit: {model.input_token_limit:,} tokens")
        print(f"  Output Limit: {model.output_token_limit:,} tokens")
        print("-" * 20)

print("\n--- Details for a Specific Model ---")
model_name = 'models/gemini-1.5-pro-latest'
model_info = genai.get_model(model_name)
print(f"Model: {model_info.display_name}")
print(f"  Input Limit: {model_info.input_token_limit:,} tokens")
print(f"  Output Limit: {model_info.output_token_limit:,} tokens")
```

Comparing those numbers with the progress modal’s token estimates tells you how close a conversion came to the quota and whether you should switch models or pause between jobs.


With this context, you can confidently evolve the repo without relying on the aspirational structure that was described in the previous README.
