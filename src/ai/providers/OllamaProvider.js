import { AIProvider } from './AIProvider.js';
import { parseOllamaStream } from '../ollamaStreamParser.js';

/**
 * OllamaProvider - local Ollama chat API implementation.
 *
 * Requests are routed through a Vite proxy (default: /api/ollama) so the
 * frontend can talk to the local Ollama server without CORS issues.
 */
export class OllamaProvider extends AIProvider {
  /**
   * @param {{ apiUrl?: string, model?: string }} options
   */
  constructor({ apiUrl = '/api/ollama/api/chat', model = 'llama3.2' } = {}) {
    super();
    this.apiUrl = apiUrl;
    this.model = model;
  }

  /**
   * @private
   */
  _buildBody(messages, systemPrompt, stream = false) {
    return {
      model: this.model,
      stream,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    };
  }

  /**
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
      throw new Error(`Ollama API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return { text: data.message?.content ?? '' };
  }

  /**
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
      throw new Error(`Ollama API error ${response.status}: ${errorText}`);
    }

    const text = await parseOllamaStream(response, onChunk);
    return { text };
  }
}
