import { buildSystemPrompt } from './context/systemPrompt.js';
import { buildContext } from './context/contextBuilder.js';

/**
 * AIService — facade that wires together a provider, the system prompt,
 * and the workspace context builder.
 *
 * This is the single entry point for all AI interactions. It is completely
 * decoupled from React — pass it a provider instance and call stream/send.
 *
 * To swap providers, simply instantiate a different provider:
 *   const service = new AIService(new ClaudeProvider());
 *   const service = new AIService(new OpenAIProvider()); // future
 *
 * Message format used by this service (app-internal):
 *   { role: 'you' | 'ai' | 'system', text: string }
 *
 * These are converted to provider format ({ role: 'user'|'assistant', content })
 * internally — consumers don't need to know about provider-specific shapes.
 */
export class AIService {
  /**
   * @param {import('./providers/AIProvider.js').AIProvider} provider
   */
  constructor(provider) {
    this.provider = provider;
    this._systemPrompt = buildSystemPrompt();
  }

  /**
   * Converts app-internal messages to provider-agnostic format and
   * injects workspace context into the latest user message.
   *
   * @param {Array<{ role: string, text: string }>} messages - app messages (excludes system notifications)
   * @param {string} contextString - serialized workspace context
   * @returns {Array<{ role: 'user'|'assistant', content: string }>}
   * @private
   */
  _prepareMessages(messages, contextString) {
    const mapped = messages
      .filter((m) => m.role === 'you' || m.role === 'ai')
      .map((m) => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.text,
      }));

    // Inject workspace context into the last user message
    if (contextString && mapped.length > 0) {
      const last = mapped[mapped.length - 1];
      if (last.role === 'user') {
        last.content = `${last.content}\n\n[WORKSPACE CONTEXT]\n${contextString}`;
      }
    }

    return mapped;
  }

  /**
   * Stream a response chunk-by-chunk.
   *
   * @param {{
   *   messages: Array<{ role: string, text: string }>,
   *   contextData: object,
   *   onChunk: (delta: string) => void,
   *   signal?: AbortSignal,
   * }} options
   * @returns {Promise<{ text: string }>}
   */
  async stream({ messages, contextData, onChunk, signal }) {
    const contextString = buildContext(contextData);
    const providerMessages = this._prepareMessages(messages, contextString);

    return this.provider.streamMessage({
      messages: providerMessages,
      systemPrompt: this._systemPrompt,
      onChunk,
      signal,
    });
  }

  /**
   * Send a message and return the full response (non-streaming).
   *
   * @param {{
   *   messages: Array<{ role: string, text: string }>,
   *   contextData: object,
   *   signal?: AbortSignal,
   * }} options
   * @returns {Promise<{ text: string }>}
   */
  async send({ messages, contextData, signal }) {
    const contextString = buildContext(contextData);
    const providerMessages = this._prepareMessages(messages, contextString);

    return this.provider.sendMessage({
      messages: providerMessages,
      systemPrompt: this._systemPrompt,
      signal,
    });
  }
}
