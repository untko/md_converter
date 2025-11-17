
import type { Dispatch, SetStateAction } from 'react';
import { ConversionSettings, ProgressState, ConversionResult, ProgressStep, ExtractedImage, GeminiContentPart } from '../types';
import { generateMarkdownStream, countTokensForParts } from './geminiService';
import { extractAndProcessImagesFromPage } from './imageProcessor';
import { groupImages } from './imageGrouper';
import { chunkContentParts, splitTextIntoParts } from './contentChunker';

declare var JSZip: any;
declare var pdfjsLib: any;

const fileToArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = error => reject(error);
    });
};

const fileToText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const getFriendlyErrorMessage = (error: unknown): string => {
    const defaultMessage = "An unknown error occurred. Please check the console for details.";
    if (!(error instanceof Error) || !error.message) {
        return defaultMessage;
    }
    
    try {
        const errorData = JSON.parse(error.message);
        if (errorData?.error?.message) {
            return errorData.error.message;
        }
    } catch (e) {
        // Not a JSON error message, fall through.
    }
    
    return error.message;
};

interface SafeChunkResult {
    chunks: GeminiContentPart[][];
    tokenCounts: number[];
    totalTokens: number;
}

const ensureChunksWithinTokenLimit = async (
    initialChunks: GeminiContentPart[][],
    settings: ConversionSettings,
    fileType: 'pdf' | 'html',
    apiKey: string,
    chunkTokenLimit: number
): Promise<SafeChunkResult> => {
    const safeChunks: GeminiContentPart[][] = [];
    const tokenCounts: number[] = [];

    const splitChunkRecursively = async (parts: GeminiContentPart[]): Promise<void> => {
        if (!parts.length) {
            return;
        }

        const tokenCount = await countTokensForParts(parts, settings, fileType, apiKey);

        if (tokenCount <= chunkTokenLimit) {
            safeChunks.push(parts);
            tokenCounts.push(tokenCount);
            return;
        }

        if (parts.length === 1) {
            const [singlePart] = parts;
            if (singlePart?.text) {
                const smallerParts = splitTextIntoParts(singlePart.text);
                if (!smallerParts.length) {
                    throw new Error('Unable to split an oversized text block to meet the model token limit.');
                }
                await splitChunkRecursively(smallerParts);
                return;
            }

            throw new Error('A single image or binary block exceeds the model token limit. Reduce the max image size or switch to alt-text mode.');
        }

        const midpoint = Math.ceil(parts.length / 2);
        await splitChunkRecursively(parts.slice(0, midpoint));
        await splitChunkRecursively(parts.slice(midpoint));
    };

    for (const chunkParts of initialChunks) {
        await splitChunkRecursively(chunkParts);
    }

    const totalTokens = tokenCounts.reduce((sum, value) => sum + value, 0);
    return { chunks: safeChunks, tokenCounts, totalTokens };
};

export const processFile = async (
    file: File,
    settings: ConversionSettings,
    setProgress: Dispatch<SetStateAction<ProgressState>>,
    apiKey: string,
    modelTokenLimit?: number
): Promise<ConversionResult> => {

    const isPdf = file.type === 'application/pdf';

    if (isPdf) {
        return processPdf(file, settings, setProgress, apiKey, modelTokenLimit);
    } else if (file.type === 'text/html') {
        return processHtml(file, settings, setProgress, apiKey, modelTokenLimit);
    } else {
        throw new Error(`Unsupported file type: ${file.type}`);
    }
};

