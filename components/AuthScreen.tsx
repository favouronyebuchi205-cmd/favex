import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AuthMode, User } from '../types';
import { EyeIcon } from './icons/EyeIcon';
import { EyeOffIcon } from './icons/EyeOffIcon';
import { GoogleIcon } from './icons/GoogleIcon';
import { CloseIcon } from './icons/CloseIcon';
import { UserIcon } from './icons/UserIcon';
import { DEFAULT_SYSTEM_INSTRUCTION } from '../services/geminiService';
import { Logo } from './Logo';


interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
}

interface Errors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

interface MockGoogleAccount {
  email: string;
  displayName: string;
  avatar: null;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<AuthMode>(AuthMode.Login);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleAccountsToShow, setGoogleAccountsToShow] = useState<MockGoogleAccount[]>([]);
  const googleModalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (isGoogleModalOpen) {
      triggerRef.current = document.activeElement;
      const knownAccounts: MockGoogleAccount[] = JSON.parse(localStorage.getItem('knownGoogleAccounts') || '[]');
      const firstNames = ['Alex', 'Jordan', 'Casey', 'Taylor', 'Morgan', 'Sam', 'Pat'];
      const lastNames = ['Smith', 'Jones', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson'];
      const generatedAccounts: MockGoogleAccount[] = [];
      const existingEmails = new Set(knownAccounts.map(a => a.email));
      while (generatedAccounts.length < 2 && generatedAccounts.length + knownAccounts.length < 5) {
          const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
          const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
          const displayName = `${firstName} ${lastName}`;
          const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 100)}@gmail.com`;
          if (!existingEmails.has(email)) {
              generatedAccounts.push({ email, displayName, avatar: null });
              existingEmails.add(email);
          }
      }
      setGoogleAccountsToShow([...knownAccounts, ...generatedAccounts]);

      const modalNode = googleModalRef.current;
      if (!modalNode) return;

      const focusableElements = modalNode.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      if (firstElement) {
        firstElement.focus();
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setIsGoogleModalOpen(false);
        if (event.key === 'Tab') {
          const lastElement = focusableElements[focusableElements.length - 1];
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
  }, [isGoogleModalOpen]);


  const validate = useCallback(() => {
    const newErrors: Errors = {};
    const users: User[] = JSON.parse(localStorage.getItem('users') || '[]');

    if (mode === AuthMode.SignUp) {
      if (!username) {
        newErrors.username = 'Username is required.';
      } else if (users.some(u => u.username === username)) {
        newErrors.username = 'Username is already taken.';
      }
    }

    if (!email) {
      newErrors.email = 'Email is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
    } else if (mode === AuthMode.SignUp && users.some(u => u.email === email)) {
        newErrors.email = 'An account with this email already exists.';
    }
    
    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (mode === AuthMode.SignUp) {
        if (password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters long.';
        } else if (!/(?=.*[a-z])/.test(password)) {
            newErrors.password = 'Password must contain a lowercase letter.';
        } else if (!/(?=.*[A-Z])/.test(password)) {
            newErrors.password = 'Password must contain an uppercase letter.';
        } else if (!/(?=.*\d)/.test(password)) {
            newErrors.password = 'Password must contain a number.';
        }
    }
    
    if (mode === AuthMode.SignUp) {
        if (!confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password.';
        } else if (password && password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match.';
        }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [mode, username, email, password, confirmPassword]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      const users: User[] = JSON.parse(localStorage.getItem('users') || '[]');
      
      if (mode === AuthMode.SignUp) {
        // In a real app, never store plaintext passwords. This is for demonstration only.
        const newUser: User = {
          username,
          email,
          password,
          displayName: username,
          avatar: null,
          reasoningMode: 'normal',
          groundingMode: 'disabled',
          systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
        };
        localStorage.setItem('users', JSON.stringify([...users, newUser]));
        const { password: _, ...userToReturn } = newUser;
        onAuthSuccess(userToReturn);

      } else { // Login mode
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
          const { password: _, ...userToReturn } = user;
          onAuthSuccess(userToReturn);
        } else {
          setErrors({ general: 'Invalid credentials. Please try again.' });
        }
      }
    }
  }, [validate, mode, username, email, password, onAuthSuccess]);
  
  const handleGoogleAccountSelect = useCallback((account: MockGoogleAccount) => {
    const users: User[] = JSON.parse(localStorage.getItem('users') || '[]');
    let user = users.find(u => u.email === account.email);

    // "Remember" this account for next time to simulate device accounts
    const knownAccounts: MockGoogleAccount[] = JSON.parse(localStorage.getItem('knownGoogleAccounts') || '[]');
    if (!knownAccounts.some(a => a.email === account.email)) {
        knownAccounts.push(account);
        localStorage.setItem('knownGoogleAccounts', JSON.stringify(knownAccounts));
    }

    if (user) {
      // User exists, log them in
      const { password: _, ...userToReturn } = user;
      onAuthSuccess(userToReturn);
    } else {
      // User does not exist, create a new account
      const newUser: User = {
        username: account.email.split('@')[0].replace(/[^\w]/g, '_'), // Create a simple, valid username
        email: account.email,
        displayName: account.displayName,
        avatar: null,
        reasoningMode: 'normal',
        groundingMode: 'disabled',
        systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
      };
      localStorage.setItem('users', JSON.stringify([...users, newUser]));
      onAuthSuccess(newUser);
    }

    setIsGoogleModalOpen(false);
  }, [onAuthSuccess]);

  const clearFormState = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setErrors({});
  }

  useEffect(() => {
    clearFormState();
  }, [mode]);


  return (
    <>
      <div className="flex-grow flex items-center justify-center">
        <div className="w-full max-w-md p-8 bg-[rgb(var(--card-background-rgb))] rounded-lg shadow-xl border border-[var(--border-color)] overflow-y-auto max-h-full">
          <div className="text-center mb-8">
            <Logo />
            <p className="text-gray-500 dark:text-gray-400 mt-2">Welcome back</p>
          </div>
          

          <div className="flex justify-center mb-6 border-b border-[var(--border-color)]">
            <button
              onClick={() => setMode(AuthMode.Login)}
              className={`px-6 py-2 text-lg font-medium transition-all duration-300 relative ${mode === AuthMode.Login ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
              role="tab"
              aria-selected={mode === AuthMode.Login}
              title="Switch to Login view"
            >
              Login
              {mode === AuthMode.Login && <div className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400"></div>}
            </button>
            <button
              onClick={() => setMode(AuthMode.SignUp)}
              className={`px-6 py-2 text-lg font-medium transition-all duration-300 relative ${mode === AuthMode.SignUp ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
              role="tab"
              aria-selected={mode === AuthMode.SignUp}
              title="Switch to Sign Up view"
            >
              Sign Up
               {mode === AuthMode.SignUp && <div className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400"></div>}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === AuthMode.SignUp && (
              <div>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full px-4 py-3 bg-[rgb(var(--input-bg-rgb))] rounded-md focus:outline-none focus:ring-2 border transition-all ${errors.username ? 'border-red-500 ring-red-500' : 'border-transparent focus:ring-blue-500 focus:border-blue-500'}`}
                  aria-invalid={!!errors.username}
                  aria-describedby={errors.username ? "username-error" : undefined}
                />
                {errors.username && <p id="username-error" className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.username}</p>}
              </div>
            )}
            <div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-3 bg-[rgb(var(--input-bg-rgb))] rounded-md focus:outline-none focus:ring-2 border transition-all ${errors.email ? 'border-red-500 ring-red-500' : 'border-transparent focus:ring-blue-500 focus:border-blue-500'}`}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && <p id="email-error" className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.email}</p>}
            </div>
            <div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-4 py-3 pr-12 bg-[rgb(var(--input-bg-rgb))] rounded-md focus:outline-none focus:ring-2 border transition-all ${errors.password ? 'border-red-500 ring-red-500' : 'border-transparent focus:ring-blue-500 focus:border-blue-500'}`}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {errors.password && <p id="password-error" className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.password}</p>}
            </div>
            {mode === AuthMode.SignUp && (
              <div>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full px-4 py-3 pr-12 bg-[rgb(var(--input-bg-rgb))] rounded-md focus:outline-none focus:ring-2 border transition-all ${errors.confirmPassword ? 'border-red-500 ring-red-500' : 'border-transparent focus:ring-blue-500 focus:border-blue-500'}`}
                      aria-invalid={!!errors.confirmPassword}
                      aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(prev => !prev)}
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
                      aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                      title={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                    >
                      {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p id="confirm-password-error" className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.confirmPassword}</p>}
                </div>
            )}
            {errors.general && <p className="text-red-500 dark:text-red-400 text-sm text-center mt-2">{errors.general}</p>}
            <button
              type="submit"
              className="w-full py-3 mt-6 font-semibold text-lg bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40"
              title={mode === AuthMode.Login ? 'Log into your account' : 'Create your new account'}
            >
              {mode === AuthMode.Login ? 'Login' : 'Create Account'}
            </button>
          </form>

          <div className="flex items-center my-6">
              <div className="flex-grow border-t border-[var(--border-color)]"></div>
              <span className="flex-shrink mx-4 text-gray-500 dark:text-gray-400 text-sm">OR</span>
              <div className="flex-grow border-t border-[var(--border-color)]"></div>
          </div>

          <button
              type="button"
              onClick={() => setIsGoogleModalOpen(true)}
              className="w-full py-3 flex items-center justify-center gap-3 font-semibold text-base bg-white hover:bg-gray-100 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 border border-[var(--border-color)] rounded-md transition-all duration-300"
              title="Sign in or sign up using a Google account"
          >
              <GoogleIcon />
              <span>Continue with Google</span>
          </button>

        </div>
      </div>
      
      {isGoogleModalOpen && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setIsGoogleModalOpen(false)}
        >
          <div 
            ref={googleModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="google-modal-title"
            className="w-full max-w-sm p-6 bg-[rgb(var(--card-background-rgb))] rounded-lg shadow-xl border border-[var(--border-color)] overflow-y-auto max-h-[90%] animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 id="google-modal-title" className="text-xl font-semibold text-gray-800 dark:text-gray-200">Choose an account</h2>
              <button 
                onClick={() => setIsGoogleModalOpen(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
                aria-label="Close account selection"
                title="Close"
              >
                <CloseIcon/>
              </button>
            </div>
            <div className="space-y-3">
              {googleAccountsToShow.map(account => (
                <button
                  key={account.email}
                  onClick={() => handleGoogleAccountSelect(account)}
                  className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-left"
                  title={`Continue as ${account.displayName}`}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center border border-blue-200 dark:border-blue-800 overflow-hidden">
                    <UserIcon avatar={account.avatar} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{account.displayName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{account.email}</p>
                  </div>
                </button>
              ))}
              {googleAccountsToShow.length === 0 && (
                 <p className="text-center text-gray-500 dark:text-gray-400 py-4">No accounts to display.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AuthScreen;