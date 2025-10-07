import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { User, ReasoningMode, GroundingMode } from '../types';
import { UserIcon } from './icons/UserIcon';
import { UploadIcon } from './icons/UploadIcon';
import { CameraIcon } from './icons/CameraIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { FuturisticLoaderIcon } from './icons/FuturisticLoaderIcon';
import { generateAvatar, DEFAULT_SYSTEM_INSTRUCTION, CREATIVE_WRITER_INSTRUCTION, TECHNICAL_EXPERT_INSTRUCTION } from '../services/geminiService';
import { LogoutIcon } from './icons/LogoutIcon';
import { CloseIcon } from './icons/CloseIcon';
import { SlidersIcon } from './icons/SlidersIcon';
import { RefreshCwIcon } from './icons/RefreshCwIcon';

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onSave: (user: User) => void;
  onLogout: () => void;
}

type EditMode = null | 'upload' | 'camera' | 'generate';

// Fix: Define specific types for persona names to ensure type safety.
type PersonaName = 'Friendly Companion' | 'Creative Writer' | 'Technical Expert';
type PersonaType = PersonaName | 'Custom';

const PREDEFINED_PERSONAS: { name: PersonaName; instruction: string }[] = [
  { name: 'Friendly Companion', instruction: DEFAULT_SYSTEM_INSTRUCTION },
  { name: 'Creative Writer', instruction: CREATIVE_WRITER_INSTRUCTION },
  { name: 'Technical Expert', instruction: TECHNICAL_EXPERT_INSTRUCTION },
];

// Fix: Update the function to return the specific PersonaType instead of a generic string.
const getPersonaType = (instruction: string): PersonaType => {
  const predefined = PREDEFINED_PERSONAS.find(p => p.instruction === instruction);
  return predefined ? predefined.name : 'Custom';
};

