/**
 * api/gemini.ts — Vercel serverless proxy for Gemini.
 *
 * This is the key-exposure fix. Before, the Gemini API key was inlined
 * into the public client bundle by Vite's define() — anyone could pull
 * it out of the deployed JS. Now:
 *
 *   • The key lives ONLY as the server-side env var GEMINI_API_KEY
 *     (note: NO `VITE_` prefix, so Vite never sees it / never inlines
 *     it into the browser bundle).
 *   • The browser calls POST /api/gemini with the same
 *     { model, contents, config } payload it used to pass straight to
 *     ai.models.generateContent(...).
 *   • This function runs the call server-side and returns only the
 *     fields the client reads back: { text, functionCalls, candidates }.
 *
 * The SDK now exists only on the server — it's no longer shipped to
 * the browser at all.
 */

import { GoogleGenAI } from '@google/genai';

// Vercel Node serverless handler. Loosely typed so we don't need the
// @vercel/node types as a dependency.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // 503 so the client can degrade gracefully ("AI unavailable")
    // instead of crashing.
    res.status(503).json({
      error: 'AI is not configured on this deployment (GEMINI_API_KEY unset).',
    });
    return;
  }

  let payload: { model?: string; contents?: unknown; config?: unknown };
  try {
    payload =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
  } catch {
    res.status(400).json({ error: 'Invalid JSON body.' });
    return;
  }

  const { model, contents, config } = payload;
  if (!model || !contents) {
    res.status(400).json({ error: 'Missing required fields: model, contents.' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: contents as any,
      config: config as any,
    });

    // The SDK response exposes `.text` and `.functionCalls` as getters
    // and `.candidates` as data. Getters don't survive JSON.stringify,
    // so read them explicitly into a plain object the client shim can
    // reconstruct.
    res.status(200).json({
      text: response.text ?? '',
      functionCalls: response.functionCalls ?? [],
      candidates: response.candidates ?? [],
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Gemini request failed.';
    res.status(502).json({ error: message });
  }
}
