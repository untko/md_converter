
export interface AvailableModel {
    name: string;
    displayName: string;
    inputTokenLimit: number;
}

export type ImageHandling = 'ignore' | 'describe' | 'preserve-links';
export type CitationStyle = 'none' | 'chicago' | 'apa' | 'mla';
export type StartHeader = 'h1' | 'h2' | 'h3';
export type ViewState = 'main' | 'processing' | 'results';
export type StepStatus = 'in-progress' | 'completed' | 'error' | 'pending';

export interface ConversionSettings {
    model: string;
    imageHandling: ImageHandling;
    citationStyle: CitationStyle;
    startHeader: StartHeader;
    // Advanced image settings
    imageFormat: 'png' | 'jpeg' | 'webp';
    imageQuality: number;
    minImageDimension: number;
    maxImageDimension: number;
}

export interface ProgressStep {
    name: string;
    status: StepStatus;
    details?: string;
}

export interface ProgressState {
    steps: ProgressStep[];
    currentStep: number;
    overallStatus: 'idle' | 'running' | 'error';
}

export interface ConversionResult {
    markdownForPreview: string;
    standaloneMdContent: string;
    zipBlob: Blob | null;
    baseFileName: string;
}

export interface ExtractedImage {
    b64: string;
    format: 'png' | 'jpeg' | 'webp';
}