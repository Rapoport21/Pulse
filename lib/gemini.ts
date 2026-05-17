/**
 * lib/gemini.ts — client-side Gemini access via the server proxy.
 *
 * The Gemini API key NO LONGER touches the browser. This module used
 * to construct a `GoogleGenAI` client with an inlined key; now it
 * returns a thin shim whose `models.generateContent(...)` POSTs to
 * `/api/gemini` (see api/gemini.ts), which runs the real call
 * server-side with the server-only GEMINI_API_KEY.
 *
 * The shim deliberately mirrors the exact shape consumers already use
 * (`ai.models.generateContent({ model, contents, config })` returning
 * `{ text, functionCalls, candidates }`) so ChatAssistant and
 * StaffManagementModal need zero changes.
 */

// Kept for backward-compat with any importer; the key is no longer
// available (or needed) client-side. Always returns ''.
export function getGeminiApiKey(): string {
  return '';
}

interface GenerateContentRequest {
  model: string;
  contents: unknown;
  config?: unknown;
}

interface GenerateContentResponse {
  text: string;
  functionCalls: Array<{
    id?: string;
    name?: string;
    args?: Record<string, unknown>;
  }>;
  candidates: Array<{ content?: { parts?: unknown[] } }>;
}

/** Minimal client surface — same shape consumers were using. */
export interface GeminiProxyClient {
  models: {
    generateContent: (
      req: GenerateContentRequest,
    ) => Promise<GenerateContentResponse>;
  };
}

export interface GeminiClientResult {
  client: GeminiProxyClient | null;
  error: string | null;
}

const proxyClient: GeminiProxyClient = {
  models: {
    async generateContent(req: GenerateContentRequest) {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (!res.ok) {
        let detail = `Gemini proxy returned ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) detail = body.error;
        } catch {
          /* non-JSON error body — keep the status-code message */
        }
        throw new Error(detail);
      }

      return (await res.json()) as GenerateContentResponse;
    },
  },
};

/**
 * Returns the proxy-backed client. We can't know from the browser
 * whether the server has GEMINI_API_KEY set, so the client is always
 * non-null; if the server is unconfigured, the first call rejects
 * with a 503 message and the calling UI's existing error handling
 * surfaces it. This keeps the consumer contract unchanged.
 */
export function createGeminiClient(): GeminiClientResult {
  return { client: proxyClient, error: null };
}
