import React, { useEffect, useRef } from 'react';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    confirmText = 'Delete', 
    cancelText = 'Cancel' 
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
      const modalNode = modalRef.current;
      if (!modalNode) return;

      const focusableElements = modalNode.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (firstElement) {
        firstElement.focus();
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') onClose();
        if (event.key === 'Tab') {
          if (event.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              event.preventDefault();
            }
          } else {
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
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose} aria-labelledby="confirmation-modal-title" role="dialog" aria-modal="true">
      <div 
        ref={modalRef}
        className="w-full max-w-sm p-6 bg-[rgb(var(--card-background-rgb))] rounded-lg shadow-xl border border-[var(--border-color)] animate-modal-in" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center text-red-500 dark:text-red-400 mb-4">
            <AlertTriangleIcon />
        </div>
        <div className="text-center">
            <h2 id="confirmation-modal-title" className="text-xl font-semibold text-gray-800 dark:text-gray-200">{title}</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{message}</p>
        </div>
        <div className="mt-8 flex justify-end gap-4">
          <button 
            onClick={onClose} 
            className="px-4 py-2 font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white rounded-md transition-colors"
            title={cancelText}
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm} 
            className="px-4 py-2 font-semibold bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors shadow-lg shadow-red-500/20"
            title={confirmText}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
