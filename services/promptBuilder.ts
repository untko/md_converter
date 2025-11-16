import { ConversionSettings } from '../types';

type SupportedFileType = 'pdf' | 'html';

const clampHeadingLevel = (startHeader: ConversionSettings['startHeader']): number => {
    const numericLevel = parseInt(startHeader.replace(/[^0-9]/g, ''), 10);
    if (Number.isNaN(numericLevel) || numericLevel < 1) return 1;
    if (numericLevel > 6) return 6;
    return numericLevel;
};

const buildHeadingRule = (settings: ConversionSettings): string => {
    const headingLevel = clampHeadingLevel(settings.startHeader);
    const hashPrefix = '#'.repeat(headingLevel);
    const headingTag = `h${headingLevel}`;
    return `- Headers: Start the document with a ${headingTag.toUpperCase()} rendered as \`${hashPrefix}\`. Do not use more than three heading levels total.`;
};

const buildCitationRule = (settings: ConversionSettings): string => {
    if (settings.citationStyle === 'none') {
        return '- Citations: Preserve any in-text citation exactly as it appears in the source document.';
    }
    return `- Citations: Normalize in-text references to ${settings.citationStyle.toUpperCase()} style. Keep a "References" or bibliography section as a Markdown list if one exists.`;
};

const buildHtmlImageRule = (settings: ConversionSettings): string => {
    switch (settings.imageHandling) {
        case 'preserve-links':
            return '- Images: Convert every <img> tag into Markdown that references the same remote URL. Do not inline base64 data.';
        case 'describe':
            return '- Images: Replace every <img> tag with a concise description followed by a generated caption: `[Image: description]\\n*Caption: text*`.';
        default:
            return '- Images: Ignore <img> tags and do not mention them in the output.';
    }
};

const pdfInstructions = `- You will receive raw PDF text followed by zero or more inline images.
- Some images may arrive inside "contact sheets" that contain multiple labelled sub-images such as image_1, image_2, etc.
- Insert image placeholders at the correct location in the Markdown body using the format \`[IMAGE_N]\` where N is the original number on the sheet.
- Never describe or summarize the images—only place the placeholder.`;

const buildSharedPrompt = (settings: ConversionSettings): string => {
    return [
        'You are an expert technical writer who converts source documents into a single, well-structured Markdown file.',
        'Follow these constraints:',
        buildHeadingRule(settings),
        '- LaTeX: Preserve all math as LaTeX. Use `$inline$` for inline expressions and `$$block$$` for display math.',
        '- Content: Retain tables, lists, and semantic structure found in the source.',
        buildCitationRule(settings),
    ].join('\n');
};

interface ChunkContext {
    index: number;
    total: number;
}

export const buildGeminiPrompt = (
    settings: ConversionSettings,
    fileType: SupportedFileType,
    chunkContext?: ChunkContext,
): string => {
    const shared = buildSharedPrompt(settings);

    const fileSpecificRule =
        fileType === 'pdf'
            ? pdfInstructions
            : buildHtmlImageRule(settings);

    const chunkGuidance = chunkContext && chunkContext.total > 1
        ? `- Chunking: You are processing chunk ${chunkContext.index + 1} of ${chunkContext.total}. Continue exactly where the last chunk left off, avoid repeating prior sections, and keep numbering consistent.`
        : '';

    return [
        shared,
        fileSpecificRule,
        chunkGuidance,
        '',
        'Begin conversion.'
    ].filter(Boolean).join('\n');
};

export type { SupportedFileType };
