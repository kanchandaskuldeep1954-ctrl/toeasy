import html2canvas from 'html2canvas';

/**
 * Captures a DOM element as a PNG image and triggers download.
 * @param elementId - The ID of the element to capture
 * @param filename - The filename for the downloaded image (without extension)
 */
export async function captureElementAsPng(
    elementId: string,
    filename: string = 'chart-export'
): Promise<void> {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with ID "${elementId}" not found`);
        return;
    }

    try {
        const canvas = await html2canvas(element, {
            backgroundColor: null,
            scale: 2, // Higher resolution
            logging: false,
            useCORS: true,
        });

        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('Failed to capture element:', error);
        throw error;
    }
}

/**
 * Captures a React ref element as PNG
 */
export async function captureRefAsPng(
    ref: React.RefObject<HTMLElement>,
    filename: string = 'chart-export'
): Promise<void> {
    if (!ref.current) {
        console.error('Ref element not found');
        return;
    }

    try {
        const canvas = await html2canvas(ref.current, {
            backgroundColor: null,
            scale: 2,
            logging: false,
            useCORS: true,
        });

        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('Failed to capture element:', error);
        throw error;
    }
}

/**
 * Copies element as image to clipboard (where supported)
 */
export async function copyElementAsImage(elementId: string): Promise<boolean> {
    const element = document.getElementById(elementId);
    if (!element) return false;

    try {
        const canvas = await html2canvas(element, {
            backgroundColor: '#ffffff',
            scale: 2,
            logging: false,
            useCORS: true,
        });

        const blob = await new Promise<Blob>((resolve) =>
            canvas.toBlob((b) => resolve(b!), 'image/png')
        );

        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);

        return true;
    } catch (error) {
        console.error('Failed to copy image:', error);
        return false;
    }
}

export default captureElementAsPng;
