
import React, { useCallback, useRef, useState } from 'react';

const FileIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

const UploadIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
);


interface DropzoneProps {
    file: File | null;
    setFile: (file: File | null) => void;
}

const Dropzone: React.FC<DropzoneProps> = ({ file, setFile }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };
    
    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setIsDragging(true);
        } else if (e.type === "dragleave") {
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    }, [setFile]);

    const handleDropzoneClick = () => {
        if (!file) {
            fileInputRef.current?.click();
        }
    };

    return (
        <div className="h-full">
            <input
                ref={fileInputRef}
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.html"
            />
            <div
                role="button"
                tabIndex={0}
                onClick={handleDropzoneClick}
                onKeyDown={(e) => {
                    if (!file && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleDropzoneClick();
                    }
                }}
                className={`relative w-full h-full min-h-[350px] flex flex-col justify-center items-center p-6 border-2 border-dashed rounded-2xl transition-all duration-300 ${isDragging ? 'border-purple-500 bg-white/5' : 'border-gray-600 hover:border-gray-500'} ${file ? 'cursor-default' : 'cursor-pointer'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                {!file ? (
                    <div className="text-center">
                        <UploadIcon />
                        <p className="mt-4 text-lg font-semibold">Drag & Drop file here</p>
                        <p className="text-sm text-gray-400">or</p>
                        <span className="mt-2 text-purple-400 font-semibold hover:underline">
                            Click to select a file
                        </span>
                        <p className="text-xs text-gray-500 mt-4">Supported formats: PDF, HTML</p>
                    </div>
                ) : (
                    <div className="text-center">
                        <FileIcon />
                        <p className="mt-3 text-lg font-semibold break-all">{file.name}</p>
                        <p className="text-sm text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                setFile(null);
                            }}
                            className="mt-4 text-sm bg-red-500/20 hover:bg-red-500/40 text-red-300 font-semibold py-2 px-4 rounded-lg transition"
                        >
                            Clear File
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dropzone;
