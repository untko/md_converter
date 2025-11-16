# MD Converter

MD Converter is a single-page React + Vite application that runs entirely in the browser to turn PDF or HTML files into well-structured Markdown. It extracts inline images, calls the Gemini API for markdown reconstruction, and lets you review, edit, and download the output without uploading the source documents to a server.

## Highlights

- **Client-side PDF + HTML ingestion** – `App.tsx` lets you drop a file and chooses the right conversion pipeline based on its MIME type. PDFs get parsed with `pdf.js`, while HTML is streamed to Gemini as-is.
- **Live Gemini model discovery** – `getAvailableModels` calls `https://generativelanguage.googleapis.com/v1beta/models` with your API key so the "AI Model" dropdown only shows text-capable models exposed by the current key.
- **PDF image extraction + contact sheets** – `imageProcessor.ts` walks the PDF operator list to rebuild every embedded image, filters/resizes them with the advanced settings, and `imageGrouper.ts` optionally builds 2×2 contact sheets when there are 5+ images so a single Gemini request still has the right visual context.
- **Progressive UX** – `ProgressModal`, `SettingsPanel`, `Dropzone`, and `ResultsView` work together to show upload state, conversion progress, and a markdown editor + preview with copy/download buttons. The processor now marks jobs as "completed" so the modal reaches a success state before handing off to the results screen.
- **Optional support widget** – the Ko-fi floating chat launcher in `index.html` offers an unobtrusive way for users to leave a tip without blocking downloads or editing.
- **Reset-friendly dropzone** – the drag-and-drop card now exposes an explicit "Clear File" action and clears the hidden `<input>` whenever you replace a file, so re-uploading the same PDF/HTML works without a refresh.
- **Corrected image-handling toggles** – PDFs always embed images inline (so the "preserve links" radio stays disabled), while HTML files can freely switch between ignoring images, asking Gemini for descriptions, or keeping the original links intact.

## Conversion workflow

### PDFs
1. **Read & parse** – `processPdf` loads the file into `pdf.js`, iterates every page, and accumulates text runs plus `ExtractedImage` objects.
2. **Image grouping** – once all images are collected, `groupImages` may build contact sheets so the Gemini request stays compact.
3. **Gemini call** – the PDF text plus each (grouped) image is streamed to `generateMarkdownStream`, which applies a PDF-specific system prompt to insert `[IMAGE_N]` placeholders where needed.
4. **Assembly** – placeholders are replaced either with base64 data URIs (standalone `.md`) or relative `./assets/...` paths (for the `.zip`).

### HTML
1. **Read** – the file is loaded as UTF-8 text and passed to `generateMarkdownStream` with the HTML-specific portion of the system prompt (image preservation/description rules respect the UI setting).
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
│   ├── promptBuilder.ts     # Builds the system prompt Gemini uses for Markdown conversion
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

## Tips & troubleshooting
- **Missing models?** Ensure the API key has access to Gemini text-capable models. Errors from `getAvailableModels` bubble up to the Settings panel for quick debugging.
- **PDF images look off?** Tweak the advanced image settings (format, quality, min/max dimensions) or disable grouping by keeping the total count below 5 images.


With this context, you can confidently evolve the repo without relying on the aspirational structure that was described in the previous README.
