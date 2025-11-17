import { GoogleGenAI } from "@google/genai";
import { ConversionSettings, AvailableModel, GeminiContentPart } from '../types';
import { buildGeminiPrompt } from './promptBuilder';

const MAX_RATE_LIMIT_RETRIES = 3;
const DEFAULT_RATE_LIMIT_DELAY_MS = 20_000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const parseRetryDelayMs = (retryDelay: unknown): number | undefined => {
    if (!retryDelay) {
        return undefined;
    }

    if (typeof retryDelay === 'string') {
        const numeric = parseFloat(retryDelay.replace(/s$/i, ''));
        return Number.isFinite(numeric) ? Math.max(0, numeric * 1000) : undefined;
    }

    if (typeof retryDelay === 'object') {
        const maybeSeconds = (retryDelay as Record<string, unknown>).seconds;
        const maybeNanos = (retryDelay as Record<string, unknown>).nanos;
        if (typeof maybeSeconds === 'number') {
            return Math.max(0, maybeSeconds * 1000);
        }
        if (typeof maybeNanos === 'number') {
            return Math.max(0, maybeNanos / 1_000_000);
        }
    }

    return undefined;
};

const extractPayloadFromError = (error: unknown): any | null => {
    if (error && typeof error === 'object') {
        if ('error' in error) {
            return (error as Record<string, unknown>).error;
        }
        if ('response' in error && (error as any).response?.data) {
            return (error as any).response.data?.error || null;
        }
    }

    if (error instanceof Error) {
        try {
            const parsed = JSON.parse(error.message);
            if (parsed?.error) {
                return parsed.error;
            }
        } catch (e) {
            // Ignore JSON parsing errors
        }
    }

    return null;
};

const parseQuotaError = (error: unknown): { isQuota: boolean; retryDelayMs?: number } => {
    const payload = extractPayloadFromError(error);
    const status = (error as any)?.status || payload?.status;
    const code = (error as any)?.code || payload?.code;
    const message = (error instanceof Error ? error.message : payload?.message) || '';

    const isQuota = status === 'RESOURCE_EXHAUSTED'
        || code === 429
        || /quota/i.test(message)
        || /RESOURCE_EXHAUSTED/.test(message);

    if (!isQuota) {
        return { isQuota: false };
    }

    let retryDelayMs: number | undefined;

    const details = payload?.details;
    if (Array.isArray(details)) {
        for (const detail of details) {
            if (detail && typeof detail === 'object' && detail['@type']?.toString().includes('RetryInfo')) {
                retryDelayMs = parseRetryDelayMs((detail as any).retryDelay);
                break;
            }
        }
    }

    if (!retryDelayMs) {
        const retryMatch = message.match(/retry in\s+([0-9.]+)s/i);
        if (retryMatch) {
            retryDelayMs = parseRetryDelayMs(retryMatch[1] + 's');
        }
    }

    return { isQuota: true, retryDelayMs };
};

export const getAvailableModels = async (apiKey: string): Promise<AvailableModel[]> => {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models`, {
            headers: {
                'x-goog-api-key': apiKey,
            }
        });

        if (!response.ok) {
            const errorBody = await response.json();
            const message = errorBody?.error?.message || `HTTP error! status: ${response.status}`;
            throw new Error(message);
        }

        const data = await response.json();
        const models = data.models || [];
        
        return models
            .filter((model: any) => 
                model.supportedGenerationMethods.includes('generateContent') &&
                !model.name.includes('embedding') &&
                !model.name.includes('image') &&
                !model.name.includes('aqa') &&
                !model.name.includes('tts')
            )
            .map((model: any) => ({
                name: model.name.replace('models/', ''),
                displayName: model.displayName,
                inputTokenLimit: model.inputTokenLimit,
            }))
            .sort((a: AvailableModel, b: AvailableModel) => a.displayName.localeCompare(b.displayName));

    } catch (error) {
        console.error("Error fetching available models:", error);
        throw error;
    }
};

interface ChunkContext {
    index: number;
    total: number;
}

export const generateMarkdownStream = async (
    parts: GeminiContentPart[],
    settings: ConversionSettings,
    fileType: 'pdf' | 'html',
    onStream: (chunk: string) => void,
    apiKey: string,
    chunkContext?: ChunkContext,
    onStatusUpdate?: (status: string) => void
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = buildGeminiPrompt(settings, fileType, chunkContext);

    let attempt = 0;
    while (true) {
        try {
            const result = await ai.models.generateContentStream({
                model: settings.model,
                contents: { parts: parts },
                config: {
                    systemInstruction: systemPrompt
                }
            });

            let fullText = "";
            for await (const chunk of result) {
                const chunkText = chunk.text;
                if (chunkText) {
                    fullText += chunkText;
                    onStream(chunkText);
                }
            }
            return fullText;
        } catch (error) {
            const { isQuota, retryDelayMs } = parseQuotaError(error);
            if (isQuota && attempt < MAX_RATE_LIMIT_RETRIES) {
                attempt += 1;
                const waitMs = retryDelayMs ?? DEFAULT_RATE_LIMIT_DELAY_MS;
                const waitSeconds = Math.max(1, Math.round(waitMs / 1000));
                onStatusUpdate?.(`Gemini rate limit hit. Waiting ${waitSeconds}s before retry ${attempt}/${MAX_RATE_LIMIT_RETRIES}...`);
                await sleep(waitMs);
                continue;
            }
            throw error;
        }
    }
};

export const countTokensForParts = async (
    parts: GeminiContentPart[],
    settings: ConversionSettings,
    fileType: 'pdf' | 'html',
    apiKey: string,
    chunkContext?: ChunkContext
): Promise<number> => {
    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = buildGeminiPrompt(settings, fileType, chunkContext);
    const response = await ai.models.countTokens({
        model: settings.model,
        contents: { parts },
        config: {
            systemInstruction: systemPrompt,
        },
    });

    if (typeof response.totalTokens === 'number' && Number.isFinite(response.totalTokens)) {
        return response.totalTokens;
    }

    throw new Error('Gemini did not return a token count. Please try again in a moment.');
};

export const generateImageDescription = async (
    base64Image: string,
    apiKey: string,
    model: string = 'gemini-2.5-pro'
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = "Provide concise alt-text for this image, suitable for a technical document. Be descriptive but brief.";
    const imagePart = {
      inlineData: {
        mimeType: 'image/png',
        data: base64Image,
      },
    };
    
    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [ {text: prompt}, imagePart ]}
    });

    return response.text.trim();
};