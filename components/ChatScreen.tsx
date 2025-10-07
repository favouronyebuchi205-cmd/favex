import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Chat } from '@google/genai';
import { createChatSession, generateGroundedContent, generateTitle, generateConversationInsights, refineContent, embedContent, cosineSimilarity } from '../services/geminiService';
import type { Message, User, Conversation, ReasoningMode, GroundingMode, VectorEntry, ConversationInsights, Feedback } from '../types';
import { UserIcon } from './icons/UserIcon';
import { BotIcon } from './icons/BotIcon';
import { SendIcon } from './icons/SendIcon';
import { FuturisticLoaderIcon } from './icons/FuturisticLoaderIcon';
import { TypingIndicator } from './TypingIndicator';
import { ProfileIcon } from './icons/ProfileIcon';
import { ProfileModal } from './ProfileModal';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { BrainIcon } from './icons/BrainIcon';
import { WebIcon } from './icons/WebIcon';
import { SunIcon } from './icons/SunIcon';
import { MoonIcon } from './icons/MoonIcon';
import { MenuIcon } from './icons/MenuIcon';
import { CloseIcon } from './icons/CloseIcon';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import { CopyIcon } from './icons/CopyIcon';
import { CheckIcon } from './icons/CheckIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { InsightsModal } from './InsightsModal';
import { SummarizeIcon } from './icons/SummarizeIcon';
import { RemixIcon } from './icons/RemixIcon';
import { ShortenIcon } from './icons/ShortenIcon';
import { DatabaseIcon } from './icons/DatabaseIcon';
import { VectorDBModal } from './VectorDBModal';
import { ThumbsUpIcon } from './icons/ThumbsUpIcon';
import { ThumbsDownIcon } from './icons/ThumbsDownIcon';
import { FeedbackModal } from './FeedbackModal';
import { Logo } from './Logo';
import { ErrorIcon } from './icons/ErrorIcon';


// Fix: Add type definitions for the Web Speech API to resolve TypeScript errors.
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: () => void;
  onend: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
}

declare global {
  interface Window {
    SpeechRecognition: { new (): SpeechRecognition };
    webkitSpeechRecognition: { new (): SpeechRecognition };
  }
}

interface ChatScreenProps {
  user: User;
  onLogout: () => void;
  onProfileUpdate: (user: User) => void;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
}

