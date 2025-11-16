
/**
 * Simulates a backend call to validate a license key.
 * In a real application, this would be an HTTP request to your server.
 * 
 * @param key The license key entered by the user.
 * @returns A promise that resolves to an object indicating success and a message.
 */
export const validateLicenseKey = async (key: string): Promise<{ success: boolean; message: string }> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 750));

    const validKeys = ['test-key-123', 'key'];

    // Boilerplate validation logic. Replace with your actual backend validation.
    if (validKeys.includes(key.trim().toLowerCase())) {
        return {
            success: true,
            message: 'License activated successfully! The header will now be removed.',
        };
    }

    return {
        success: false,
        message: 'Invalid license key. Please check the key and try again.',
    };
};
