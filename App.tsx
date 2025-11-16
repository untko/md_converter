
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Dropzone from './components/Dropzone';
import SettingsPanel from './components/SettingsPanel';
import ProgressModal from './components/ProgressModal';
import ResultsView from './components/ResultsView';
import ApiKeyModal from './components/ApiKeyModal';
import Toast from './components/Toast';
import useLocalStorage from './hooks/useLocalStorage';
import { processFile } from './services/fileProcessor';
import { getAvailableModels } from './services/geminiService';
import { ConversionSettings, ConversionResult, ProgressState, ViewState, ImageHandling, AvailableModel } from './types';

const defaultSettings: ConversionSettings = {
    model: 'gemini-2.5-flash',
    imageHandling: 'ignore',
    citationStyle: 'none',
    startHeader: 'h2',
    imageFormat: 'webp',
    imageQuality: 92,
    minImageDimension: 50,
    maxImageDimension: 1024,
};

const App: React.FC = () => {
    const [settings, setSettings] = useLocalStorage<ConversionSettings>('conversion-settings', defaultSettings);
    const [file, setFile] = useState<File | null>(null);
    const [viewState, setViewState] = useState<ViewState>('main');
    const [progress, setProgress] = useState<ProgressState>({
        steps: [],
        currentStep: 0,
        overallStatus: 'idle',
    });
    const [result, setResult] = useState<ConversionResult | null>(null);
    const [apiKey, setApiKey] = useLocalStorage<string | null>('gemini-api-key', null);
    const [showApiKeyModal, setShowApiKeyModal] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
    const [modelsLoading, setModelsLoading] = useState(true);
    const [modelsError, setModelsError] = useState<string | null>(null);

    // Effect to check for API key on mount
    useEffect(() => {
        if (!apiKey) {
            setShowApiKeyModal(true);
        }
    }, [apiKey]);

    // Effect to fetch models when API key is available
    useEffect(() => {
        if (apiKey) {
            setModelsLoading(true);
            setModelsError(null);
            getAvailableModels(apiKey)
                .then(models => {
                    setAvailableModels(models);
                    
                    const currentModelIsValid = models.some(m => m.name === settings.model);
                    if (!currentModelIsValid && models.length > 0) {
                        const flashModel = models.find(m => m.name.includes('flash'));
                        setSettings(prev => ({ ...prev, model: flashModel ? flashModel.name : models[0].name }));
                    } else if (models.length === 0) {
                        setModelsError("No compatible text models found.");
                    }
                })
                .catch(err => {
                    console.error("Failed to fetch available models:", err);
                    setModelsError(`Could not fetch models: ${err instanceof Error ? err.message : 'Unknown error'}`);
                })
                .finally(() => {
                    setModelsLoading(false);
                });
        } else {
            setAvailableModels([]);
            setModelsLoading(false);
        }
    }, [apiKey, setSettings]);


    // Effect to automatically adjust settings based on file type.
    useEffect(() => {
        if (file) {
            const isPdf = file.type === 'application/pdf';
            let newImageHandling: ImageHandling = settings.imageHandling;
            
            if (isPdf) {
                newImageHandling = 'ignore'; // The processor handles PDF images separately.
            } else if (settings.imageHandling === 'preserve-links' && !isPdf) {
                 //This is valid for HTML
            } else if (settings.imageHandling !== 'ignore' && settings.imageHandling !== 'describe') {
                 newImageHandling = 'ignore';
            }

            if (newImageHandling !== settings.imageHandling) {
                setSettings({
                    ...settings,
                    imageHandling: newImageHandling,
                });
            }
        }
    }, [file, settings, setSettings]);

    const handleSaveApiKey = (newKey: string) => {
        setApiKey(newKey);
        setShowApiKeyModal(false);
        setToast({ message: 'API Key saved successfully!', type: 'success' });
    };

    const handleConvert = useCallback(async () => {
        if (!file || !apiKey) {
            if (!apiKey) setShowApiKeyModal(true);
            return;
        }

        setViewState('processing');
        setProgress({ steps: [], currentStep: 0, overallStatus: 'running' });

        try {
            const conversionResult = await processFile(file, settings, setProgress, apiKey);
            setResult(conversionResult);
            setViewState('results');
        } catch (error) {
            console.error("Conversion failed:", error);
            // The ProgressModal will display the specific error details.
            // No need to set another state here, as the progress state already reflects the error.
        }
    }, [file, settings, apiKey]);

    const handleReset = () => {
        setFile(null);
        setResult(null);
        setProgress({ steps: [], currentStep: 0, overallStatus: 'idle' });
        setViewState('main');
    };
    
    return (
        <div className="min-h-screen flex flex-col antialiased">
            <Header onSwitchKey={() => setShowApiKeyModal(true)} />
            {showApiKeyModal && (
                <ApiKeyModal
                    currentApiKey={apiKey}
                    onSave={handleSaveApiKey}
                    onClose={() => setShowApiKeyModal(false)}
                />
            )}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col items-center justify-center">
                {viewState === 'main' && (
                    <div className="w-full max-w-6xl p-8 rounded-3xl border border-white/10 bg-gray-900/40 backdrop-blur-2xl shadow-2xl animate-fade-in-down">
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                            <div className="lg:col-span-2 h-full">
                                <Dropzone file={file} setFile={setFile} />
                            </div>
                            <div className="lg:col-span-3">
                                <SettingsPanel 
                                    settings={settings} 
                                    setSettings={setSettings} 
                                    onConvert={handleConvert}
                                    isFileSelected={!!file}
                                    fileType={file?.type}
                                    availableModels={availableModels}
                                    modelsLoading={modelsLoading}
                                    modelsError={modelsError}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {viewState === 'processing' && <ProgressModal progress={progress} onReset={handleReset} />}

                {viewState === 'results' && result && (
                    <ResultsView result={result} onStartNew={handleReset} />
                )}
            </main>
        </div>
    );
};

export default App;
