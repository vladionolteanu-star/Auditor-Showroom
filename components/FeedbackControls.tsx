

import React, { useState, useEffect } from 'react';
import { Feedback } from '../types';
import { CheckCircleIcon, XCircleIcon } from './icons';

interface FeedbackControlsProps {
    auditId: string;
    currentFeedback?: Feedback;
    onSubmit: (feedback: Omit<Feedback, 'timestamp'>) => void;
}

const FeedbackControls: React.FC<FeedbackControlsProps> = ({ auditId, currentFeedback, onSubmit }) => {
    const [validation, setValidation] = useState<'correct' | 'incorrect' | null>(currentFeedback?.validation || null);
    const [comment, setComment] = useState(currentFeedback?.comment || '');

    useEffect(() => {
        setValidation(currentFeedback?.validation || null);
        setComment(currentFeedback?.comment || '');
    }, [currentFeedback]);

    const handleValidation = (newValidation: 'correct' | 'incorrect') => {
        setValidation(newValidation);
        onSubmit({
            auditId,
            validation: newValidation,
            comment: newValidation === 'correct' ? '' : comment,
        });
        if (newValidation === 'correct') {
            setComment('');
        }
    };
    
    const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setComment(e.target.value);
    };

    const handleCommentBlur = () => {
        if (validation === 'incorrect') {
            onSubmit({ auditId, validation, comment });
        }
    };

    return (
        <div className="mt-6 border-t border-[var(--border-subtle)] pt-4">
            <h4 className="text-sm font-semibold text-center text-[var(--text-secondary)] mb-3">Acest audit a fost corect?</h4>
            <div className="flex justify-center gap-4">
                <button
                    onClick={() => handleValidation('correct')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        validation === 'correct'
                            ? 'bg-green-500/20 text-[var(--accent-green)] ring-2 ring-[var(--accent-green)]'
                            : 'bg-white/5 hover:bg-white/10 text-[var(--text-secondary)]'
                    }`}
                >
                    <CheckCircleIcon className="w-5 h-5" /> Corect
                </button>
                <button
                    onClick={() => handleValidation('incorrect')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        validation === 'incorrect'
                            ? 'bg-red-500/20 text-[var(--accent-red)] ring-2 ring-[var(--accent-red)]'
                            : 'bg-white/5 hover:bg-white/10 text-[var(--text-secondary)]'
                    }`}
                >
                    <XCircleIcon className="w-5 h-5" /> Incorect
                </button>
            </div>
            {validation === 'incorrect' && (
                <div className="mt-4">
                    <textarea
                        value={comment}
                        onChange={handleCommentChange}
                        onBlur={handleCommentBlur}
                        placeholder="Lasă un comentariu despre ce a fost greșit..."
                        className="w-full h-24 p-2 bg-black/20 rounded-lg text-sm text-[var(--text-primary)] border border-transparent focus:border-[var(--accent-pink)] focus:ring-0 transition-colors"
                    />
                </div>
            )}
        </div>
    );
};

export default FeedbackControls;