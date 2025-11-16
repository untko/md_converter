import { GeminiContentPart } from '../types';

const DEFAULT_MODEL_TOKEN_LIMIT = 120_000;
const SAFETY_MARGIN = 0.9;
const PROMPT_BUFFER_TOKENS = 2_000;
const MIN_CHUNK_TOKEN_LIMIT = 8_000;
const CHAR_PER_TOKEN_ESTIMATE = 4;
const TEXT_PART_CHAR_LIMIT = 12_000;
const BASE64_TO_BYTES_RATIO = 3 / 4;
const DEFAULT_BINARY_BYTE_LIMIT = 3 * 1024 * 1024; // 3MB per request keeps inlineData manageable
const MIN_BINARY_BYTE_LIMIT = 512 * 1024;

const getChunkTokenLimit = (modelTokenLimit?: number): number => {
    const rawLimit = modelTokenLimit && Number.isFinite(modelTokenLimit)
        ? modelTokenLimit
        : DEFAULT_MODEL_TOKEN_LIMIT;
    const adjusted = Math.floor(rawLimit * SAFETY_MARGIN) - PROMPT_BUFFER_TOKENS;
    return Math.max(adjusted, MIN_CHUNK_TOKEN_LIMIT);
};

const getBinaryByteLimit = (): number => {
    return Math.max(DEFAULT_BINARY_BYTE_LIMIT * SAFETY_MARGIN, MIN_BINARY_BYTE_LIMIT);
};

const estimateTokensForPart = (part: GeminiContentPart): number => {
    if (part.text) {
        return Math.max(1, Math.ceil(part.text.length / CHAR_PER_TOKEN_ESTIMATE));
    }
    if (part.inlineData?.data) {
        return Math.max(1, Math.ceil(part.inlineData.data.length / CHAR_PER_TOKEN_ESTIMATE));
    }
    return 0;
};

const estimateBytesForPart = (part: GeminiContentPart): number => {
    if (part.inlineData?.data) {
        return Math.ceil(part.inlineData.data.length * BASE64_TO_BYTES_RATIO);
    }
    return 0;
};

const splitTextChunk = (text: string): string[] => {
    const normalized = text.replace(/\r\n/g, '\n');
    const chunks: string[] = [];
    let start = 0;

    while (start < normalized.length) {
        const remainingLength = normalized.length - start;
        if (remainingLength <= TEXT_PART_CHAR_LIMIT) {
            chunks.push(normalized.slice(start));
            break;
        }

        const tentativeEnd = start + TEXT_PART_CHAR_LIMIT;
        let splitIndex = normalized.lastIndexOf('\n\n', tentativeEnd);
        if (splitIndex <= start) {
            splitIndex = normalized.indexOf('\n\n', tentativeEnd);
        }
        if (splitIndex <= start) {
            splitIndex = tentativeEnd;
        }

        chunks.push(normalized.slice(start, splitIndex));
        start = splitIndex;
    }

    return chunks.filter(chunk => chunk.trim().length > 0);
};

export const splitTextIntoParts = (text: string): GeminiContentPart[] => {
    if (!text.trim()) {
        return [];
    }
    return splitTextChunk(text).map(chunk => ({ text: chunk }));
};

interface ChunkContentResult {
    chunks: GeminiContentPart[][];
    estimatedTokens: number;
    chunkTokenLimit: number;
    binaryByteLimit: number;
    chunkTokenEstimates: number[];
}

export const chunkContentParts = (
    parts: GeminiContentPart[],
    modelTokenLimit?: number
): ChunkContentResult => {
    const chunkTokenLimit = getChunkTokenLimit(modelTokenLimit);
    const binaryByteLimit = getBinaryByteLimit();
    const chunks: GeminiContentPart[][] = [];
    const chunkTokenEstimates: number[] = [];
    let currentChunk: GeminiContentPart[] = [];
    let currentTokens = 0;
    let currentBytes = 0;
    let estimatedTokens = 0;

    const flushChunk = () => {
        if (currentChunk.length) {
            chunks.push(currentChunk);
            chunkTokenEstimates.push(currentTokens);
            currentChunk = [];
            currentTokens = 0;
            currentBytes = 0;
        }
    };

    parts.forEach(part => {
        const partTokens = estimateTokensForPart(part);
        const partBytes = estimateBytesForPart(part);
        estimatedTokens += partTokens;

        if (part.inlineData && partBytes > binaryByteLimit) {
            throw new Error(
                'One of the extracted images is too large for the selected model. Try lowering the max image dimension or quality.'
            );
        }

        const wouldExceedTokens = currentTokens + partTokens > chunkTokenLimit;
        const wouldExceedBytes = currentBytes + partBytes > binaryByteLimit;

        if ((wouldExceedTokens || wouldExceedBytes) && currentChunk.length) {
            flushChunk();
        }

        currentChunk.push(part);
        currentTokens += partTokens;
        currentBytes += partBytes;
    });

    flushChunk();

    return {
        chunks: chunks.length ? chunks : (parts.length ? [parts] : []),
        estimatedTokens,
        chunkTokenLimit,
        binaryByteLimit,
        chunkTokenEstimates: chunkTokenEstimates.length ? chunkTokenEstimates : (parts.length ? [estimatedTokens] : []),
    };
};
