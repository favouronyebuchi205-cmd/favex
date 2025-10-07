import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Message, Feedback, NegativeFeedbackCategory } from '../types';
import { CloseIcon } from './icons/CloseIcon';
import { ThumbsDownIcon } from './icons/ThumbsDownIcon';

interface FeedbackModalProps {
  message: Message;
  onClose: () => void;
  onSubmit: (feedback: Omit<Feedback, 'rating'>) => void;
}

const CATEGORIES: NegativeFeedbackCategory[] = ['Inaccurate', 'Unhelpful', 'Offensive', 'Other'];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ message, onClose, onSubmit }) => {
  const [selectedCategories, setSelectedCategories] = useState<NegativeFeedbackCategory[]>([]);
  const [comment, setComment] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Accessibility: Focus trap and escape key handler
  useEffect(() => {
    triggerRef.current = document.activeElement;
    const modalNode = modalRef.current;
    if (!modalNode) return;

    const focusableElements = modalNode.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    if (firstElement) {
      firstElement.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const lastElement = focusableElements[focusableElements.length - 1];
        if (event.shiftKey) { // Shift + Tab
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else { // Tab
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [onClose]);

  const handleCategoryToggle = (category: NegativeFeedbackCategory) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      categories: selectedCategories,
      comment: comment.trim(),
    });
  }, [selectedCategories, comment, onSubmit]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        className="w-full max-w-md p-6 bg-[rgb(var(--card-background-rgb))] rounded-lg shadow-xl border border-[var(--border-color)] flex flex-col animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <ThumbsDownIcon filled />
            <h2 id="feedback-modal-title" className="text-xl font-semibold text-gray-700 dark:text-gray-200">Provide Feedback</h2>
          </div>
          <button onClick={onClose} aria-label="Close feedback form" title="Close" className="text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400">
            <CloseIcon />
          </button>
        </div>
        
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Your feedback helps improve this AI. Why was this response not helpful?</p>
        
        <form onSubmit={handleSubmit}>
            <fieldset className="mb-4">
                <legend className="font-semibold mb-2 text-gray-700 dark:text-gray-300">Select reasons (optional):</legend>
                <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(category => (
                        <label key={category} className="flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50">
                            <input
                                type="checkbox"
                                checked={selectedCategories.includes(category)}
                                onChange={() => handleCategoryToggle(category)}
                                className="h-4 w-4 rounded border-gray-400 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-transparent"
                            />
                            <span className="text-gray-700 dark:text-gray-300">{category}</span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <div className="mb-6">
                <label htmlFor="feedback-comment" className="font-semibold mb-2 text-gray-700 dark:text-gray-300 block">
                    Additional comments (optional):
                </label>
                <textarea
                    id="feedback-comment"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    rows={3}
                    placeholder="Provide more details..."
                    className="w-full p-2 bg-[rgb(var(--input-bg-rgb))] rounded-md focus:outline-none focus:ring-2 border border-transparent focus:ring-blue-500 resize-none"
                />
            </div>

            <div className="flex justify-end gap-4">
                <button type="button" onClick={onClose} className="px-4 py-2 font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white rounded-md" title="Cancel and close feedback form">
                    Cancel
                </button>
                <button type="submit" className="px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors shadow-lg shadow-blue-500/20" title="Submit your feedback">
                    Submit
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};