const processPdf = async (
    file: File,
    settings: ConversionSettings,
    setProgress: Dispatch<SetStateAction<ProgressState>>,
    apiKey: string,
    modelTokenLimit?: number
): Promise<ConversionResult> => {
    const sendImagesToGemini = settings.pdfImageMode !== 'alt-text';
    const steps: ProgressStep[] = [
        { name: `Reading file: ${file.name}`, status: 'pending' },
        { name: 'Extracting all text & images', status: 'pending' },
        { name: sendImagesToGemini ? 'Grouping images for processing' : 'Skipping Gemini image upload', status: 'pending' },
        { name: 'Generating Markdown from content', status: 'pending' },
        { name: 'Assembling final files', status: 'pending' },
    ];

    const updateStep = (index: number, status: 'in-progress' | 'completed' | 'error', details?: string) => {
        setProgress(prev => {
            const newSteps = [...prev.steps];
            if (!newSteps[index]) return prev;
            newSteps[index] = { ...newSteps[index], status, details: details || newSteps[index].details };
            return { ...prev, steps: newSteps, currentStep: index };
        });
    };
    setProgress({ steps, currentStep: 0, overallStatus: 'running' });

    // Step 0: Reading file
    updateStep(0, 'in-progress');
    const arrayBuffer = await fileToArrayBuffer(file);
    const baseFileName = file.name.replace(/\.[^/.]+$/, "");
    updateStep(0, 'completed');

    // Step 1: Extract ALL text and images
    updateStep(1, 'in-progress');
    let allText = '';
    const allExtractedImages: ExtractedImage[] = [];
    try {
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), cMapUrl: `https://unpkg.com/pdfjs-dist@2.10.377/cmaps/`, cMapPacked: true });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;

        for (let i = 1; i <= numPages; i++) {
            updateStep(1, 'in-progress', `Processing page ${i}/${numPages}...`);
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            let pageText = textContent.items.map((item: any) => item.str).join(' ') + '\n\n';

            const pageImages = await extractAndProcessImagesFromPage(page, settings);
            const startIndex = allExtractedImages.length;
            allExtractedImages.push(...pageImages);

            if (!sendImagesToGemini && pageImages.length) {
                const placeholderLines = pageImages
                    .map((_, idx) => `[IMAGE_${startIndex + idx + 1}]`)
                    .join('\n');
                pageText += `${placeholderLines}\n\n`;
            }

            allText += pageText;
            page.cleanup();
        }
        updateStep(1, 'completed', `Extracted text and ${allExtractedImages.length} images from ${numPages} pages.`);
    } catch (error) {
        const errorMessage = getFriendlyErrorMessage(error);
        updateStep(1, 'error', errorMessage);
        setProgress(prev => ({...prev, overallStatus: 'error'}));
        throw error;
    }
    
    // Step 2: Group images
    updateStep(2, 'in-progress');
    const apiImages = sendImagesToGemini ? await groupImages(allExtractedImages) : [];
    updateStep(2, 'completed', sendImagesToGemini
        ? `Processed ${apiImages.length} final images for API.`
        : 'Skipped image upload so Gemini only receives PDF text.');

    // Step 3: Generate Markdown
    const generatingStepIndex = 3;
    updateStep(generatingStepIndex, 'in-progress', 'Preparing content for Gemini...');
    let fullMarkdown = "";

    try {
        const textParts = splitTextIntoParts(allText);
        const parts: GeminiContentPart[] = sendImagesToGemini
            ? [
                ...textParts,
                ...apiImages.map(img => ({ inlineData: { mimeType: `image/${img.format}`, data: img.b64 } }))
            ]
            : textParts;

        const { chunks: estimatedChunks, chunkTokenLimit } = chunkContentParts(parts, modelTokenLimit);

        if (!estimatedChunks.length) {
            throw new Error('No content was extracted from the PDF.');
        }

        updateStep(generatingStepIndex, 'in-progress', 'Requesting exact token counts from Gemini...');

        const { chunks, tokenCounts, totalTokens } = await ensureChunksWithinTokenLimit(
            estimatedChunks,
            settings,
            'pdf',
            apiKey,
            chunkTokenLimit
        );

        const chunkCountLabel = chunks.length === 1
            ? 'Prepared 1 chunk after verification.'
            : `Prepared ${chunks.length} chunks after verification.`;
        const tokenSummaryLabel = `Gemini counted ${totalTokens.toLocaleString()} tokens total (limit ${chunkTokenLimit.toLocaleString()} per chunk).`;
        const chunkEstimatesPreview = tokenCounts
            .slice(0, 4)
            .map((tokens, index) => `Chunk ${index + 1}: ${tokens.toLocaleString()} tokens`)
            .join(' | ');
        const chunkEstimateSuffix = tokenCounts.length > 4
            ? ` | +${tokenCounts.length - 4} more chunk(s)`
            : '';
        const chunkSummaryMessage = [chunkCountLabel, tokenSummaryLabel, chunkEstimatesPreview + chunkEstimateSuffix]
            .filter(Boolean)
            .join(' ');
        updateStep(generatingStepIndex, 'in-progress', chunkSummaryMessage.trim());

        const handleStatusUpdate = (message: string) => {
            updateStep(generatingStepIndex, 'in-progress', message);
        };

        for (let i = 0; i < chunks.length; i++) {
            const chunkParts = chunks[i];
            const chunkContext = chunks.length > 1 ? { index: i, total: chunks.length } : undefined;
            const verifiedChunkTokens = tokenCounts[i];
            const sendingMessageBase = chunks.length > 1
                ? `Sending chunk ${i + 1}/${chunks.length} to Gemini`
                : 'Sending all content to Gemini';
            const sendingMessage = verifiedChunkTokens
                ? `${sendingMessageBase} (${verifiedChunkTokens.toLocaleString()} tokens)...`
                : `${sendingMessageBase}...`;
            updateStep(generatingStepIndex, 'in-progress', sendingMessage);

            const chunkMarkdown = await generateMarkdownStream(chunkParts, settings, 'pdf', () => {
                const receivingMessage = chunks.length > 1
                    ? `Receiving chunk ${i + 1}/${chunks.length}...`
                    : 'Receiving Markdown stream...';
                updateStep(generatingStepIndex, 'in-progress', receivingMessage);
            }, apiKey, chunkContext, handleStatusUpdate);

            fullMarkdown += (fullMarkdown ? '\n\n' : '') + chunkMarkdown.trim();
        }

        updateStep(generatingStepIndex, 'completed');
    } catch (error) {
        const errorMessage = getFriendlyErrorMessage(error);
        updateStep(generatingStepIndex, 'error', errorMessage);
        setProgress(prev => ({...prev, overallStatus: 'error'}));
        throw error;
    }

    // Step 4: Assembling files
    const assemblingStepIndex = 4;
    updateStep(assemblingStepIndex, 'in-progress');

    const replaceImageTokens = (
        markdown: string,
        createTag: (image: ExtractedImage, index: number, altText?: string) => string,
    ): string => {
        const replaceWithAlt = (match: string, alt: string, nStr: string) => {
            const index = parseInt(nStr, 10) - 1;
            if (index >= 0 && index < allExtractedImages.length) {
                const altText = alt?.trim() || `Extracted Image ${index + 1}`;
                return createTag(allExtractedImages[index], index, altText);
            }
            return match;
        };

        const replaceWithoutAlt = (match: string, nStr: string) => {
            const index = parseInt(nStr, 10) - 1;
            if (index >= 0 && index < allExtractedImages.length) {
                return createTag(allExtractedImages[index], index);
            }
            return match;
        };

        return markdown
            .replace(/!\[([^\]]*?)\]\[IMAGE_(\d+)\]/g, replaceWithAlt)
            .replace(/\[IMAGE_(\d+)\]/g, replaceWithoutAlt);
    };

    // Version 1: Standalone Markdown with embedded images
    const standaloneMdContent = replaceImageTokens(fullMarkdown, (img, index, altText) => {
        const safeAlt = altText || `Extracted Image ${index + 1}`;
        return `![${safeAlt}](data:image/${img.format};base64,${img.b64})`;
    });

    // Version 2: Create zip archive
    const zip = new JSZip();
    const assets = zip.folder("assets");
    if (!assets) throw new Error("Could not create zip folder.");
    const addedToZip = new Set<number>();

    const markdownForZip = replaceImageTokens(fullMarkdown, (img, index, altText) => {
        const imageName = `${baseFileName}_image_${index + 1}.${img.format}`;
        if (!addedToZip.has(index)) {
            assets.file(imageName, img.b64, { base64: true });
            addedToZip.add(index);
        }
        const safeAlt = altText || `Extracted Image ${index + 1}`;
        return `![${safeAlt}](./assets/${encodeURIComponent(imageName)})`;
    });
    zip.file(`${baseFileName}.md`, markdownForZip);
    const zipBlob = await zip.generateAsync({ type: "blob" });
    
    updateStep(assemblingStepIndex, 'completed');
    setProgress(prev => ({ ...prev, overallStatus: 'completed' }));
    return {
        markdownForPreview: standaloneMdContent,
        standaloneMdContent: standaloneMdContent,
        zipBlob: zipBlob,
        baseFileName: baseFileName,
    };
};

