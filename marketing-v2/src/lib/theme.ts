import { useEffect, useState, useCallback } from 'react';

/**
 * Aesthetic theme system. Themes live in CSS as `[data-theme="..."]`
 * attribute selectors on `<html>`. Switching is just an attribute swap —
 * components don't need to re-render or know which theme is active.
 *
 * Persisted in localStorage so the choice survives reloads.
 */

export type Theme = 'tactical' | 'editorial' | 'brutalist' | 'documentary';

export const THEMES: Record<
  Theme,
  { id: Theme; label: string; description: string; status: 'ready' | 'stub' }
> = {
  tactical: {
    id: 'tactical',
    label: 'Tactical · Restraint',
    description:
      'Near-black canvas, Geist sans, rose-600 accent, sharp 2px radii. Default.',
    status: 'ready',
  },
  editorial: {
    id: 'editorial',
    label: 'Editorial · Clinical',
    description:
      'Warm white, Spectral serif headlines, NEJM × Linear restraint. Light theme.',
    status: 'ready',
  },
  brutalist: {
    id: 'brutalist',
    label: 'Brutalist · Mechanical',
    description:
      'Pure b/w, all monospace, flat slabs, no glow, no glass. Maximum density.',
    status: 'ready',
  },
  documentary: {
    id: 'documentary',
    label: 'Documentary · Photographic',
    description:
      'Tungsten-warm cinematic treatment, film grain, atmospheric corridors.',
    status: 'ready',
  },
};

const STORAGE_KEY = 'pulse-marketing-theme';

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'tactical';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && v in THEMES) return v as Theme;
  } catch {
    /* private mode etc. */
  }
  return 'tactical';
}

export function useTheme(): {
  theme: Theme;
  setTheme: (t: Theme) => void;
} {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());

  // Apply theme to <html> on mount AND whenever it changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  return { theme, setTheme };
}
