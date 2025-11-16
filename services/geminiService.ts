import { GoogleGenAI } from "@google/genai";
import { ConversionSettings, AvailableModel } from '../types';

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

const buildSystemPrompt = (settings: ConversionSettings, fileType: 'pdf' | 'html'): string => {
    let prompt = `You are an expert file conversion assistant. Your task is to convert the provided file into a single, clean, and well-structured Markdown document.

Formatting Rules:
- Headers: The main title must be a ${settings.startHeader.replace('h', '#'.repeat(parseInt(settings.startHeader.slice(1))))} (${settings.startHeader}). All subsequent headers must follow a logical hierarchy. Do not use more than 3 tiers of headers (e.g., ###).
- LaTeX: All mathematical expressions, equations, and formulas MUST be formatted using LaTeX syntax. Use $inline$ for inline equations and $$display$$ for block-level equations.
- Content: Preserve all body text, lists, and tables. Convert HTML tables to Markdown tables.

Referencing Rules:
- Links: Preserve all 'ahref' hyperlinks, converting them to standard Markdown links [link text](url).
- Citations: ${settings.citationStyle !== 'none' ? `If you identify in-text citations (e.g., [Author, 2023]), format them using ${settings.citationStyle.toUpperCase()} style.` : 'Preserve in-text citations as they appear.'}
- Bibliography: If a bibliography or "References" section is present, format it as a standard Markdown bulleted list.

Image Handling Rules:
`;

    if (fileType === 'pdf') {
        prompt += `- You will be given the entire text content from a PDF document, followed by a series of images.
- If there are many images, they may be grouped into "contact sheets" which contain multiple, smaller, labeled sub-images (e.g., "image_1", "image_2").
- Your task is to convert the text content into a single, continuous Markdown stream.
- When you encounter a place in the text where an image logically belongs, you MUST insert a placeholder based on its ORIGINAL number.
- The placeholder format is \`[IMAGE_N]\`, where 'N' corresponds to the label on the contact sheet (e.g., for "image_1", use \`[IMAGE_1]\`).
- Even if images are grouped onto contact sheets, refer to them by their individual number. For example, if you are given a contact sheet with image_1, image_2, and image_3, you must use \`[IMAGE_1]\`, \`[IMAGE_2]\`, etc., in the text.
- Transcribe the text accurately and place the image placeholders where they belong. Do not describe the images.`;
    } else { // HTML
        if (settings.imageHandling === 'preserve-links') {
            prompt += `- If you find an <img> tag with a src URL, preserve it as a Markdown image link: ![alt text](url).`;
        } else if (settings.imageHandling === 'describe') {
            prompt += `- For every <img> tag encountered, generate a detailed description and caption. Format it as: [Image: detailed description]\\n*Caption: [generated caption]*`;
        } else {
            prompt += `- Ignore all <img> tags and do not include them in the output.`;
        }
    }
    
    prompt += `\n\nBegin conversion.`;
    return prompt;
};

export const generateMarkdownStream = async (
    parts: any[],
    settings: ConversionSettings,
    fileType: 'pdf' | 'html',
    onStream: (chunk: string) => void,
    apiKey: string
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });
    
    const systemPrompt = buildSystemPrompt(settings, fileType);
    
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