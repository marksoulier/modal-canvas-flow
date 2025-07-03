import React, { useEffect } from 'react';

interface ErrorToastProps {
    message: string;
    isOpen: boolean;
    onClose: () => void;
    duration?: number; // in ms
    onClick?: () => void;
}

const ErrorToast: React.FC<ErrorToastProps> = ({ message, isOpen, onClose, duration = 4000, onClick }) => {
    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [isOpen, duration, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-red-100 text-red-700 border border-red-200 px-6 py-3 rounded shadow flex items-center gap-4 cursor-pointer min-w-[280px] max-w-[90vw]"
            style={{ pointerEvents: 'auto', wordBreak: 'break-word' }}
            onClick={onClick}
        >
            <span className="flex-1 break-words whitespace-pre-line">{message}</span>
            <button
                onClick={e => {
                    e.stopPropagation();
                    onClose();
                }}
                className="ml-2 text-red-700 hover:text-red-900 focus:outline-none"
                aria-label="Close error message"
            >
                &#10005;
            </button>
        </div>
    );
};

export default ErrorToast; 