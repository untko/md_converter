
# MD Converter

A powerful, client-side web application to convert PDF and HTML files into well-structured Markdown notes using the Google Gemini API (more AI options coming soon). This tool is designed for students, researchers, and writers who need to quickly transform documents into an easily editable and portable markdown format.

## Key Features

-   **Intelligent Conversion**: Leverages the Gemini API for high-quality, context-aware conversion of complex document structures.
-   **PDF & HTML Support**: Handles both PDF documents and HTML files.
-   **Advanced PDF Image Handling**:
    -   Automatically extracts embedded images directly from PDFs.
    -   Filters images by size to ignore small icons or artifacts.
    -   Resizes large images to a configurable maximum dimension.
    -   Re-encodes images to modern formats like WebP for smaller file sizes.
-   **Flexible Output Options**:
    -   **Copy to Clipboard**: Copy the complete Markdown with base64-embedded images.
    -   **Download `.md`**: Save a standalone Markdown file, also with embedded images.
    -   **Download `.zip`**: Get a clean, portable project with a Markdown file and a separate `assets` folder for all images.
-   **Customizable Formatting**:
    -   Choose the starting header level (H1, H2, H3) to fit the note-taking structure.
    -   Select a citation style (APA, MLA, Chicago) for automated formatting of references.
    -   Fine-tune image quality, format, and dimensions.
-   **Live Preview & Editor**: Edit the generated Markdown in a side-by-side view with a real-time rendered preview.
-   **Secure & Private**: All file processing and API calls happen directly in the browser. the files and API key are never sent to a third-party server. The API key is stored securely in the browser's local storage.
-   **Responsive Design**: A clean, modern, and fully responsive UI that works on any device.

---

## How It Works

The application's logic is tailored to the specific file type being processed, ensuring the best possible output.

### PDF Processing Workflow

1.  **Client-Side Parsing**: The PDF file is loaded and parsed entirely in the browser using `pdf.js`.
2.  **Content Extraction**: The app iterates through every page to extract two key components:
    -   **Text**: All text content is concatenated into a single stream.
    -   **Images**: Embedded images are programmatically extracted from the PDF's operator list. They are filtered, resized, and re-encoded based on the user's settings.
3.  **Image Grouping (for large documents)**: To optimize the API call and provide better context, if a PDF contains numerous images (5 or more), they are automatically grouped into "contact sheets"—single JPEG images containing up to 4 of the original images with labels (e.g., `image_1`, `image_2`).
4.  **Single API Call**: The entire text content and all extracted images (or contact sheets) are sent to the Gemini API in a single, comprehensive request.
5.  **AI-Powered Reconstruction**: A carefully engineered system prompt instructs the Gemini model to reconstruct the document logically, placing special placeholders (`[IMAGE_1]`, `[IMAGE_2]`, etc.) where the corresponding images should appear in the text.
6.  **Final Assembly**: The returned Markdown is post-processed. The `[IMAGE_N]` placeholders are replaced with either base64-encoded image data (for standalone files) or relative links to the `assets` folder (for the `.zip` archive).

### HTML Processing Workflow

1.  **Text Extraction**: The HTML file is read as plain text.
2.  **API Conversion**: The raw HTML content is sent to the Gemini API.
3.  **Targeted System Prompt**: The system prompt for HTML instructs the model on how to handle specific tags, such as converting `<table>` to Markdown tables and managing `<img>` tags based on the user's "Image Handling" setting (preserving links, describing, or ignoring).
4.  **Clean Markdown Output**: The model returns a clean, well-formatted Markdown document. Since HTML images are typically remote URLs, no local image processing is needed.

---

## Technology Stack

-   **Frontend**: React, TypeScript, Tailwind CSS
-   **Core Logic**:
    -   **`@google/genai`**: For all interactions with the Gemini API.
    -   **`pdf.js`**: For client-side PDF parsing and image extraction.
    -   **`jszip`**: For creating `.zip` archives directly in the browser.
-   **UI & Rendering**:
    -   **`react-markdown`**: For rendering the live Markdown preview.
    -   **`remark-gfm`**: A plugin for `react-markdown` to support GitHub Flavored Markdown (tables, strikethrough, etc.).

### Gemini API integration (model + key switching)

-   **New switched SDK**: The app depends on `@google/genai` (see `package.json`), which is Google's new "switched" Gemini SDK. The SDK already defaults to the updated Gemini Developer API surface, so we automatically benefit from the new endpoints without any additional routing logic.
-   **Runtime model discovery**: `services/geminiService.ts` exposes `getAvailableModels`, which calls `https://generativelanguage.googleapis.com/v1beta/models` with the active API key. The response is filtered down to text-capable models and drives the "AI Model" dropdown in `SettingsPanel`. Because the UI only renders the SDK-supported options, switching between Gemini models always uses the supported, switched API names.
-   **Per-request key switching**: Every invocation of `generateMarkdownStream` (and `generateImageDescription`) instantiates `GoogleGenAI` with the API key currently stored in local storage. When the user presses "Switch API Key" in the header, `App.tsx` updates that stored key, triggering a refetch of the model list. Subsequent conversions therefore use the new key automatically without any stale client instances.
-   **Streaming on the new API**: The conversion layer uses `ai.models.generateContentStream` to talk to the Gemini API. This call is only available in the new SDK, so successful streaming responses are a direct verification that we are exercising the switched API surface.

