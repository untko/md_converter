
import React from 'react';

interface HeaderProps {
    onSwitchKey: () => void;
    onRemoveHeaderClick: () => void;
    isLicensed: boolean;
}

const Header: React.FC<HeaderProps> = ({ onSwitchKey, onRemoveHeaderClick, isLicensed }) => {
    return (
        <header className="w-full max-w-7xl mx-auto p-4 flex justify-between items-center text-white mb-4">
            <div className="flex-1 flex justify-start">
                {!isLicensed ? (
                    <button 
                        onClick={onRemoveHeaderClick}
                        className="text-sm bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-300 font-semibold py-2 px-4 rounded-lg transition border border-yellow-400/20"
                    >
                        Remove Header
                    </button>
                ) : (
                    <div className="text-sm bg-green-500/10 text-green-300 font-bold py-2 px-4 rounded-full border border-green-500/20">
                        Premium ✨
                    </div>
                )}
            </div>

            <h1 className="text-2xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 text-center">
                MD Converter
            </h1>
            
            <div className="flex-1 flex justify-end">
                <button 
                    onClick={onSwitchKey}
                    className="text-sm bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 rounded-lg transition border border-white/20"
                >
                    Switch API Key
                </button>
            </div>
        </header>
    );
};

export default Header;
