/**
 * AIProvider — abstract base class (strategy pattern).
 * All AI provider implementations must extend this class.
 *
 * Usage:
 *   class MyProvider extends AIProvider {
 *     async sendMessage(options) { ... }
 *     async streamMessage(options) { ... }
 *   }
 */
export class AIProvider {
  /**
   * Send a single message and return the full response.
   *
   * @param {{ messages: {role: string, content: string}[], systemPrompt: string, signal?: AbortSignal }} options
   * @returns {Promise<{ text: string }>}
   */
  // eslint-disable-next-line no-unused-vars
  async sendMessage(options) {
    throw new Error(`${this.constructor.name} must implement sendMessage()`);
  }

  /**
   * Stream a response, calling onChunk for each text delta.
   *
   * @param {{ messages: {role: string, content: string}[], systemPrompt: string, onChunk: (delta: string) => void, signal?: AbortSignal }} options
   * @returns {Promise<{ text: string }>} resolves with full assembled text when stream ends
   */
  // eslint-disable-next-line no-unused-vars
  async streamMessage(options) {
    throw new Error(`${this.constructor.name} must implement streamMessage()`);
  }
}
