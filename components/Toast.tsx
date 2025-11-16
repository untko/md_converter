
import React from 'react';

interface ToastProps {
    message: string;
    type: 'success' | 'error';
    onClose: () => void;
}

const SuccessIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const ErrorIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    React.useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const isSuccess = type === 'success';
    const bgColor = isSuccess ? 'bg-green-600/90' : 'bg-red-600/90';
    const borderColor = isSuccess ? 'border-green-500' : 'border-red-500';

    return (
        <div
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-fade-in-down"
            role="alert"
            aria-live="assertive"
        >
            <div className={`flex items-center gap-3 ${bgColor} backdrop-blur-sm text-white font-semibold py-3 px-6 rounded-full shadow-lg border ${borderColor}`}>
                {isSuccess ? <SuccessIcon /> : <ErrorIcon />}
                <span>{message}</span>
            </div>
        </div>
    );
};

export default Toast;
