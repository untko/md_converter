
import React, { useState } from 'react';

interface ApiKeyModalProps {
    currentApiKey: string | null;
    onSave: (apiKey: string) => void;
    onClose: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ currentApiKey, onSave, onClose }) => {
    const [key, setKey] = useState('');

    const handleSave = () => {
        if (key.trim()) {
            onSave(key.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="w-full max-w-md p-8 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl text-white">
                <h2 className="text-2xl font-bold mb-4 text-center">Set Your Gemini API Key</h2>
                <p className="text-sm text-gray-300 mb-6 text-center">
                    To begin, please enter your API key. It will be saved securely in your browser's local storage.
                </p>
                <input
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="Enter a new API key here"
                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 focus:ring-2 focus:ring-purple-500 focus:outline-none transition mb-4"
                />
                <div className="flex items-center gap-4 mt-4">
                    {currentApiKey && (
                         <button
                            onClick={onClose}
                            className="w-full bg-transparent border border-gray-500 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={!key.trim()}
                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg"
                    >
                        Save and Continue
                    </button>
                </div>
                <div className="text-center mt-4">
                    <a 
                        href="https://ai.google.dev/gemini-api/docs/api-key"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-300 hover:underline"
                    >
                        How to get your Gemini API key
                    </a>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;
