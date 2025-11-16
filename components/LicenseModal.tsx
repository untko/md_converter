
import React, { useState } from 'react';

interface LicenseModalProps {
    onActivate: (key: string) => Promise<boolean>;
    onClose: () => void;
}

const LicenseModal: React.FC<LicenseModalProps> = ({ onActivate, onClose }) => {
    const [key, setKey] = useState('');
    const [isActivating, setIsActivating] = useState(false);

    const handleActivate = async () => {
        if (!key.trim() || isActivating) return;
        setIsActivating(true);
        await onActivate(key.trim());
        setIsActivating(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="w-full max-w-md p-8 rounded-2xl border border-white/20 bg-gray-900/80 backdrop-blur-xl shadow-2xl text-white">
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold">Activate Premium</h2>
                     <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p className="text-sm text-gray-300 mb-6">
                    Activate your license to permanently remove the "Buy me a coffee" header from all converted documents.
                </p>
                <div className="space-y-4">
                    <a 
                        href="https://www.buymeacoffee.com/your-username" // Placeholder
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full text-center block bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-4 rounded-lg transition"
                    >
                        Get License Key
                    </a>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="Enter License Key"
                            className="flex-grow w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
                        />
                        <button
                            onClick={handleActivate}
                            disabled={!key.trim() || isActivating}
                            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-all"
                        >
                            {isActivating ? '...' : 'Activate'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LicenseModal;
