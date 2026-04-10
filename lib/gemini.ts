import { GoogleGenAI } from '@google/genai';

/**
 * Reads the Gemini key from Vite's import.meta.env, with legacy fallbacks.
 * Returns an empty string when nothing is configured — callers must guard.
 */
export function getGeminiApiKey(): string {
  // Vite injects import.meta.env at build time. Use bracket access to keep
  // TS happy without a vite/client reference.
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
  return (
    env.VITE_GEMINI_API_KEY ||
    env.GEMINI_API_KEY ||
    // Legacy define() fallback from vite.config.ts
    (typeof process !== 'undefined' ? (process as { env?: Record<string, string | undefined> }).env?.API_KEY || '' : '') ||
    ''
  );
}

export interface GeminiClientResult {
  client: GoogleGenAI | null;
  error: string | null;
}

/**
 * Constructs a Gemini client safely. If the key is missing or the SDK throws
 * during construction, returns { client: null, error } so the UI can degrade
 * to a disabled state instead of crashing.
 */
export function createGeminiClient(): GeminiClientResult {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return {
      client: null,
      error: 'Gemini API key is not configured (VITE_GEMINI_API_KEY).',
    };
  }
  try {
    const client = new GoogleGenAI({ apiKey });
    return { client, error: null };
  } catch (err) {
    return {
      client: null,
      error: err instanceof Error ? err.message : 'Failed to initialize Gemini client.',
    };
  }
}
