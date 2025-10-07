import React from 'react';
import { LogoIcon } from './icons/LogoIcon';

export const Logo: React.FC = () => (
  <div className="flex items-center gap-2">
    <LogoIcon />
    <h1 className="text-2xl font-orbitron font-bold text-gray-800 dark:text-gray-100">
      FAV AI
    </h1>
  </div>
);