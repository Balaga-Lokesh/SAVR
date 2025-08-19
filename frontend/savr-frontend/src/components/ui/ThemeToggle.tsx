import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const STORAGE_KEY = 'theme';
const CLASS_NAME = 'dark';

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return stored === 'dark' || (stored === null && prefersDark) ? 'dark' : 'light';
  } catch (e) {
    return 'light';
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<string>(() => getInitialTheme());

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add(CLASS_NAME);
    else document.documentElement.classList.remove(CLASS_NAME);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    // sync if system preference changes and user hasn't explicitly set
    const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (!mq || typeof mq.addEventListener !== 'function') return;
    const onChange = (ev: MediaQueryListEvent) => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null) setTheme(ev.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const sun = (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.79 1.8-1.79zM1 13h3v-2H1v2zm10-9h2V1h-2v3zm7.03 1.05l1.79-1.79-1.79-1.79-1.79 1.79 1.79 1.79zM17 13h3v-2h-3v2zM12 8a4 4 0 100 8 4 4 0 000-8zm4.24 8.16l1.8 1.79 1.79-1.79-1.79-1.79-1.8 1.79zM11 23h2v-3h-2v3zM4.24 19.16l-1.79 1.79 1.79 1.79 1.8-1.79-1.8-1.79z"/>
    </svg>
  );

  const moon = (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>
  );

  const button = (
    <button
      id="theme-toggle"
      aria-label="Toggle dark mode"
      aria-pressed={theme === 'dark'}
      title="Toggle dark mode"
      onClick={toggle}
      style={{
        width: 44,
        height: 44,
        padding: 0,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)',
        color: theme === 'dark' ? '#fff' : '#111',
        border: '1px solid rgba(15,23,42,0.06)',
        boxShadow: '0 6px 18px rgba(2,6,23,0.08)',
        backdropFilter: 'blur(4px)',
        cursor: 'pointer'
      }}
    >
      {theme === 'dark' ? moon : sun}
    </button>
  );

  const portalRoot = typeof document !== 'undefined' ? document.getElementById('theme-portal-root') : null;
  if (!portalRoot) return null;
  return createPortal(button, portalRoot);
}
