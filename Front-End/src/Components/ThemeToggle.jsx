import React from 'react';
import { useTheme } from '../hooks/useTheme';

const ThemeToggle = () => {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors duration-200"
      aria-label="Toggle Theme"
      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}
    >
      {isDarkMode ? '☀️' : '🌙'}
    </button>
  );
};

export default ThemeToggle;