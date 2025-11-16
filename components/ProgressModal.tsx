
import React from 'react';
import { ProgressState, StepStatus } from '../types';

const StatusIcon: React.FC<{ status: StepStatus }> = ({ status }) => {
    switch (status) {
        case 'in-progress':
            return <div className="w-4 h-4 border-2 border-t-purple-400 border-gray-600 rounded-full animate-spin"></div>;
        case 'completed':
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>;
        case 'error':
             return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>;
        case 'pending':
        default:
            return <div className="w-4 h-4 border-2 border-gray-600 rounded-full"></div>;
    }
}

interface ProgressModalProps {
    progress: ProgressState;
    onReset: () => void;
}

const ProgressModal: React.FC<ProgressModalProps> = ({ progress, onReset }) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="w-full max-w-lg p-8 rounded-2xl border border-white/20 bg-gray-900/50 backdrop-blur-xl shadow-2xl text-white">
                <h2 className="text-2xl font-bold mb-6 text-center">Conversion in Progress...</h2>
                <ul className="space-y-4">
                    {progress.steps.map((step, index) => (
                        <li key={index} className={`flex items-start space-x-4 transition-opacity duration-300 ${index > progress.currentStep && step.status === 'pending' ? 'opacity-50' : 'opacity-100'}`}>
                            <div className="flex-shrink-0 mt-1">
                                <StatusIcon status={step.status} />
                            </div>
                            <div>
                                <p className="font-semibold">{step.name}</p>
                                {step.details && <p className="text-sm text-gray-400">{step.details}</p>}
                            </div>
                        </li>
                    ))}
                </ul>
                {progress.overallStatus === 'error' && (
                     <div className="mt-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                        <h3 className="font-bold text-red-300">An Error Occurred</h3>
                        <p className="text-sm text-red-300 mt-1">{progress.steps.find(s => s.status === 'error')?.details || "Please try again."}</p>
                        <button onClick={onReset} className="mt-2 text-sm bg-red-500/50 px-2 py-1 rounded">Start Over</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgressModal;