---

## Local Development Setup

This project is a standard Vite + React application. You will work with a familiar Node.js toolchain (`npm install`, `npm run dev`, `npm run build`, etc.) just like any other modern frontend project.

### Prerequisites

-   [Node.js](https://nodejs.org/) 18 or newer (ships with a compatible version of `npm`).
-   A package manager (`npm` is assumed in the commands below).
-   A Gemini API key (see the **Environment variables** section).

### Installation & Running

1.  **Get the code**: Clone the repository or download and extract the source code files to a local directory.

    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Install Dependencies**: Run the following to install required packages:
    ```bash
    npm install
    ```

   Note: While some dependencies are loaded from CDNs, the project uses Vite for building and development, so installation is required.

3.  **Start the Development Server** (Recommended for Development):
    Use Vite's built-in server for hot module replacement and proper TypeScript handling:
    ```bash
    npm run dev
    ```

   This starts the app at http://localhost:5173 (or similar).

   **For Production/Static Serving**:
   - Build the app first:
     ```bash
     npm run build
     ```
   - Then serve the `dist/` folder with a static server, e.g.:
     ```bash
     npx serve dist
     ```

   Alternative static servers (for built app only):
   - **Python 3**: `python3 -m http.server` (in the `dist/` folder).
   - **VS Code Live Server**: Open the `dist/` folder and use the extension.

4.  **Open the App**: Once the server is running, open the web browser and navigate to the local address it provides (usually `http://localhost:8000`, `http://localhost:3000`, or `http://127.0.0.1:5500`).

5.  **Enter API Key**: The application will prompt you to enter the Gemini API Key on the first launch. This key is stored in the browser's local storage and is not exposed anywhere else.

**Create a production build**: When you're ready to test the optimized bundle, run:

    ```bash
    npm run build
    ```
### Environment variables

-   `GEMINI_API_KEY` – optional, but recommended. Creating a `.env` file at the project root (or exporting the variable in the shell) lets Vite embed a default Gemini API key at build time. If this variable is absent, the UI will prompt you to paste the key manually before you can run a conversion.

    ```bash
    echo "GEMINI_API_KEY=ask-the-key" >> .env
    ```

---

## Project Structure

The codebase is planned (not yet) to logically separate concerns between UI, core services, and type definitions.

```
project/
│
├── .gitignore          # Ignores /dist, /node_modules, .env.local
├── README.md           # main project README.
├── agents.md           # README for agents: a dedicated, predictable place to provide the context and instructions to help AI coding agents work on project.
│
├── index.html            # <-- The root HTML page. This is hosted on the static host (Vercel, Netlify, GitHub Pages).
├── package.json          # <-- Defines all the dependencies (React, Vite, Tailwind, vite-plugin-pwa). No 'Express', 'Stripe', or 'Resend'.
├── vite.config.ts        # <-- Configures Vite, Tailwind, and the PWA plugin.
├── tsconfig.json         # <-- TypeScript config for the app.
│
├── .env.local            # Holds the *public* keys, e.g., VITE_GUMROAD_LINK="https://...".
│
├── public/               # <-- Static assets for the PWA.
│   ├── manifest.webmanifest  # The PWA manifest file.
│   └── icon-512.png          # the PWA app icon.
│
└── src/                    # <-- the entire application lives here.
    │
    ├── components/         # "Dumb" UI components (Button.tsx, Modal.tsx, etc.).
    │   ├── ui/
    │   ├── layout/
    │   └── conversion/
    │
    ├── hooks/              # React-specific "business logic".
    │   ├── useProStatus.ts     # <-- CRITICAL: This is the monetization logic. It checks localStorage for a key and has a 'validateAndSaveKey' function.
    │   ├── useLocalStorage.ts  # Reusable hook to save user settings.
    │   └── useFileConverter.ts # Manages all conversion state (file, loading, error, output).
    │
    ├── services/           # pure" business logic (no React hooks).
    │   ├── test/            # <-- Test utilities (e.g., mockGeminiService, fileprocessor).
    │   ├── geminiService.ts    # Makes the fetch call directly to the Gemini API from the browser.
    │   ├── fileProcessor.ts  # Main orchestrator for file processing
    │   ├── imageGrouper.ts   # Logic for creating contact sheets
    │   └── imageProcessor.ts # Extracts and processes images from PDFs
    │   └── ...
    │
    ├── context/            # Global state (e.g., AppSettingsContext).
    │   └── ...
    │
    ├── pages/              # "Smart" components that assemble the app's pages.
    │   ├── ConversionPage.tsx  # Uses 'useFileConverter' and 'useProStatus' to build the main UI.
    │   └── AboutPage.tsx
    │
    ├── types/              # <-- All app's types 
    │   └── index.ts        # e.g., 'LicenseInfo', 'UserSettings', 'FileProcessingOptions'.
    │
    ├── App.tsx             # Sets up the main 'react-router-dom' routes.
    ├── main.tsx            # App entry point. Mounts React into 'index.html'.
    └── index.css           # Global CSS and Tailwind imports.
```