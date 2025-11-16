import { GoogleGenAI } from "@google/genai";
import { ConversionSettings, AvailableModel } from '../types';
import { buildGeminiPrompt } from './promptBuilder';

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

export const generateMarkdownStream = async (
    parts: any[],
    settings: ConversionSettings,
    fileType: 'pdf' | 'html',
    onStream: (chunk: string) => void,
    apiKey: string
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });
    
    const systemPrompt = buildGeminiPrompt(settings, fileType);
    
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