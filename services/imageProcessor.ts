
import { ConversionSettings, ExtractedImage } from '../types';

declare var pdfjsLib: any;

/**
 * Extracts and processes images from a single PDF page object.
 * This is called within a loop that iterates through pages in the main file processor.
 * 
 * @param page A pdf.js page object.
 * @param settings Conversion settings for filtering, resizing, and encoding.
 * @returns A promise that resolves to an array of extracted images for that page.
 */
export const extractAndProcessImagesFromPage = async (
    page: any, // pdf.js page object
    settings: ConversionSettings
): Promise<ExtractedImage[]> => {
    const extractedImages: ExtractedImage[] = [];
    const uniqueImageIdentifiers = new Set<string>();

    let operatorList;
    try {
        operatorList = await page.getOperatorList();
    } catch (opListError) {
        console.error(`[Image Extractor] Failed to get operator list for page ${page.pageNumber}:`, opListError);
        return []; // Return empty if this page is broken
    }
    
    for (let i = 0; i < operatorList.fnArray.length; i++) {
        if (operatorList.fnArray[i] !== pdfjsLib.OPS.paintImageXObject) {
            continue;
        }
        
        const imageName = operatorList.argsArray[i][0];
        const uniqueId = `p${page.pageNumber}-${imageName}`;

        if (uniqueImageIdentifiers.has(uniqueId)) {
            continue;
        }
        uniqueImageIdentifiers.add(uniqueId);
        
        try {
            const image = await new Promise<any>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`Timeout after 5s getting image object "${imageName}"`));
                }, 5000);

                page.objs.get(imageName, (imgData: any) => {
                    clearTimeout(timeout);
                    resolve(imgData);
                });
            });

            if (!image || !image.data) {
                console.warn(`[Image Extractor] No data for image object: ${imageName} on page ${page.pageNumber}`);
                continue;
            }

            const { width, height, data } = image;
             if (settings.minImageDimension > 0 && (width < settings.minImageDimension || height < settings.minImageDimension)) {
                continue;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                console.error(`[Image Extractor] Could not get canvas context for image ${imageName}.`);
                continue;
            }
            
            const imageData = ctx.createImageData(width, height);
            const numPixels = width * height;

            if (data.length === numPixels * 4) { // RGBA
                imageData.data.set(data);
            } else if (data.length === numPixels * 3) { // RGB
                for (let k = 0, l = 0; k < data.length; k += 3, l += 4) {
                    imageData.data[l] = data[k];
                    imageData.data[l + 1] = data[k + 1];
                    imageData.data[l + 2] = data[k + 2];
                    imageData.data[l + 3] = 255;
                }
            } else if (data.length === numPixels) { // Grayscale
                for (let k = 0, l = 0; k < data.length; k++, l += 4) {
                    const val = data[k];
                    imageData.data[l] = val;
                    imageData.data[l + 1] = val;
                    imageData.data[l + 2] = val;
                    imageData.data[l + 3] = 255;
                }
            } else {
                console.warn(`[Image Extractor] Unhandled image format for ${imageName}. Size: ${width}x${height}, Data length: ${data.length}`);
                continue;
            }

            ctx.putImageData(imageData, 0, 0);

            let finalCanvas = canvas;
            if (settings.maxImageDimension > 0 && (width > settings.maxImageDimension || height > settings.maxImageDimension)) {
                const ratio = Math.min(settings.maxImageDimension / width, settings.maxImageDimension / height);
                const finalWidth = Math.round(width * ratio);
                const finalHeight = Math.round(height * ratio);
                
                finalCanvas = document.createElement('canvas');
                finalCanvas.width = finalWidth;
                finalCanvas.height = finalHeight;
                const finalCtx = finalCanvas.getContext('2d');
                if (finalCtx) {
                   finalCtx.drawImage(canvas, 0, 0, finalWidth, finalHeight);
                } else {
                   finalCanvas = canvas;
                }
            }
            
            const format = settings.imageFormat;
            const quality = settings.imageQuality / 100;
            const mimeType = `image/${format}`;
            const dataUrl = finalCanvas.toDataURL(mimeType, format !== 'png' ? quality : undefined);
            const b64 = dataUrl.split(',')[1];

            if (b64) {
                extractedImages.push({ b64, format });
            }
        } catch(e) {
            console.error(`[Image Extractor] Could not process image ${imageName} on page ${page.pageNumber}:`, e);
        }
    }
    
    return extractedImages;
};
