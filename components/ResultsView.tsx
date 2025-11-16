
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ConversionResult } from '../types';

interface ResultsViewProps {
    result: ConversionResult;
    onStartNew: () => void;
}

const CopyIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75m9.75 0v-3.375c0-.621-.504-1.125-1.125-1.125h-9.75a1.125 1.125 0 00-1.125 1.125v13.5" />
    </svg>
);

const DownloadIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);

const StartNewIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
       <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
   </svg>
);


const ResultsView: React.FC<ResultsViewProps> = ({ result, onStartNew }) => {
    const [markdown, setMarkdown] = useState(result.markdownForPreview);
    const [copyButtonText, setCopyButtonText] = useState('Copy');

    const handleDownloadMd = () => {
        const blob = new Blob([result.standaloneMdContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${result.baseFileName}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadZip = () => {
        if (!result.zipBlob) return;
        const url = URL.createObjectURL(result.zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${result.baseFileName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(markdown);
        setCopyButtonText('Copied!');
        setTimeout(() => setCopyButtonText('Copy'), 2000);
    };

    const buttonClasses = "w-full inline-flex items-center justify-center gap-2 py-3 px-5 font-semibold cursor-pointer transition bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900";

    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-8 flex flex-col h-[calc(100vh-150px)] animate-fade-in-down">
            <div className="flex-shrink-0 flex flex-col items-center justify-center mb-6 gap-4">
                <h2 className="text-3xl font-bold">Conversion Complete</h2>
                <div className="w-full max-w-lg p-2 bg-white/5 border border-white/10 rounded-xl grid grid-cols-4 gap-2">
                    <button
                        onClick={handleCopy}
                        className={buttonClasses}
                    >
                        <CopyIcon className="w-5 h-5 flex-shrink-0" />
                        <span>{copyButtonText}</span>
                    </button>

                    <button
                        onClick={handleDownloadMd}
                        className={`${buttonClasses} flex-col`}
                    >
                        <DownloadIcon className="w-5 h-5 flex-shrink-0" />
                        <span className="flex items-center gap-1 text-center leading-tight">
                            <span>Download</span>
                            <span className="text-xs text-gray-400">.md</span>
                        </span>
                    </button>
                    
                    <button
                        onClick={handleDownloadZip}
                        disabled={!result.zipBlob}
                        className={`${buttonClasses} flex-col disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        <DownloadIcon className="w-5 h-5 flex-shrink-0" />
                        <span className="flex items-center gap-1 text-center leading-tight">
                            <span>Download</span>
                            <span className="text-xs text-gray-400">.zip</span>
                        </span>
                    </button>

                    <button
                        onClick={onStartNew}
                        className={`${buttonClasses} flex-col`}
                    >
                        <StartNewIcon className="w-5 h-5 flex-shrink-0" />
                        <span className="flex flex-col text-center leading-tight">
                           <span>Start New</span>
                        </span>
                    </button>
                </div>
            </div>
            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
                <div className="h-full flex flex-col">
                    <h3 className="font-semibold mb-2 text-center">Markdown Editor</h3>
                    <textarea
                        value={markdown}
                        onChange={(e) => setMarkdown(e.target.value)}
                        className="w-full h-full p-4 rounded-lg bg-gray-900 border border-gray-700 text-gray-200 font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                    />
                </div>
                <div className="h-full flex flex-col min-h-0">
                    <h3 className="font-semibold mb-2 text-center">Preview</h3>
                    <div
                        className="w-full h-full p-4 rounded-lg bg-gray-900 border border-gray-700 overflow-y-auto prose prose-invert max-w-none"
                    >
                         {/* FIX: The className prop is not supported by this version of ReactMarkdown and has been moved to the parent div. */}
                         <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                        >
                            {markdown}
                        </ReactMarkdown>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResultsView;