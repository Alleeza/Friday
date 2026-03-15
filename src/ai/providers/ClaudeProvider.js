import { AIProvider } from './AIProvider.js';
import { parseSSEStream } from '../streamParser.js';

/**
 * ClaudeProvider — Anthropic Claude API implementation.
 *
 * Routes requests through a server-side proxy (default: /api/claude/messages) so that
 * the API key never reaches the browser. In local dev this is handled by Vite;
 * in production it is handled by the deployed API route.
 *
 * Usage:
 *   const provider = new ClaudeProvider();
 *   // or with custom options:
 *   const provider = new ClaudeProvider({ model: 'claude-sonnet-4-20250514', apiUrl: '/api/claude/messages' });
 */
export class ClaudeProvider extends AIProvider {
  /**
   * @param {{ apiUrl?: string, model?: string, maxTokens?: number }} options
   */
  constructor({ apiUrl = '/api/claude/messages', model = 'claude-sonnet-4-20250514', maxTokens = 1024 } = {}) {
    super();
    this.apiUrl = apiUrl;
    this.model = model;
    this.maxTokens = maxTokens;
  }

  /**
   * Builds the request body for the Claude Messages API.
   * @private
   */
  _buildBody(messages, systemPrompt, stream = false) {
    return {
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages,
      stream,
    };
  }

  /**
   * Send a single non-streaming message.
   * @param {{ messages: {role: string, content: string}[], systemPrompt: string, signal?: AbortSignal }} options
   * @returns {Promise<{ text: string }>}
   */
  async sendMessage({ messages, systemPrompt, signal }) {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this._buildBody(messages, systemPrompt, false)),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Claude API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '';
    return { text };
  }

  /**
   * Stream a response, calling onChunk for each text delta as it arrives.
   * @param {{ messages: {role: string, content: string}[], systemPrompt: string, onChunk: (delta: string) => void, signal?: AbortSignal }} options
   * @returns {Promise<{ text: string }>}
   */
  async streamMessage({ messages, systemPrompt, onChunk, signal }) {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this._buildBody(messages, systemPrompt, true)),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Claude API error ${response.status}: ${errorText}`);
    }

    const text = await parseSSEStream(response, onChunk);
    return { text };
  }
}