export const ProfileModal: React.FC<ProfileModalProps> = ({ user, onClose, onSave, onLogout }) => {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatar, setAvatar] = useState<string | null>(user.avatar);
  const [reasoningMode, setReasoningMode] = useState<ReasoningMode>(user.reasoningMode);
  const [groundingMode, setGroundingMode] = useState<GroundingMode>(user.groundingMode);
  const [systemInstruction, setSystemInstruction] = useState(user.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION);
  // Fix: The initialization is now type-safe because getPersonaType returns the correct, specific type.
  const [selectedPersonaType, setSelectedPersonaType] = useState<PersonaType>(getPersonaType(user.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION));
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

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
      stopCamera();
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [stopCamera, onClose]);

  const handleSave = () => {
    const finalInstruction = selectedPersonaType === 'Custom' ? systemInstruction : PREDEFINED_PERSONAS.find(p => p.name === selectedPersonaType)?.instruction || DEFAULT_SYSTEM_INSTRUCTION;
    const updatedUser: User = { ...user, displayName, avatar, reasoningMode, groundingMode, systemInstruction: finalInstruction };
    onSave(updatedUser);
    onClose();
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
        setEditMode(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraStart = async () => {
    setError('');
    setEditMode('camera');
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } else {
        setError("Your browser does not support camera access.");
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please check permissions.");
      setEditMode(null);
    }
  };

  const handleCapture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext('2d');
      context?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      setAvatar(dataUrl);
      stopCamera();
      setEditMode(null);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt to generate an avatar.");
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const generatedAvatar = await generateAvatar(prompt);
      setAvatar(generatedAvatar);
      setEditMode(null);
      setPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleResetPersona = () => {
    setSelectedPersonaType('Friendly Companion');
    setSystemInstruction(DEFAULT_SYSTEM_INSTRUCTION);
  };

  // Fix: Update handler parameter to use the specific PersonaType.
  const handlePersonaTypeChange = (type: PersonaType) => {
    setSelectedPersonaType(type);
    if (type !== 'Custom') {
        const newInstruction = PREDEFINED_PERSONAS.find(p => p.name === type)?.instruction || DEFAULT_SYSTEM_INSTRUCTION;
        setSystemInstruction(newInstruction);
    }
  };

  const renderEditControls = () => {
    switch(editMode) {
      case 'camera':
        return (
          <div className="mt-4 text-center">
            <video ref={videoRef} autoPlay playsInline className="w-full max-w-xs mx-auto rounded-lg bg-gray-200 dark:bg-gray-900 border border-[var(--border-color)]"></video>
            {error && <p className="text-red-500 dark:text-red-400 text-sm mt-2">{error}</p>}
            <div className="flex justify-center gap-4 mt-4">
                <button onClick={handleCapture} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white font-bold" title="Take photo">Capture</button>
                <button onClick={() => { stopCamera(); setEditMode(null); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-md" title="Cancel camera mode">Cancel</button>
            </div>
          </div>
        );
      case 'generate':
        return (
          <div className="mt-4 space-y-3">
             <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., A robot cat with glowing blue eyes"
              className="w-full px-4 py-2 bg-[rgb(var(--input-bg-rgb))] rounded-md focus:outline-none focus:ring-2 border border-transparent focus:ring-blue-500"
            />
            {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
             <div className="flex justify-center gap-4">
                <button onClick={handleGenerate} disabled={isLoading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white font-bold flex items-center gap-2 disabled:bg-blue-800 transition-colors" title="Generate AI avatar from prompt">
                    {isLoading ? <><FuturisticLoaderIcon/> Generating...</> : 'Generate'}
                </button>
                <button onClick={() => setEditMode(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-md transition-colors" title="Cancel AI generation">Cancel</button>
            </div>
          </div>
        );
      default:
        return (
             <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button onClick={() => fileInputRef.current?.click()} title="Upload an image from your device" className="flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-700">
                    <UploadIcon />
                    <span className="text-xs mt-1">Upload</span>
                </button>
                <button onClick={handleCameraStart} title="Use your camera to take a photo" className="flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-700">
                    <CameraIcon />
                    <span className="text-xs mt-1">Use Camera</span>
                </button>
                <button onClick={() => setEditMode('generate')} title="Generate an avatar using AI" className="flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-700">
                    <SparklesIcon />
                    <span className="text-xs mt-1">Generate AI</span>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            </div>
        );
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        className="w-full max-w-md p-6 bg-[rgb(var(--card-background-rgb))] rounded-lg shadow-xl border border-[var(--border-color)] max-h-[90vh] overflow-y-auto animate-modal-in" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
            <h2 id="profile-modal-title" className="text-2xl font-semibold text-center text-gray-800 dark:text-gray-200">Edit Profile</h2>
            <button onClick={onClose} aria-label="Close profile editor" title="Close" className="text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400">
                <CloseIcon/>
            </button>
        </div>
        
        <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center border-2 border-blue-200 dark:border-blue-800 overflow-hidden shadow-md">
                <UserIcon avatar={avatar} />
            </div>
            {renderEditControls()}
        </div>

        <div className="mt-6 space-y-4">
            <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Display Name</label>
                <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-2 bg-[rgb(var(--input-bg-rgb))] rounded-md focus:outline-none focus:ring-2 border border-transparent focus:ring-blue-500"
                />
            </div>
             <div role="radiogroup" aria-labelledby="reasoning-mode-label">
              <span id="reasoning-mode-label" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Default Reasoning Mode</span>
              <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-900/70 rounded-md p-1">
                <button 
                  onClick={() => setReasoningMode('normal')}
                  role="radio"
                  aria-checked={reasoningMode === 'normal'}
                  title="Default to high-quality, thoughtful responses."
                  className={`flex-1 px-3 py-1.5 text-sm rounded transition-colors ${reasoningMode === 'normal' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-semibold shadow' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                >
                  Normal (Quality)
                </button>
                <button
                  onClick={() => setReasoningMode('fast')}
                  role="radio"
                  aria-checked={reasoningMode === 'fast'}
                  title="Default to fast, low-latency responses."
                  className={`flex-1 px-3 py-1.5 text-sm rounded transition-colors ${reasoningMode === 'fast' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-semibold shadow' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                >
                  Fast (Speed)
                </button>
              </div>
            </div>
            <div role="radiogroup" aria-labelledby="grounding-mode-label">
              <span id="grounding-mode-label" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Default Grounding Source</span>
              <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-900/70 rounded-md p-1">
                <button 
                  onClick={() => setGroundingMode('disabled')}
                   role="radio"
                  aria-checked={groundingMode === 'disabled'}
                  title="Default to standard AI responses without external data."
                  className={`flex-1 px-3 py-1.5 text-xs rounded transition-colors ${groundingMode === 'disabled' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-semibold shadow' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                >
                  Disabled
                </button>
                <button
                  onClick={() => setGroundingMode('nexus')}
                   role="radio"
                  aria-checked={groundingMode === 'nexus'}
                  title="Default to responses grounded with live web search results."
                  className={`flex-1 px-3 py-1.5 text-xs rounded transition-colors ${groundingMode === 'nexus' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-semibold shadow' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                >
                  Nexus (Web)
                </button>
                <button
                  onClick={() => setGroundingMode('vector')}
                   role="radio"
                  aria-checked={groundingMode === 'vector'}
                  title="Default to responses grounded with your local documents."
                  className={`flex-1 px-3 py-1.5 text-xs rounded transition-colors ${groundingMode === 'vector' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-semibold shadow' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                >
                  Vector (Local)
                </button>
              </div>
            </div>
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                        <SlidersIcon />
                        <span>Default AI Persona</span>
                    </label>
                    <button onClick={handleResetPersona} title="Reset persona to Friendly Companion" className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                        <RefreshCwIcon />
                        <span>Reset to Default</span>
                    </button>
                </div>

                <fieldset className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                    <legend className="sr-only">Select AI Persona</legend>
                    {[...PREDEFINED_PERSONAS, { name: 'Custom' as const, instruction: '' }].map(persona => (
                        <div key={persona.name}>
                            <input
                                type="radio"
                                id={`persona-type-${persona.name.replace(/\s+/g, '-')}`}
                                name="persona-type-selector"
                                value={persona.name}
                                checked={selectedPersonaType === persona.name}
                                onChange={() => handlePersonaTypeChange(persona.name)}
                                className="sr-only"
                            />
                            <label
                                htmlFor={`persona-type-${persona.name.replace(/\s+/g, '-')}`}
                                title={`Set default persona to ${persona.name}`}
                                className={`w-full block text-center px-3 py-1.5 text-xs rounded-md transition-colors border cursor-pointer ${
                                    selectedPersonaType === persona.name
                                        ? 'bg-blue-600 text-white font-semibold shadow border-transparent'
                                        : 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600'
                                }`}
                            >
                                {persona.name}
                            </label>
                        </div>
                    ))}
                </fieldset>

                <textarea
                    id="systemInstruction"
                    rows={5}
                    value={systemInstruction}
                    onChange={(e) => {
                        setSystemInstruction(e.target.value);
                        setSelectedPersonaType('Custom');
                    }}
                    placeholder={DEFAULT_SYSTEM_INSTRUCTION}
                    readOnly={selectedPersonaType !== 'Custom'}
                    aria-label="Custom AI persona instructions"
                    className={`w-full px-3 py-2 bg-[rgb(var(--input-bg-rgb))] rounded-md focus:outline-none focus:ring-2 text-sm border border-transparent focus:ring-blue-500 resize-y ${selectedPersonaType !== 'Custom' ? 'cursor-not-allowed opacity-70' : ''}`}
                />
            </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <button 
            onClick={onLogout} 
            title="Logout"
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
          >
            <LogoutIcon />
            <span>Logout</span>
          </button>
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="px-4 py-2 font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white rounded-md" title="Discard changes and close">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold transition-colors shadow-lg shadow-blue-500/20" title="Save your profile changes">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
};