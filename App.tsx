import React, { useState, useCallback, useEffect } from 'react';
import AuthScreen from './components/AuthScreen';
import ChatScreen from './components/ChatScreen';
import type { User } from './types';
import { DEFAULT_SYSTEM_INSTRUCTION } from './services/geminiService';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    // Check if a user is logged in from a previous session
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    if (loggedInUser) {
        const users: User[] = JSON.parse(localStorage.getItem('users') || '[]');
        const user = users.find(u => u.username === loggedInUser);
        if (user) {
            // Add default reasoning and grounding modes for older user objects for backward compatibility
            const userWithDefaults: User = {
              ...user,
              reasoningMode: user.reasoningMode || 'normal',
              groundingMode: user.groundingMode || 'disabled',
              systemInstruction: user.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
            };
            setCurrentUser(userWithDefaults);
        }
    }
  }, []);

  const handleAuthSuccess = useCallback((user: User) => {
    // Ensure new logins also have the default modes
    const userWithDefaults: User = {
      ...user,
      reasoningMode: user.reasoningMode || 'normal',
      groundingMode: user.groundingMode || 'disabled',
      systemInstruction: user.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
    };
    setCurrentUser(userWithDefaults);
    sessionStorage.setItem('loggedInUser', userWithDefaults.username);
  }, []);
  
  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    sessionStorage.removeItem('loggedInUser');
  }, []);

  const handleProfileUpdate = useCallback((updatedUser: User) => {
    setCurrentUser(updatedUser);
    const users: User[] = JSON.parse(localStorage.getItem('users') || '[]');
    const userIndex = users.findIndex(u => u.username === updatedUser.username);
    if (userIndex !== -1) {
      users[userIndex] = updatedUser;
      localStorage.setItem('users', JSON.stringify(users));
    }
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col items-center overflow-hidden">
       <main className="w-full max-w-6xl mx-auto flex-grow flex flex-col z-10 p-4 overflow-hidden">
        {currentUser ? (
          <ChatScreen 
            user={currentUser} 
            onLogout={handleLogout} 
            onProfileUpdate={handleProfileUpdate}
            theme={theme}
            onThemeToggle={toggleTheme}
          />
        ) : (
          <AuthScreen onAuthSuccess={handleAuthSuccess} />
        )}
      </main>
      <footer className="w-full text-center text-xs text-gray-400 dark:text-gray-600 p-2 z-10">
        powered by favex 2025
      </footer>
    </div>
  );
};

export default App;