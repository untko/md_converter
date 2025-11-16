
import { ExtractedImage } from '../types';

const CONTACT_SHEET_IMAGE_SIZE = 256; // Size of each sub-image in the sheet
const CONTACT_SHEET_PADDING = 20;
const CONTACT_SHEET_FONT_SIZE = 16;
const IMAGES_PER_ROW = 2;

/**
 * Creates a single "contact sheet" image from a group of up to 4 images.
 * The sheet is a 2x2 grid with labels for each image.
 */
const createContactSheet = (
    imagesToGroup: { image: ExtractedImage; originalIndex: number }[]
): Promise<ExtractedImage> => {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not create canvas context.'));

        const numRows = Math.ceil(imagesToGroup.length / IMAGES_PER_ROW);
        const canvasWidth = IMAGES_PER_ROW * (CONTACT_SHEET_IMAGE_SIZE + CONTACT_SHEET_PADDING) + CONTACT_SHEET_PADDING;
        const canvasHeight = numRows * (CONTACT_SHEET_IMAGE_SIZE + CONTACT_SHEET_PADDING + CONTACT_SHEET_FONT_SIZE + 5) + CONTACT_SHEET_PADDING;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Fill background
        ctx.fillStyle = '#111827'; // a dark gray similar to the UI
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'white';
        ctx.font = `${CONTACT_SHEET_FONT_SIZE}px sans-serif`;
        ctx.textAlign = 'center';

        const imagePromises = imagesToGroup.map(({ image, originalIndex }) => {
            return new Promise<HTMLImageElement>((resolveImg, rejectImg) => {
                const img = new Image();
                img.onload = () => resolveImg(img);
                img.onerror = () => rejectImg(new Error('Failed to load image for contact sheet.'));
                img.src = `data:image/${image.format};base64,${image.b64}`;
            });
        });

        Promise.all(imagePromises).then(loadedImages => {
            loadedImages.forEach((img, i) => {
                const { originalIndex } = imagesToGroup[i];
                const row = Math.floor(i / IMAGES_PER_ROW);
                const col = i % IMAGES_PER_ROW;
                
                const x = CONTACT_SHEET_PADDING + col * (CONTACT_SHEET_IMAGE_SIZE + CONTACT_SHEET_PADDING);
                const y = CONTACT_SHEET_PADDING + row * (CONTACT_SHEET_IMAGE_SIZE + CONTACT_SHEET_PADDING + CONTACT_SHEET_FONT_SIZE + 5);

                // Draw image
                ctx.drawImage(img, x, y, CONTACT_SHEET_IMAGE_SIZE, CONTACT_SHEET_IMAGE_SIZE);
                
                // Draw label
                const label = `image_${originalIndex + 1}`;
                const textY = y + CONTACT_SHEET_IMAGE_SIZE + CONTACT_SHEET_FONT_SIZE;
                ctx.fillText(label, x + CONTACT_SHEET_IMAGE_SIZE / 2, textY);
            });
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            const b64 = dataUrl.split(',')[1];
            resolve({ b64, format: 'jpeg' });
        }).catch(reject);
    });
};

/**
 * Groups an array of images into "contact sheets" if there are 5 or more.
 * Each contact sheet contains up to 4 original images.
 */
export const groupImages = async (
    allImages: ExtractedImage[]
): Promise<ExtractedImage[]> => {
    if (allImages.length < 5) {
        return allImages; // Return original images if fewer than 5
    }

    const contactSheets: ExtractedImage[] = [];
    const imageChunks: { image: ExtractedImage; originalIndex: number }[][] = [];

    for (let i = 0; i < allImages.length; i += 4) {
        const chunk = allImages.slice(i, i + 4).map((image, index) => ({
            image,
            originalIndex: i + index
        }));
        imageChunks.push(chunk);
    }
    
    for (const chunk of imageChunks) {
        const sheet = await createContactSheet(chunk);
        contactSheets.push(sheet);
    }

    return contactSheets;
};