const ChatScreen: React.FC<ChatScreenProps> = ({ user, onLogout, onProfileUpdate, theme, onThemeToggle }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [reasoningMode, setReasoningMode] = useState<ReasoningMode>(user.reasoningMode);
  const [groundingMode, setGroundingMode] = useState<GroundingMode>(user.groundingMode);
  const [isListening, setIsListening] = useState(false);
  const [isSpeechApiSupported, setIsSpeechApiSupported] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isInsightsModalOpen, setIsInsightsModalOpen] = useState(false);
  const [currentInsights, setCurrentInsights] = useState<ConversationInsights | null>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [refiningMessageId, setRefiningMessageId] = useState<string | null>(null);
  const [refinementError, setRefinementError] = useState<{ messageId: string; error: string } | null>(null);
  const [isVectorDBModalOpen, setIsVectorDBModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<Message | null>(null);
  
  const chatRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const menuTriggerRef = useRef<Element | null>(null);
  const storageKey = `chatHistory_${user.username}`;
  const vectorDBStorageKey = `vectorDB_${user.username}`;

  // Sync local state if user prop changes
  useEffect(() => {
    setReasoningMode(user.reasoningMode);
    setGroundingMode(user.groundingMode);
  }, [user.reasoningMode, user.groundingMode]);

  // Accessibility: Focus trap for Menu Panel
  useEffect(() => {
    if (isMenuOpen) {
      menuTriggerRef.current = document.activeElement;
      const panelNode = menuPanelRef.current;
      if (!panelNode) return;

      const focusableElements = panelNode.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      if (firstElement) {
        firstElement.focus();
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setIsMenuOpen(false);
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
        if (menuTriggerRef.current instanceof HTMLElement) {
          menuTriggerRef.current.focus();
        }
      };
    }
  }, [isMenuOpen]);

  const handleNewChat = useCallback(() => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [
        { id: 'initial', role: 'model', content: `Hello, ${user.displayName}! How can I assist you today?`, timestamp: Date.now() }
      ],
      timestamp: Date.now(),
    };
    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
  }, [user.displayName]);

  // Load conversations from localStorage on mount, or create a new one if empty.
  useEffect(() => {
    const storedConversations = localStorage.getItem(storageKey);
    if (storedConversations) {
      try {
        const parsedConversations: Conversation[] = JSON.parse(storedConversations);
        if (parsedConversations.length > 0) {
          setConversations(parsedConversations);
          const sorted = [...parsedConversations].sort((a, b) => b.timestamp - a.timestamp);
          setActiveConversationId(sorted[0].id);
          return; // Exit if conversations are found and loaded
        }
      } catch (error) {
        console.error("Failed to parse chat history:", error);
        localStorage.removeItem(storageKey); // Clear corrupted data
      }
    }
    // If no conversations were found or loaded, create a new one.
    handleNewChat();
    // This effect should run only when the user changes, not on profile updates.
    // We disable the lint warning because including handleNewChat would cause
    // a new chat to be created every time the user's display name changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Save conversations to localStorage when they change
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(conversations));
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [conversations, storageKey]);

  // Setup Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSpeechApiSupported(false);
      return;
    }

    setIsSpeechApiSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => (prev ? prev + ' ' : '') + transcript);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, []);

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  
  // Initialize or update chat session
  useEffect(() => {
    if (activeConversation) {
      chatRef.current = createChatSession(activeConversation.messages, reasoningMode, user.systemInstruction);
    } else {
      chatRef.current = null;
    }
  }, [activeConversation, reasoningMode, user.systemInstruction]);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
  };

  const handleDeleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
        const remainingConversations = conversations.filter(c => c.id !== id);
        if (remainingConversations.length > 0) {
            setActiveConversationId(remainingConversations.sort((a,b) => b.timestamp - a.timestamp)[0].id);
        } else {
            setActiveConversationId(null);
            handleNewChat(); // Create a new chat if the last one was deleted
        }
    }
  };

  const handleToggleReasoningMode = useCallback(() => {
    const newMode = reasoningMode === 'normal' ? 'fast' : 'normal';
    setReasoningMode(newMode);
    onProfileUpdate({ ...user, reasoningMode: newMode });
  }, [reasoningMode, user, onProfileUpdate]);

  const handleSetGroundingMode = useCallback((mode: GroundingMode) => {
    setGroundingMode(mode);
    onProfileUpdate({ ...user, groundingMode: mode });
  }, [user, onProfileUpdate]);

  const handleToggleListening = useCallback(() => {
    if (!recognitionRef.current || isLoading || !activeConversationId) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  }, [isListening, isLoading, activeConversationId]);
  
  const handleCopy = useCallback((text: string, messageId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        setCopiedMessageId(messageId);
        setTimeout(() => {
            setCopiedMessageId(null);
        }, 2000); // Revert icon after 2 seconds
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
  }, []);

  const handleOpenInsights = useCallback(async () => {
    if (!activeConversation) return;

    setIsInsightsModalOpen(true);
    setIsInsightsLoading(true);
    setInsightsError(null);
    setCurrentInsights(null);

    try {
      const insights = await generateConversationInsights(activeConversation.messages);
      setCurrentInsights(insights);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setInsightsError(errorMessage);
    } finally {
      setIsInsightsLoading(false);
    }
  }, [activeConversation]);

  type RefinementType = 'summarize' | 'remix' | 'shorten';

  const handleRefineMessage = useCallback(async (messageId: string, originalContent: string, type: RefinementType) => {
    if (!activeConversationId) return;

    let instruction = '';
    switch (type) {
        case 'summarize':
            instruction = 'Summarize the following text concisely';
            break;
        case 'remix':
            instruction = 'Rephrase the following text in a different way, perhaps with a different tone or structure';
            break;
        case 'shorten':
            instruction = 'Make the following text shorter and more direct';
            break;
    }

    setRefiningMessageId(messageId);
    setRefinementError(null);

    try {
        const refinedContent = await refineContent(instruction, originalContent);
        
        setConversations(prev =>
            prev.map(c =>
                c.id === activeConversationId
                    ? {
                        ...c,
                        messages: c.messages.map(msg =>
                            msg.id === messageId ? { ...msg, content: refinedContent } : msg
                        ),
                    }
                    : c
            )
        );

    } catch (error) {
        console.error("Failed to refine message:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        setRefinementError({ messageId, error: errorMessage });
        setTimeout(() => setRefinementError(null), 5000); // Clear error after 5 seconds
    } finally {
        setRefiningMessageId(null);
    }
  }, [activeConversationId]);

  const handleFeedback = useCallback((message: Message, rating: 'good' | 'bad') => {
    if (!activeConversationId) return;
    if (rating === 'good') {
        const newFeedback: Feedback = { rating: 'good' };
        setConversations(prev =>
            prev.map(c =>
                c.id === activeConversationId
                    ? { ...c, messages: c.messages.map(msg => msg.id === message.id ? { ...msg, feedback: newFeedback } : msg) }
                    : c
            )
        );
    } else {
        setFeedbackMessage(message);
    }
  }, [activeConversationId]);

  const handleFeedbackSubmit = useCallback((feedbackDetails: Omit<Feedback, 'rating'>) => {
    if (!feedbackMessage || !activeConversationId) return;
    
    const finalFeedback: Feedback = { rating: 'bad', ...feedbackDetails };
    
    setConversations(prev =>
        prev.map(c =>
            c.id === activeConversationId
                ? { ...c, messages: c.messages.map(msg => msg.id === feedbackMessage.id ? { ...msg, feedback: finalFeedback } : msg) }
                : c
        )
    );

    setFeedbackMessage(null);
  }, [feedbackMessage, activeConversationId]);


  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || !activeConversationId) return;

    const userMessageContent = input;
    let finalPrompt = userMessageContent;
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: userMessageContent, timestamp: Date.now() };
    const modelMessageId = (Date.now() + 1).toString();
    
    const conversationBeforeSend = conversations.find(c => c.id === activeConversationId);
    const isFirstUserMessage = conversationBeforeSend ? conversationBeforeSend.messages.filter(m => m.role === 'user').length === 0 : false;
    
    const updatedConversations = conversations.map(c => {
        if (c.id === activeConversationId) {
            const newMessages: Message[] = [...c.messages, userMessage, { id: modelMessageId, role: 'model', content: '', timestamp: Date.now() }];
            return { ...c, messages: newMessages, timestamp: Date.now() };
        }
        return c;
    });

    setConversations(updatedConversations);
    setInput('');
    setIsLoading(true);

    let finalModelResponse = '';
    let finalSources: { uri: string; title: string }[] | undefined = undefined;

    try {
      if (groundingMode === 'nexus') {
        const response = await generateGroundedContent(userMessageContent);
        finalModelResponse = response.text;
        finalSources = response.sources;
        setConversations(prev =>
          prev.map(c =>
            c.id === activeConversationId
              ? {
                  ...c,
                  messages: c.messages.map(msg =>
                    msg.id === modelMessageId ? { ...msg, content: finalModelResponse, sources: finalSources } : msg
                  ),
                }
              : c
          )
        );
      } else { // Handles 'vector' and 'disabled' modes
        if (groundingMode === 'vector') {
            const storedEntries: VectorEntry[] = JSON.parse(localStorage.getItem(vectorDBStorageKey) || '[]');
            if (storedEntries.length > 0) {
              const queryEmbedding = await embedContent(userMessageContent);
              
              let bestMatch: { entry: VectorEntry, score: number } | null = null;

              for (const entry of storedEntries) {
                  const score = cosineSimilarity(queryEmbedding, entry.embedding);
                  if (!bestMatch || score > bestMatch.score) {
                      bestMatch = { entry, score };
                  }
              }

              // Use a threshold to ensure relevance
              if (bestMatch && bestMatch.score > 0.75) {
                  finalPrompt = `Using the following context, answer the user's question.\n\n---\n\nContext: "${bestMatch.entry.content}"\n\n---\n\nQuestion: "${userMessageContent}"`;
              }
            }
        }
        
        if (!chatRef.current) return;
        const stream = await chatRef.current.sendMessageStream({ message: finalPrompt });
        
        for await (const chunk of stream) {
          finalModelResponse += chunk.text;
          setConversations(prev =>
            prev.map(c =>
              c.id === activeConversationId
                ? {
                    ...c,
                    messages: c.messages.map(msg =>
                      msg.id === modelMessageId ? { ...msg, content: finalModelResponse } : msg
                    ),
                  }
                : c
            )
          );
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = error instanceof Error ? error.message : "My apologies, I've encountered a system anomaly. Please try again.";
      setConversations(prev =>
        prev.map(c =>
          c.id === activeConversationId
            ? {
                ...c,
                messages: c.messages.map(msg =>
                  msg.id === modelMessageId ? { ...msg, content: errorMessage, isError: true } : msg
                ),
              }
            : c
        )
      );
    } finally {
      setIsLoading(false);
      if (isFirstUserMessage && finalModelResponse) {
        // Use an IIFE to run async logic without making `finally` async
        (async () => {
          const newTitle = await generateTitle(userMessageContent, finalModelResponse);
          if (newTitle) {
            setConversations(prev => prev.map(c => 
              c.id === activeConversationId ? { ...c, title: newTitle } : c
            ));
          }
        })();
      }
    }
  }, [input, isLoading, activeConversationId, conversations, groundingMode, vectorDBStorageKey]);

  return (
    <>
      <div className="flex h-full w-full bg-[rgb(var(--card-background-rgb))] rounded-lg shadow-2xl border border-[var(--border-color)] overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          <header className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
              <Logo />
              <div className="flex items-center gap-4">
                <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-400">Welcome, {user.displayName}</span>
                <button 
                    onClick={onThemeToggle} 
                    aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} 
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    className="text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                    {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </button>
                <button
                  onClick={handleOpenInsights}
                  aria-label="Show conversation insights"
                  title="Show conversation insights"
                  className="text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!activeConversation || activeConversation.messages.filter(m => m.role === 'user').length === 0}
                >
                  <LightbulbIcon />
                </button>
                <button 
                    onClick={() => setIsMenuOpen(true)} 
                    aria-label="Open menu" 
                    title="Open menu"
                    className="text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                    <MenuIcon />
                </button>
              </div>
          </header>

          <div className="flex-grow p-6 overflow-y-auto space-y-6 bg-white dark:bg-gray-800/50">
            {activeConversation ? (
              activeConversation.messages.map((msg, index) => (
                <div
                  key={msg.id}
                  tabIndex={0}
                  aria-label={`${msg.role === 'user' ? 'Your' : 'AI'} message at ${new Date(msg.timestamp).toLocaleTimeString()}`}
                  className={`group flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''} animate-message-in focus:outline-none focus:ring-2 focus:ring-offset-2 dark:ring-offset-gray-900 focus:ring-blue-500 rounded-lg p-1 -m-1`}
                >
                  {msg.role === 'model' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border border-gray-300 dark:border-gray-600">
                      <BotIcon />
                    </div>
                  )}
                  {msg.role === 'user' && (
                    <div className="self-start opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-300 z-10">
                        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 p-1 flex flex-col">
                            <button
                                onClick={() => handleCopy(msg.content, msg.id)}
                                aria-label={copiedMessageId === msg.id ? "Content copied to clipboard" : "Copy your message"}
                                disabled={!msg.content.trim()}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {copiedMessageId === msg.id ? <CheckIcon /> : <CopyIcon />}
                                <span>{copiedMessageId === msg.id ? "Copied!" : "Copy"}</span>
                            </button>
                        </div>
                    </div>
                  )}
                  <div className={`max-w-xl px-5 py-3 rounded-2xl ${
                      msg.isError
                        ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 rounded-bl-none border border-red-200 dark:border-red-500/30'
                        : msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-none shadow-lg shadow-blue-500/20'
                          : 'bg-white/30 dark:bg-gray-900/30 backdrop-blur-lg border border-white/20 dark:border-gray-500/20 rounded-bl-none text-gray-900 dark:text-gray-50'
                    }`}>
                    {refiningMessageId === msg.id ? (
                        <TypingIndicator />
                    ) : isLoading && msg.role === 'model' && index === activeConversation.messages.length - 1 && !msg.content ? (
                      <TypingIndicator />
                    ) : (
                      <>
                        {msg.isError && (
                          <div className="flex items-center gap-2 mb-2 font-semibold">
                            <ErrorIcon />
                            <span>Error</span>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">
                          {msg.content}
                          {isLoading && msg.role === 'model' && index === activeConversation.messages.length - 1 && <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse"></span>}
                        </p>
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600/50">
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Sources:</h4>
                            <ul className="space-y-1.5">
                              {msg.sources.map((source, idx) => (
                                <li key={idx} className="flex items-center gap-2">
                                  <span className="text-xs text-blue-600 dark:text-blue-400">{idx + 1}.</span>
                                  <a 
                                    href={source.uri} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
                                    title={source.uri}
                                  >
                                    {source.title || new URL(source.uri).hostname}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                         <div className={`text-right text-xs mt-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </>
                    )}
                  </div>
                  {msg.role === 'model' && !msg.isError && (
                    <div className="self-start opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-300 z-10">
                        <div className="w-48 bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 p-2 flex flex-col gap-1">
                          {refinementError && refinementError.messageId === msg.id ? (
                              <div className="p-2 text-center text-red-500 dark:text-red-400 text-sm">
                                  <p className="font-semibold">Refinement Failed</p>
                                  <p>{refinementError.error}</p>
                              </div>
                          ) : (
                            <>
                              {/* Feedback */}
                              <div className="flex items-center justify-around p-1 border-b border-gray-200 dark:border-gray-700 mb-1">
                                  <button onClick={() => handleFeedback(msg, 'good')} disabled={!!msg.feedback || isLoading || !!refiningMessageId} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors aria-pressed:text-green-500" aria-label="Good response" title="Good response" aria-pressed={msg.feedback?.rating === 'good'}>
                                      <ThumbsUpIcon filled={msg.feedback?.rating === 'good'} />
                                  </button>
                                  <button onClick={() => handleFeedback(msg, 'bad')} disabled={!!msg.feedback || isLoading || !!refiningMessageId} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors aria-pressed:text-red-500" aria-label="Bad response" title="Bad response" aria-pressed={msg.feedback?.rating === 'bad'}>
                                      <ThumbsDownIcon filled={msg.feedback?.rating === 'bad'} />
                                  </button>
                              </div>
                              {/* Actions with Labels */}
                              <button onClick={() => handleRefineMessage(msg.id, msg.content, 'summarize')} disabled={!msg.content.trim() || isLoading || !!refiningMessageId} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                  <SummarizeIcon />
                                  <span>Summarize</span>
                              </button>
                              <button onClick={() => handleRefineMessage(msg.id, msg.content, 'shorten')} disabled={!msg.content.trim() || isLoading || !!refiningMessageId} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                  <ShortenIcon />
                                  <span>Make Shorter</span>
                              </button>
                              <button onClick={() => handleRefineMessage(msg.id, msg.content, 'remix')} disabled={!msg.content.trim() || isLoading || !!refiningMessageId} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                  <RemixIcon />
                                  <span>Remix</span>
                              </button>
                              <button onClick={() => handleCopy(msg.content, msg.id)} disabled={!msg.content.trim() || isLoading || !!refiningMessageId} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                  {copiedMessageId === msg.id ? <CheckIcon /> : <CopyIcon />}
                                  <span>{copiedMessageId === msg.id ? "Copied!" : "Copy"}</span>
                              </button>
                            </>
                          )}
                        </div>
                    </div>
                  )}
                   {msg.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center border border-blue-200 dark:border-blue-800 overflow-hidden">
                      <UserIcon avatar={user.avatar} />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <FuturisticLoaderIcon />
                <p className="mt-2">Loading conversation...</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-[var(--border-color)]">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={isListening ? "Listening..." : (activeConversationId ? "Ask anything..." : "Loading...")}
                className="w-full pl-4 pr-24 py-3 bg-[rgb(var(--input-bg-rgb))] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                disabled={isLoading || !activeConversationId}
                aria-label="Chat input"
              />
              {isSpeechApiSupported && (
                 <button
                    onClick={handleToggleListening}
                    disabled={isLoading || !activeConversationId}
                    className={`absolute right-12 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isListening ? 'text-red-500 bg-red-100 dark:bg-red-500/20 animate-pulse' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-blue-500 dark:hover:text-blue-400'}`}
                    aria-label={isListening ? "Stop listening" : "Start listening with microphone"}
                    title={isListening ? "Stop listening" : "Start listening"}
                  >
                    <MicrophoneIcon />
                  </button>
              )}
              <button
                onClick={handleSend}
                disabled={isLoading || !activeConversationId || !input.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-blue-500 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Send message"
                title="Send message"
              >
                {isLoading ? <FuturisticLoaderIcon /> : <SendIcon />}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-40 transition-opacity duration-300" aria-modal="true">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60" onClick={() => setIsMenuOpen(false)}></div>

            {/* Menu Panel */}
            <div
                ref={menuPanelRef}
                role="dialog"
                aria-labelledby="menu-title"
                aria-modal="true"
                className="fixed right-0 top-0 z-50 w-80 max-w-[calc(100%-2rem)] h-full bg-[rgb(var(--card-background-rgb))] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out border-l border-[var(--border-color)] animate-modal-in"
            >
                <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                    <h2 id="menu-title" className="text-lg font-semibold text-gray-800 dark:text-gray-200">Menu</h2>
                    <button onClick={() => setIsMenuOpen(false)} aria-label="Close menu" title="Close menu" className="text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400">
                        <CloseIcon />
                    </button>
                </div>
                <div className="flex-grow p-4 space-y-4 overflow-y-auto">
                    <button onClick={() => { handleNewChat(); setIsMenuOpen(false); }} className="flex items-center justify-center gap-3 w-full p-3 text-base font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20" title="Start a new conversation">
                        <PlusIcon />
                        <span>New Chat</span>
                    </button>
                    
                    <button onClick={() => { setIsProfileModalOpen(true); setIsMenuOpen(false); }} className="flex items-center gap-3 w-full p-3 text-left text-base font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors" title="Open your profile settings">
                         <ProfileIcon />
                         <span>Profile</span>
                    </button>

                    <button onClick={() => { setIsVectorDBModalOpen(true); setIsMenuOpen(false); }} className="flex items-center gap-3 w-full p-3 text-left text-base font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors" title="Manage local vector database">
                         <DatabaseIcon />
                         <span>Vector DB</span>
                    </button>
                    
                    <div className="border-t border-[var(--border-color)] !my-6"></div>

                    <div className="p-3 space-y-2">
                        <div className="flex items-center gap-3" title={reasoningMode === 'fast' ? 'Deep Reason Mode: Fast, low-latency responses' : 'Normal Mode: High-quality, thoughtful responses'}>
                            <BrainIcon />
                            <span className="font-semibold text-gray-700 dark:text-gray-200">Deep Reason</span>
                        </div>
                        <div role="radiogroup" aria-label="Deep Reason Mode" className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-900 rounded-md p-1">
                            <button 
                              onClick={() => setReasoningMode('normal')}
                              role="radio"
                              aria-checked={reasoningMode === 'normal'}
                              className={`flex-1 px-3 py-1.5 text-xs rounded transition-colors ${reasoningMode === 'normal' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-semibold shadow' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-300/50 dark:hover:bg-gray-800'}`}
                              title="High-quality, thoughtful responses"
                            >
                              Normal
                            </button>
                            <button
                              onClick={() => setReasoningMode('fast')}
                              role="radio"
                              aria-checked={reasoningMode === 'fast'}
                              className={`flex-1 px-3 py-1.5 text-xs rounded transition-colors ${reasoningMode === 'fast' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-semibold shadow' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-300/50 dark:hover:bg-gray-800'}`}
                              title="Fast, low-latency responses"
                            >
                              Fast
                            </button>
                        </div>
                    </div>

                    <div className="p-3 space-y-2">
                        <div className="flex items-center gap-3" title="Set the grounding source for responses.">
                            <WebIcon />
                            <span className="font-semibold text-gray-700 dark:text-gray-200">Grounding Source</span>
                        </div>
                         <div role="radiogroup" aria-label="Grounding Source" className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-900 rounded-md p-1">
                            <button 
                              onClick={() => handleSetGroundingMode('disabled')}
                              role="radio"
                              aria-checked={groundingMode === 'disabled'}
                              className={`flex-1 px-3 py-1.5 text-xs rounded transition-colors ${groundingMode === 'disabled' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-semibold shadow' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-300/50 dark:hover:bg-gray-800'}`}
                              title="Standard AI responses without external data"
                            >
                              Disabled
                            </button>
                            <button
                              onClick={() => handleSetGroundingMode('nexus')}
                              role="radio"
                              aria-checked={groundingMode === 'nexus'}
                              className={`flex-1 px-3 py-1.5 text-xs rounded transition-colors ${groundingMode === 'nexus' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-semibold shadow' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-300/50 dark:hover:bg-gray-800'}`}
                              title="Responses grounded with live web search results"
                            >
                              Nexus (Web)
                            </button>
                            <button
                              onClick={() => handleSetGroundingMode('vector')}
                              role="radio"
                              aria-checked={groundingMode === 'vector'}
                              className={`flex-1 px-3 py-1.5 text-xs rounded transition-colors ${groundingMode === 'vector' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-semibold shadow' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-300/50 dark:hover:bg-gray-800'}`}
                              title="Responses grounded with your local documents"
                            >
                              Vector (Local)
                            </button>
                        </div>
                    </div>
                    <div className="border-t border-[var(--border-color)] !my-6"></div>
                    <div>
                        <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2 px-3">History</h3>
                        <nav className="space-y-1">
                            {conversations.sort((a,b) => b.timestamp - a.timestamp).map(convo => {
                                const lastMessageWithContent = [...convo.messages].reverse().find(msg => msg.content.trim());
                                const snippet = lastMessageWithContent
                                ? `${lastMessageWithContent.role === 'user' ? 'You: ' : ''}${lastMessageWithContent.content}`
                                : 'New conversation';

                                return (
                                    <div
                                        key={convo.id}
                                        className={`w-full flex items-center justify-between p-2 rounded-lg group transition-colors duration-200 relative ${activeConversationId === convo.id ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-gray-200/50 dark:hover:bg-gray-800/50'}`}
                                    >
                                        {activeConversationId === convo.id && (
                                        <div className="absolute left-0 top-1 bottom-1 w-1 bg-blue-500 rounded-r-full"></div>
                                        )}
                                        <button
                                            onClick={() => { handleSelectConversation(convo.id); setIsMenuOpen(false); }}
                                            className="flex-1 overflow-hidden text-left pl-2"
                                            aria-current={activeConversationId === convo.id}
                                            aria-label={`Select conversation: ${convo.title}`}
                                            title={`Select conversation: ${convo.title}`}
                                        >
                                            <p className={`text-sm font-semibold truncate ${activeConversationId === convo.id ? 'text-blue-800 dark:text-blue-300' : 'text-gray-800 dark:text-gray-100'}`}>{convo.title}</p>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">{snippet}</p>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteConversation(convo.id)}
                                            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-opacity ml-2 flex-shrink-0"
                                            title="Delete Conversation"
                                            aria-label={`Delete conversation: ${convo.title}`}
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>
                                );
                            })}
                        </nav>
                    </div>
                </div>
            </div>
        </div>
      )}

      <InsightsModal
        isOpen={isInsightsModalOpen}
        onClose={() => setIsInsightsModalOpen(false)}
        isLoading={isInsightsLoading}
        insights={currentInsights}
        error={insightsError}
      />

      <VectorDBModal 
        isOpen={isVectorDBModalOpen}
        onClose={() => setIsVectorDBModalOpen(false)}
        storageKey={vectorDBStorageKey}
      />

      {feedbackMessage && (
        <FeedbackModal
          message={feedbackMessage}
          onClose={() => setFeedbackMessage(null)}
          onSubmit={handleFeedbackSubmit}
        />
      )}

      {isProfileModalOpen && (
        <ProfileModal
          user={user}
          onClose={() => setIsProfileModalOpen(false)}
          onSave={onProfileUpdate}
          onLogout={onLogout}
        />
      )}
    </>
  );
};

export default ChatScreen;