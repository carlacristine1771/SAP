import { useCallback, useEffect, useState } from 'react';

const THEME_COOKIE = 'sap_theme';

function readCookie(name) {
  return document.cookie.split('; ').reduce((value, part) => {
    const [key, ...rest] = part.split('=');
    return key === name ? decodeURIComponent(rest.join('=')) : value;
  }, '');
}

function saveTheme(theme) {
  document.cookie = `${THEME_COOKIE}=${encodeURIComponent(theme)}; path=/; max-age=31536000; SameSite=Lax`;
}

export function useTheme() {
  const [theme, setTheme] = useState(() => readCookie(THEME_COOKIE) || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#0d1320' : '#F4F1EC',
    );
    saveTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
