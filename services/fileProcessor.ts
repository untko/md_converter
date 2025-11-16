
import type { Dispatch, SetStateAction } from 'react';
import { ConversionSettings, ProgressState, ConversionResult, ProgressStep, ExtractedImage, GeminiContentPart } from '../types';
import { generateMarkdownStream } from './geminiService';
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
    const steps: ProgressStep[] = [
        { name: `Reading file: ${file.name}`, status: 'pending' },
        { name: 'Extracting all text & images', status: 'pending' },
        { name: 'Grouping images for processing', status: 'pending' },
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
            allText += textContent.items.map((item: any) => item.str).join(' ') + '\n\n';
            
            const pageImages = await extractAndProcessImagesFromPage(page, settings);
            allExtractedImages.push(...pageImages);
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
    const apiImages = await groupImages(allExtractedImages);
    updateStep(2, 'completed', `Processed ${apiImages.length} final images for API.`);

    // Step 3: Generate Markdown
    const generatingStepIndex = 3;
    updateStep(generatingStepIndex, 'in-progress', 'Preparing content for Gemini...');
    let fullMarkdown = "";

    try {
        const textParts = splitTextIntoParts(allText);
        const parts: GeminiContentPart[] = [
            ...textParts,
            ...apiImages.map(img => ({ inlineData: { mimeType: `image/${img.format}`, data: img.b64 } }))
        ];

        const { chunks } = chunkContentParts(parts, modelTokenLimit);

        if (!chunks.length) {
            throw new Error('No content was extracted from the PDF.');
        }

        for (let i = 0; i < chunks.length; i++) {
            const chunkParts = chunks[i];
            const chunkContext = chunks.length > 1 ? { index: i, total: chunks.length } : undefined;
            const sendingMessage = chunks.length > 1
                ? `Sending chunk ${i + 1}/${chunks.length} to Gemini...`
                : 'Sending all content to Gemini...';
            updateStep(generatingStepIndex, 'in-progress', sendingMessage);

            const chunkMarkdown = await generateMarkdownStream(chunkParts, settings, 'pdf', () => {
                const receivingMessage = chunks.length > 1
                    ? `Receiving chunk ${i + 1}/${chunks.length}...`
                    : 'Receiving Markdown stream...';
                updateStep(generatingStepIndex, 'in-progress', receivingMessage);
            }, apiKey, chunkContext);

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

    // Version 1: Standalone Markdown with embedded images
    const standaloneMdContent = fullMarkdown.replace(/\[IMAGE_(\d+)\]/g, (_, nStr) => {
        const index = parseInt(nStr, 10) - 1;
        if (index >= 0 && index < allExtractedImages.length) {
            const img = allExtractedImages[index];
            return `![Extracted Image ${index + 1}](data:image/${img.format};base64,${img.b64})`;
        }
        return `[IMAGE_${nStr}]`;
    });

    // Version 2: Create zip archive
    const zip = new JSZip();
    const assets = zip.folder("assets");
    if (!assets) throw new Error("Could not create zip folder.");
    
    const markdownForZip = fullMarkdown.replace(/\[IMAGE_(\d+)\]/g, (_, nStr) => {
        const index = parseInt(nStr, 10) - 1;
        if (index >= 0 && index < allExtractedImages.length) {
            const img = allExtractedImages[index];
            const imageName = `${baseFileName}_image_${index + 1}.${img.format}`;
            assets.file(imageName, img.b64, { base64: true });
            return `![Extracted Image ${index + 1}](./assets/${encodeURIComponent(imageName)})`;
        }
        return `[IMAGE_${nStr}]`;
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
        const { chunks } = chunkContentParts(textParts, modelTokenLimit);

        if (!chunks.length) {
            throw new Error('No HTML content was provided.');
        }

        for (let i = 0; i < chunks.length; i++) {
            const chunkContext = chunks.length > 1 ? { index: i, total: chunks.length } : undefined;
            const sendingMessage = chunks.length > 1
                ? `Sending chunk ${i + 1}/${chunks.length}...`
                : 'Sending text to Gemini...';
            updateStep(1, 'in-progress', sendingMessage);

            const chunkMarkdown = await generateMarkdownStream(chunks[i], settings, 'html', () => {
                const receivingMessage = chunks.length > 1
                    ? `Receiving chunk ${i + 1}/${chunks.length}...`
                    : `Streaming text...`;
                updateStep(1, 'in-progress', receivingMessage);
            }, apiKey, chunkContext);

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
