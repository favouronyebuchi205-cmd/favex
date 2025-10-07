import React, { useState, useEffect, useCallback, useRef } from 'react';
import { embedContent } from '../services/geminiService';
import type { VectorEntry } from '../types';
import { CloseIcon } from './icons/CloseIcon';
import { FuturisticLoaderIcon } from './icons/FuturisticLoaderIcon';
import { DatabaseIcon } from './icons/DatabaseIcon';
import { TrashIcon } from './icons/TrashIcon';

interface VectorDBModalProps {
  isOpen: boolean;
  onClose: () => void;
  storageKey: string;
}

export const VectorDBModal: React.FC<VectorDBModalProps> = ({ isOpen, onClose, storageKey }) => {
  const [entries, setEntries] = useState<VectorEntry[]>([]);
  const [newContent, setNewContent] = useState('');
  const [isIndexing, setIsIndexing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Accessibility: Focus trap and escape key handler
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
      const storedEntries = localStorage.getItem(storageKey);
      if (storedEntries) {
        setEntries(JSON.parse(storedEntries));
      }

      const modalNode = modalRef.current;
      if (!modalNode) return;

      // Defer focus setting to allow modal content to render
      setTimeout(() => {
        const focusableElements = modalNode.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        if (firstElement) {
          firstElement.focus();
        }
      }, 100);

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') onClose();
        if (event.key === 'Tab') {
          const focusableElements = modalNode.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusableElements.length === 0) {
            event.preventDefault();
            return;
          }
          const firstElement = focusableElements[0];
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
    }
  }, [isOpen, storageKey, onClose]);


  const handleIndexDocument = useCallback(async () => {
    if (!newContent.trim()) {
      setError("Content cannot be empty.");
      return;
    }
    setIsIndexing(true);
    setError(null);
    try {
      const embedding = await embedContent(newContent);
      const newEntry: VectorEntry = {
        id: Date.now().toString(),
        content: newContent,
        embedding,
      };
      
      const updatedEntries = [...entries, newEntry];
      setEntries(updatedEntries);
      localStorage.setItem(storageKey, JSON.stringify(updatedEntries));
      setNewContent('');

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred during indexing.");
    } finally {
      setIsIndexing(false);
    }
  }, [newContent, entries, storageKey]);

  const handleDeleteEntry = useCallback((id: string) => {
    const updatedEntries = entries.filter(entry => entry.id !== id);
    setEntries(updatedEntries);
    localStorage.setItem(storageKey, JSON.stringify(updatedEntries));
  }, [entries, storageKey]);

  const handleClearAll = useCallback(() => {
    if (window.confirm("Are you sure you want to delete all documents from the vector database? This action cannot be undone.")) {
        setEntries([]);
        localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vectordb-modal-title"
        className="w-full max-w-2xl p-6 bg-[rgb(var(--card-background-rgb))] rounded-lg shadow-xl border border-[var(--border-color)] flex flex-col max-h-[90vh] animate-modal-in" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <DatabaseIcon />
            <h2 id="vectordb-modal-title" className="text-xl font-semibold text-gray-800 dark:text-gray-200">Local Vector DB</h2>
          </div>
          <button onClick={onClose} aria-label="Close vector database modal" title="Close" className="text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400">
            <CloseIcon />
          </button>
        </div>

        <div className="flex-grow flex flex-col md:flex-row gap-6 overflow-hidden">
            {/* Left side: Add new document */}
            <div className="md:w-1/2 flex flex-col space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Index New Document</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Paste text below to convert it into an embedding and store it locally for context-aware chat responses in 'Vector' mode.</p>
                <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Paste your document content here..."
                    className="w-full flex-grow p-3 bg-[rgb(var(--input-bg-rgb))] rounded-md focus:outline-none focus:ring-2 border border-transparent focus:ring-blue-500 resize-none"
                    rows={10}
                    disabled={isIndexing}
                    aria-label="Content for new document"
                />
                {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
                <button
                    onClick={handleIndexDocument}
                    disabled={isIndexing || !newContent.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-wait shadow-lg shadow-blue-500/20"
                    title="Generate embedding and save document"
                >
                    {isIndexing ? <><FuturisticLoaderIcon /> Indexing...</> : 'Index Document'}
                </button>
            </div>
            
            {/* Right side: List indexed documents */}
            <div className="md:w-1/2 flex flex-col space-y-4 min-h-0">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Indexed Documents ({entries.length})</h3>
                    {entries.length > 0 && (
                        <button 
                            onClick={handleClearAll}
                            className="text-xs text-red-500 hover:underline"
                            title="Delete all indexed documents"
                        >
                            Clear All
                        </button>
                    )}
                </div>
                <div className="flex-grow overflow-y-auto pr-2 border border-[var(--border-color)] rounded-lg p-2 bg-gray-50 dark:bg-gray-800/50">
                    {entries.length > 0 ? (
                        <div className="space-y-2">
                            {entries.map(entry => (
                                <div key={entry.id} className="group flex items-start justify-between p-3 bg-white dark:bg-gray-700/50 rounded-md shadow-sm border border-gray-200 dark:border-gray-700">
                                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate pr-2" title={entry.content}>
                                        {entry.content}
                                    </p>
                                    <button
                                        onClick={() => handleDeleteEntry(entry.id)}
                                        className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-opacity flex-shrink-0"
                                        aria-label={`Delete document: ${entry.content.substring(0, 30)}...`}
                                        title="Delete document"
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                            <p>No documents indexed yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};