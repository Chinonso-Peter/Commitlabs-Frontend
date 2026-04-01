'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, ExternalLink, CheckCircle, ArrowRight, X } from 'lucide-react';

interface CommitmentCreatedModalProps {
    isOpen: boolean;
    commitmentId: string;
    onViewCommitment: () => void;
    onCreateAnother: () => void;
    onClose: () => void;
    onViewOnExplorer?: () => void;
}

export const CommitmentSuccessModal: React.FC<CommitmentCreatedModalProps> = ({
    isOpen,
    commitmentId,
    onViewCommitment,
    onCreateAnother,
    onClose,
    onViewOnExplorer,
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const primaryButtonRef = useRef<HTMLButtonElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Focus trap and keyboard handling
    useEffect(() => {
        if (!isOpen) return;

        setTimeout(() => {
            primaryButtonRef.current?.focus();
        }, 100);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();

            if (e.key === 'Tab' && modalRef.current) {
                const focusableElements = modalRef.current.querySelectorAll(
                    'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                const firstElement = focusableElements[0] as HTMLElement;
                const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement?.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement?.focus();
                        e.preventDefault();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen || !mounted) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const nextSteps = [
        'Your commitment is now active and earning yield',
        'Monitor compliance and performance in your dashboard',
        'You can trade this commitment NFT in the marketplace',
    ];

    return createPortal(
        <div
            className="fixed inset-0 z-9999 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div
                ref={modalRef}
                className="w-full max-h-[100dvh] sm:max-h-[90vh] sm:max-w-[540px] overflow-y-auto bg-[#0A0A0A] sm:border border-[#FFFFFF1A] sm:rounded-[32px] flex flex-col relative shadow-2xl animate-in slide-in-from-bottom-8 duration-500 ease-out"
            >
                {/* Header Actions */}
                <div className="absolute top-6 right-6 z-10">
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/10 hover:scale-105 active:scale-95"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5 text-white/50" />
                    </button>
                </div>

                {/* Content Container */}
                <div className="px-6 sm:px-10 pt-12 pb-10 flex-1">
                    {/* Success Icon Section */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-6">
                            <div className="absolute inset-0 bg-[#0FF0FC] opacity-20 blur-2xl rounded-full animate-pulse"></div>
                            <div className="relative w-full h-full rounded-full border-2 border-[#0FF0FC] bg-[#0FF0FC]/10 flex items-center justify-center z-10 shadow-[inner_0_0_20px_rgba(15,240,252,0.2)]">
                                <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-[#0FF0FC]" strokeWidth={2.5} />
                            </div>
                        </div>

                        <div className="text-center">
                            <h2 id="modal-title" className="text-[28px] sm:text-[32px] font-bold text-white mb-2 tracking-tight leading-tight">
                                Commitment Created!
                            </h2>
                            <p className="text-[15px] sm:text-[16px] text-white/50 font-medium leading-relaxed max-w-[340px] mx-auto">
                                Your liquidity commitment has been successfully created and is now active
                            </p>
                        </div>
                    </div>

                    {/* Commitment ID Block - Standardized */}
                    <div className="bg-white/[0.03] border border-white/[0.08] rounded-[24px] p-6 mb-8 text-center group hover:bg-white/[0.05] transition-colors overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-[#0FF0FC] opacity-[0.02] blur-2xl rounded-full -mr-12 -mt-12 group-hover:opacity-[0.04] transition-opacity" />
                        <div className="text-white/40 text-[13px] font-bold mb-3 uppercase tracking-[0.2em] ml-1">
                            Commitment ID
                        </div>
                        <div className="font-mono text-[14px] sm:text-[16px] font-bold text-[#0FF0FC] tracking-wider break-all bg-white/5 px-4 py-3 rounded-xl border border-white/5">
                            {commitmentId}
                        </div>
                    </div>

                    {/* Next Steps List */}
                    <div className="mb-10 lg:px-2">
                        <h3 className="text-[14px] font-bold text-white/90 uppercase tracking-widest mb-5 ml-1">
                            Next Steps
                        </h3>
                        <div className="space-y-4">
                            {nextSteps.map((step, index) => (
                                <div key={index} className="flex items-start gap-4 p-1">
                                    <div className="mt-1 w-5 h-5 rounded-full bg-[#0FF0FC]/10 border border-[#0FF0FC]/30 flex items-center justify-center shrink-0">
                                        <CheckCircle className="w-3 h-3 text-[#0FF0FC]" strokeWidth={3} />
                                    </div>
                                    <span className="text-[14px] sm:text-[15px] text-white/70 leading-relaxed font-medium">
                                        {step}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions Block - Standardized */}
                    <div className="space-y-3">
                        <button
                            ref={primaryButtonRef}
                            onClick={onViewCommitment}
                            className="w-full bg-[#0FF0FC] hover:bg-[#0FF0FC]/90 text-black rounded-2xl py-4 flex items-center justify-center gap-3 text-[16px] font-bold transition-all shadow-[0_0_30px_rgba(15,240,252,0.3)] hover:scale-[1.01] active:scale-[0.98]"
                        >
                            <Eye className="w-5 h-5" />
                            View Commitment
                        </button>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={onCreateAnother}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-3.5 flex items-center justify-center gap-2 text-[14px] font-bold text-white transition-all active:scale-[0.98]"
                            >
                                <span className="opacity-70">Create New</span>
                                <ArrowRight className='w-4 h-4' />
                            </button>
                            <button
                                onClick={onClose}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-3.5 text-[14px] font-bold text-white transition-all active:scale-[0.98]"
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    {/* Footer Explorer Link */}
                    {onViewOnExplorer && (
                        <div className="mt-8 pt-6 border-t border-white/5">
                            <button
                                onClick={onViewOnExplorer}
                                className="w-full flex items-center justify-center gap-2 text-[13px] text-white/30 hover:text-[#0FF0FC] transition-colors transition-all py-1"
                            >
                                View on Stellar Explorer
                                <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};