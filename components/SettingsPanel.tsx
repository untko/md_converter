
import React from 'react';
import { ConversionSettings, ImageHandling, CitationStyle, StartHeader, AvailableModel } from '../types';

interface SettingsPanelProps {
    settings: ConversionSettings;
    setSettings: (settings: ConversionSettings) => void;
    onConvert: () => void;
    isFileSelected: boolean;
    fileType?: string;
    availableModels: AvailableModel[];
    modelsLoading: boolean;
    modelsError: string | null;
}

const AdvancedImageSettings: React.FC<{ settings: ConversionSettings, setSettings: (key: keyof ConversionSettings, value: any) => void }> = ({ settings, setSettings }) => {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <div className="bg-white/5 rounded-md p-1">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full text-left font-medium text-gray-300 mb-2 flex justify-between items-center p-2">
                <span>Advanced Image Settings</span>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
            {isOpen && (
                <div className="space-y-4 p-2">
                    {/* Image Format */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Image Format</label>
                        <div className="flex space-x-4">
                            {['webp', 'png', 'jpeg'].map(format => (
                                 <label key={format} className="flex items-center space-x-2 cursor-pointer">
                                    <input type="radio" name="imageFormat" value={format} checked={settings.imageFormat === format} onChange={() => setSettings('imageFormat', format)} className="form-radio text-purple-500 bg-gray-700 border-gray-600"/>
                                    <span>{format.toUpperCase()}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    {/* Image Quality */}
                    {(settings.imageFormat === 'jpeg' || settings.imageFormat === 'webp') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Image Quality: {settings.imageQuality}%</label>
                            <input
                                type="range" min="1" max="100" value={settings.imageQuality}
                                onChange={(e) => setSettings('imageQuality', parseInt(e.target.value, 10))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    )}
                     {/* Min Image Dimension */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Min Image Dimension (px)</label>
                         <input
                            type="number" value={settings.minImageDimension}
                            onChange={(e) => setSettings('minImageDimension', parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-white/10 border border-white/20 rounded-md p-2 text-sm"
                         />
                         <p className="text-xs text-gray-500 mt-1">Images smaller than this in width OR height will be ignored.</p>
                    </div>
                     {/* Max Image Dimension */}
                    <div>
                         <label className="block text-sm font-medium text-gray-400 mb-1">Max Image Dimension (px)</label>
                         <input
                            type="number" value={settings.maxImageDimension}
                            onChange={(e) => setSettings('maxImageDimension', parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-white/10 border border-white/20 rounded-md p-2 text-sm"
                         />
                         <p className="text-xs text-gray-500 mt-1">Images larger than this will be resized.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

const formatTokens = (limit: number): string => {
    if (limit >= 1000000) return `${(limit / 1000000).toFixed(1).replace('.0', '')}M tokens`;
    if (limit >= 1000) return `${Math.round(limit / 1000)}k tokens`;
    return `${limit} tokens`;
};

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, setSettings, onConvert, isFileSelected, fileType, availableModels, modelsLoading, modelsError }) => {
    
    const isPdf = fileType === 'application/pdf';

    const handleSettingChange = <K extends keyof ConversionSettings>(key: K, value: ConversionSettings[K]) => {
        setSettings({ ...settings, [key]: value });
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-center">Conversion Settings</h3>
            
            <fieldset className="space-y-4">
                {/* Model Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">AI Model</label>
                    <select 
                        value={settings.model}
                        onChange={(e) => handleSettingChange('model', e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-md p-2 focus:ring-purple-500 focus:outline-none disabled:opacity-50"
                        disabled={modelsLoading || !!modelsError || availableModels.length === 0}
                    >
                        {modelsLoading && <option>Loading models...</option>}
                        {modelsError && <option>{modelsError}</option>}
                        {!modelsLoading && !modelsError && availableModels.length === 0 && <option>No models available</option>}
                        {!modelsLoading && !modelsError && availableModels.map(model => (
                            <option key={model.name} value={model.name}>
                                {`${model.displayName} (${formatTokens(model.inputTokenLimit)})`}
                            </option>
                        ))}
                    </select>
                </div>
                
                {/* Image Handling */}
                {isPdf ? (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">PDF Image Strategy</label>
                        <div className="space-y-3">
                            <label className="flex items-start space-x-3 cursor-pointer bg-white/5 p-3 rounded-md">
                                <input
                                    type="radio"
                                    name="pdfImageMode"
                                    value="inline"
                                    checked={settings.pdfImageMode === 'inline'}
                                    onChange={() => handleSettingChange('pdfImageMode', 'inline')}
                                    className="mt-1 form-radio text-purple-500 bg-gray-700 border-gray-600"
                                />
                                <span>
                                    <span className="block font-medium">Upload processed images</span>
                                    <span className="text-xs text-gray-400">Sends grouped images to Gemini so it can place placeholders automatically. Use when you need the model to see every figure.</span>
                                </span>
                            </label>
                            <label className="flex items-start space-x-3 cursor-pointer bg-white/5 p-3 rounded-md">
                                <input
                                    type="radio"
                                    name="pdfImageMode"
                                    value="alt-text"
                                    checked={settings.pdfImageMode === 'alt-text'}
                                    onChange={() => handleSettingChange('pdfImageMode', 'alt-text')}
                                    className="mt-1 form-radio text-purple-500 bg-gray-700 border-gray-600"
                                />
                                <span>
                                    <span className="block font-medium">Text-only (Gemini alt text)</span>
                                    <span className="text-xs text-gray-400">Only PDF text is sent to Gemini. The processor inserts `[IMAGE_N]` markers and Gemini supplies descriptive alt text without uploading image binaries.</span>
                                </span>
                            </label>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                            Both modes still embed the extracted images in the downloaded Markdown/ZIP. Text-only mode simply avoids the inline image payload so long PDFs stay under the model limit.
                        </p>
                    </div>
                ) : (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Image Handling</label>
                        <div className="flex space-x-4">
                            {['ignore', 'describe', 'preserve-links'].map((opt) => {
                                const option = opt as ImageHandling;
                                const disabled = option === 'preserve-links' && isPdf;
                                return (
                                   <label key={option} className={`flex items-center space-x-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                        <input
                                            type="radio" name="imageHandling" value={option} checked={settings.imageHandling === option}
                                            onChange={() => !disabled && handleSettingChange('imageHandling', option)}
                                            disabled={disabled} className="form-radio text-purple-500 bg-gray-700 border-gray-600"
                                        />
                                        <span>{option.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} {option === 'preserve-links' ? '(HTML only)' : ''}</span>
                                    </label>
                                )
                            })}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                            HTML files can ignore images, ask Gemini to describe them, or preserve the original links in Markdown.
                        </p>
                    </div>
                )}
            </fieldset>

            <fieldset className="border-t border-white/10 pt-6 space-y-4">
                 <legend className="text-base font-semibold -translate-y-4 bg-gray-900/40 px-2">Formatting</legend>
                 {/* Citation Style */}
                <div>
                     <label className="block text-sm font-medium text-gray-300 mb-2">Citation Style</label>
                     <select 
                        value={settings.citationStyle}
                        onChange={(e) => handleSettingChange('citationStyle', e.target.value as CitationStyle)}
                        className="w-full bg-white/10 border border-white/20 rounded-md p-2"
                    >
                         <option value="none">None</option>
                         <option value="chicago">Chicago</option>
                         <option value="apa">APA</option>
                         <option value="mla">MLA</option>
                     </select>
                 </div>
                 
                 {/* Starting Header */}
                 <div>
                     <label className="block text-sm font-medium text-gray-300 mb-2">Starting Header</label>
                     <select 
                        value={settings.startHeader}
                        onChange={(e) => handleSettingChange('startHeader', e.target.value as StartHeader)}
                        className="w-full bg-white/10 border border-white/20 rounded-md p-2"
                    >
                         <option value="h1">H1 (#)</option>
                         <option value="h2">H2 (##)</option>
                         <option value="h3">H3 (###)</option>
                     </select>
                 </div>
             </fieldset>
             
            {isPdf && (
                 <fieldset className="border-t border-white/10 pt-4">
                    <AdvancedImageSettings settings={settings} setSettings={handleSettingChange} />
                </fieldset>
            )}

            <button
                onClick={onConvert}
                disabled={!isFileSelected}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg text-lg mt-6"
            >
                Convert
            </button>
        </div>
    );
};

export default SettingsPanel;