const processHtml = async (
    file: File,
    settings: ConversionSettings,
    setProgress: Dispatch<SetStateAction<ProgressState>>,
    apiKey: string,
    modelTokenLimit?: number
): Promise<ConversionResult> => {
     const steps: ProgressStep[] = [
        { name: `Reading file: ${file.name}`, status: 'pending' },
        { name: 'Converting text content', status: 'pending' },
        { name: 'Assembling final file', status: 'pending' },
    ];
     const updateStep = (index: number, status: 'in-progress' | 'completed' | 'error', details?: string) => {
        setProgress(prev => {
            const newSteps = prev.steps.map((s, i) => i === index ? { ...s, status, details: details || s.details } : s);
            return { ...prev, steps: newSteps, currentStep: index };
        });
    };
    setProgress({ steps, currentStep: 0, overallStatus: 'running' });

    // Step 0: Reading
    updateStep(0, 'in-progress');
    const htmlText = await fileToText(file);
    const baseFileName = file.name.replace(/\.[^/.]+$/, "");
    updateStep(0, 'completed');

    // Step 1: Conversion
    updateStep(1, 'in-progress');
    let markdown = "";
    try {
        const textParts = splitTextIntoParts(htmlText);
        const { chunks: estimatedChunks, chunkTokenLimit } = chunkContentParts(textParts, modelTokenLimit);

        if (!estimatedChunks.length) {
            throw new Error('No HTML content was provided.');
        }

        updateStep(1, 'in-progress', 'Requesting exact token counts from Gemini...');

        const { chunks, tokenCounts, totalTokens } = await ensureChunksWithinTokenLimit(
            estimatedChunks,
            settings,
            'html',
            apiKey,
            chunkTokenLimit
        );

        const chunkCountLabel = chunks.length === 1
            ? 'Prepared 1 chunk after verification.'
            : `Prepared ${chunks.length} chunks after verification.`;
        const tokenSummaryLabel = `Gemini counted ${totalTokens.toLocaleString()} tokens total (limit ${chunkTokenLimit.toLocaleString()} per chunk).`;
        const chunkEstimatesPreview = tokenCounts
            .slice(0, 4)
            .map((tokens, index) => `Chunk ${index + 1}: ${tokens.toLocaleString()} tokens`)
            .join(' | ');
        const chunkEstimateSuffix = tokenCounts.length > 4
            ? ` | +${tokenCounts.length - 4} more chunk(s)`
            : '';
        const chunkSummaryMessage = [chunkCountLabel, tokenSummaryLabel, chunkEstimatesPreview + chunkEstimateSuffix]
            .filter(Boolean)
            .join(' ');
        updateStep(1, 'in-progress', chunkSummaryMessage.trim());

        const handleStatusUpdate = (message: string) => {
            updateStep(1, 'in-progress', message);
        };

        for (let i = 0; i < chunks.length; i++) {
            const chunkContext = chunks.length > 1 ? { index: i, total: chunks.length } : undefined;
            const verifiedChunkTokens = tokenCounts[i];
            const sendingMessageBase = chunks.length > 1
                ? `Sending chunk ${i + 1}/${chunks.length}`
                : 'Sending text to Gemini';
            const sendingMessage = verifiedChunkTokens
                ? `${sendingMessageBase} (${verifiedChunkTokens.toLocaleString()} tokens)...`
                : `${sendingMessageBase}...`;
            updateStep(1, 'in-progress', sendingMessage);

            const chunkMarkdown = await generateMarkdownStream(chunks[i], settings, 'html', () => {
                const receivingMessage = chunks.length > 1
                    ? `Receiving chunk ${i + 1}/${chunks.length}...`
                    : `Streaming text...`;
                updateStep(1, 'in-progress', receivingMessage);
            }, apiKey, chunkContext, handleStatusUpdate);

            markdown += (markdown ? '\n\n' : '') + chunkMarkdown.trim();
        }

        updateStep(1, 'completed');
    } catch (error) {
         const errorMessage = getFriendlyErrorMessage(error);
         updateStep(1, 'error', errorMessage);
         setProgress(prev => ({...prev, overallStatus: 'error'}));
         throw error;
    }
    
    // Step 2: Assembling
    updateStep(2, 'in-progress');
    const finalMarkdown = markdown;
    updateStep(2, 'completed');
    setProgress(prev => ({ ...prev, overallStatus: 'completed' }));

    return {
        markdownForPreview: finalMarkdown,
        standaloneMdContent: finalMarkdown,
        zipBlob: null,
        baseFileName: baseFileName,
    };
};
