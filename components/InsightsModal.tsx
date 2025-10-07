import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FuturisticLoaderIcon } from './icons/FuturisticLoaderIcon';
import { CloseIcon } from './icons/CloseIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { CopyIcon } from './icons/CopyIcon';
import { CheckIcon } from './icons/CheckIcon';
import { ConversationInsights, Sentiment, NegativeFeedbackCategory } from '../types';
import { SentimentIcon } from './icons/SentimentIcon';
import { TopicsIcon } from './icons/TopicsIcon';
import { FeedbackIcon } from './icons/FeedbackIcon';
import { ThumbsUpIcon } from './icons/ThumbsUpIcon';
import { ThumbsDownIcon } from './icons/ThumbsDownIcon';
import { ChartIcon } from './icons/ChartIcon';
import { AnalysisIcon } from './icons/AnalysisIcon';


interface InsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  insights: ConversationInsights | null;
  error: string | null;
}

const sentimentColorMap: Record<Sentiment, string> = {
  Positive: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/20',
  Negative: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/20',
  Neutral: 'text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700/50',
  Mixed: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-500/20',
};

const NEGATIVE_CATEGORIES: NegativeFeedbackCategory[] = ['Inaccurate', 'Unhelpful', 'Offensive', 'Other'];


export const InsightsModal: React.FC<InsightsModalProps> = ({ isOpen, onClose, isLoading, insights, error }) => {
  const [copiedSection, setCopiedSection] = useState<'summary' | 'actions' | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Accessibility: Focus trap and escape key handler
  useEffect(() => {
    if (isOpen) {
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
          if (focusableElements.length === 0) {
            event.preventDefault();
            return;
          }
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
  }, [isOpen, onClose]);


  const handleCopy = useCallback((text: string, section: 'summary' | 'actions') => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        setCopiedSection(section);
        setTimeout(() => {
            setCopiedSection(null);
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="insights-modal-title"
        className="w-full max-w-2xl p-6 bg-[rgb(var(--card-background-rgb))] rounded-lg shadow-xl border border-[var(--border-color)] flex flex-col max-h-[90vh] animate-modal-in" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <LightbulbIcon />
            <h2 id="insights-modal-title" className="text-xl font-semibold text-gray-800 dark:text-gray-200">Conversation Insights</h2>
          </div>
          <button onClick={onClose} aria-label="Close insights modal" title="Close" className="text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400">
            <CloseIcon />
          </button>
        </div>
        
        <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
              <FuturisticLoaderIcon />
              <p className="mt-4">Analyzing conversation...</p>
            </div>
          ) : error && !insights ? (
            <div className="text-center text-red-500 dark:text-red-400">
              <p><strong>Analysis Failed</strong></p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          ) : insights ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                      <div className="flex items-center gap-2 mb-2">
                          <SentimentIcon />
                          <h4 className="font-semibold text-gray-600 dark:text-gray-300">Overall Sentiment</h4>
                      </div>
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${sentimentColorMap[insights.sentiment] || sentimentColorMap.Neutral}`}>
                          {insights.sentiment}
                      </span>
                  </div>
                  <div>
                      <div className="flex items-center gap-2 mb-2">
                          <TopicsIcon />
                          <h4 className="font-semibold text-gray-600 dark:text-gray-300">Key Topics</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                          {insights.keyTopics && insights.keyTopics.length > 0 ? (
                              insights.keyTopics.map((topic, index) => (
                                  <span key={index} className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                                      {topic}
                                  </span>
                              ))
                          ) : (
                              <p className="text-sm text-gray-500 dark:text-gray-400">None identified.</p>
                          )}
                      </div>
                  </div>
              </div>

              <div className="border-t border-[var(--border-color)]"></div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Summary</h3>
                  <button
                      onClick={() => handleCopy(insights.summary, 'summary')}
                      aria-label={copiedSection === 'summary' ? "Summary copied" : "Copy summary"}
                      title={copiedSection === 'summary' ? "Copied!" : "Copy summary"}
                      className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!insights.summary || insights.summary === 'AI analysis failed.'}
                  >
                      {copiedSection === 'summary' ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </div>
                <p className={`text-gray-600 dark:text-gray-300 whitespace-pre-wrap ${insights.summary === 'AI analysis failed.' ? 'italic text-gray-400' : ''}`}>{insights.summary}</p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Action Items</h3>
                   <button
                      onClick={() => handleCopy(insights.actionItems.join('\n'), 'actions')}
                      aria-label={copiedSection === 'actions' ? "Action items copied" : "Copy action items"}
                      title={copiedSection === 'actions' ? "Copied!" : "Copy action items"}
                      className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!insights.actionItems || insights.actionItems.length === 0}
                  >
                      {copiedSection === 'actions' ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </div>
                {insights.actionItems && insights.actionItems.length > 0 ? (
                  <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300">
                    {insights.actionItems.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No action items were identified.</p>
                )}
              </div>

               {insights.feedbackSummary && (
                <div className="space-y-6 pt-6 border-t border-[var(--border-color)]">
                  <div className="flex items-center gap-3">
                      <FeedbackIcon />
                      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Feedback Analysis</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: Stats */}
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <ThumbsUpIcon />
                          <h4 className="font-semibold text-gray-600 dark:text-gray-300">Overall Ratings</h4>
                        </div>
                        <div className="flex items-center gap-6 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-[var(--border-color)]">
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                <ThumbsUpIcon filled />
                                <span className="font-bold text-lg">{insights.feedbackSummary.good}</span>
                                <span className="text-sm">Good</span>
                            </div>
                             <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                <ThumbsDownIcon filled />
                                 <span className="font-bold text-lg">{insights.feedbackSummary.bad}</span>
                                <span className="text-sm">Bad</span>
                            </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <ChartIcon />
                          <h4 className="font-semibold text-gray-600 dark:text-gray-300">Negative Feedback Breakdown</h4>
                        </div>
                        {insights.feedbackSummary.bad > 0 ? (
                          <ul className="space-y-1.5 text-sm pl-2">
                            {NEGATIVE_CATEGORIES.map(category => (
                              <li key={category} className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                                <span>{category}:</span>
                                <span className="font-bold">{insights.feedbackSummary.categoryCounts[category]}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No negative feedback provided.</p>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Themes & Comments */}
                    <div className="space-y-6">
                       <div>
                          <div className="flex items-center gap-2 mb-3">
                            <AnalysisIcon />
                            <h4 className="font-semibold text-gray-600 dark:text-gray-300">Common Themes</h4>
                          </div>
                          {insights.feedbackSummary.commonThemes && insights.feedbackSummary.commonThemes.length > 0 ? (
                            <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300 text-sm">
                              {insights.feedbackSummary.commonThemes.map((theme, index) => (
                                <li key={index}>{theme}</li>
                              ))}
                            </ul>
                          ) : (
                             <p className="text-sm text-gray-500 dark:text-gray-400">{insights.feedbackSummary.bad > 0 ? "AI analysis found no common themes." : "No negative comments to analyze."}</p>
                          )}
                        </div>

                        {insights.feedbackSummary.comments.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-gray-600 dark:text-gray-300 mb-3">Comments</h4>
                                <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                                  {insights.feedbackSummary.comments.map((comment, index) => (
                                      <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm border border-[var(--border-color)]">
                                          <p className="text-gray-500 dark:text-gray-400 italic truncate">On: "{comment.messageContent}"</p>
                                          {comment.categories.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                              {comment.categories.map(cat => (
                                                <span key={cat} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">{cat}</span>
                                              ))}
                                            </div>
                                          )}
                                          <p className="text-gray-800 dark:text-gray-200 mt-2">Feedback: "{comment.feedbackComment}"</p>
                                      </div>
                                  ))}
                                </div>
                            </div>
                        )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
             <div className="text-center text-gray-500 dark:text-gray-400">
                <p>No insights available.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};