import { useState, useRef, useCallback } from 'react';
// ── Profanity filter ────────────────────────────────────────────────────────
// Applied here in the chat hook as the first line of defence. If a message
// contains offensive language the user sees an immediate warning, and the
// cleaned (censored) version of the message is forwarded to the AI.
// A second filter layer also runs inside AIService._prepareMessages() for
// defence-in-depth.
import { cleanMessage, containsProfanity } from '../utils/profanityFilter.js';

/** Maximum number of messages kept in the AI's conversation history. */
const MAX_HISTORY = 20;

/** Warning shown to the user when profanity is detected. */
const PROFANITY_WARNING = 'Please avoid offensive language. Your message has been filtered.';

/**
 * useAIChat — React hook that manages AI chat state and streaming.
 *
 * @param {{
 *   aiService: import('../ai/aiService.js').AIService,
 *   contextData: object,
 * }} options
 *
 * @returns {{
 *   messages: Array<{ role: 'you' | 'ai' | 'system', text: string }>,
 *   sendMessage: (text: string) => Promise<void>,
 *   addNotification: (text: string) => void,
 *   isStreaming: boolean,
 *   error: string | null,
 *   abortResponse: () => void,
 * }}
 *
 * Usage in a component:
 *   const { messages, sendMessage, addNotification, isStreaming, abortResponse } = useAIChat({
 *     aiService,
 *     contextData: { sceneInstances, scriptsByInstanceKey, ... },
 *   });
 *
 * Notes:
 * - `sendMessage` triggers a real AI stream. The AI response updates in-place as chunks arrive.
 * - `addNotification` appends a system message (e.g. "Added block to Bunny") without calling the AI.
 * - System messages are shown in the UI but excluded from conversation history sent to the AI.
 * - Sending a new message while one is streaming will abort the in-flight request first.
 * - PROFANITY FILTER: If the user's message contains offensive words, a system
 *   warning is shown and the offensive words are replaced with "****" before the
 *   message is forwarded to the AI.
 */
export function useAIChat({ aiService, contextData }) {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);

  /** Ref to the current AbortController so we can cancel in-flight requests. */
  const abortControllerRef = useRef(null);

  /**
   * Append a system notification message (no AI call triggered).
   * These appear in the chat UI but are excluded from the conversation
   * history sent to the AI.
   */
  const addNotification = useCallback((text) => {
    setMessages((prev) => [...prev, { role: 'system', text }]);
  }, []);

  /** Cancel any in-flight AI stream. */
  const abortResponse = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  /**
   * Send a user message and stream the AI response.
   * @param {string} text - the user's message
   */
  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim()) return;

      // ── Profanity filter (first line of defence) ──────────────────────
      // Check the raw input for offensive language. If detected:
      //   1. Show a system warning so the user knows their message was filtered
      //   2. Replace offensive words with "****" in the message that is displayed
      //      and forwarded to the AI
      const rawText = text.trim();
      const hasProfanity = containsProfanity(rawText);
      const safeText = hasProfanity ? cleanMessage(rawText) : rawText;

      // Abort any in-flight stream before starting a new one
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Append user message (cleaned if necessary) and a placeholder for the AI response
      const userMessage = { role: 'you', text: safeText };
      const aiPlaceholder = { role: 'ai', text: '' };

      setMessages((prev) => {
        const next = [...prev];
        // If profanity was detected, insert a system warning before the user message
        if (hasProfanity) {
          next.push({ role: 'system', text: PROFANITY_WARNING });
        }
        next.push(userMessage, aiPlaceholder);
        return next;
      });
      setIsStreaming(true);
      setError(null);

      try {
        // Build conversation history for the AI (exclude system notifications,
        // and apply sliding window to avoid exceeding token limits)
        const historySnapshot = await new Promise((resolve) => {
          setMessages((prev) => {
            const aiMessages = prev.filter(
              (m) => (m.role === 'you' || m.role === 'ai') && m.text !== ''
            );
            // Sliding window: keep last MAX_HISTORY messages (includes the new user msg we just added)
            const windowed = aiMessages.slice(-MAX_HISTORY);
            resolve(windowed);
            return prev; // No state change — just reading
          });
        });

        // Track how many chars we've accumulated so we can update the placeholder
        let accumulated = '';

        await aiService.stream({
          messages: historySnapshot,
          contextData,
          signal: controller.signal,
          onChunk: (delta) => {
            accumulated += delta;
            // Update the last message (the AI placeholder) in-place
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (updated[lastIdx]?.role === 'ai') {
                updated[lastIdx] = { role: 'ai', text: accumulated };
              }
              return updated;
            });
          },
        });
      } catch (err) {
        if (err.name === 'AbortError') {
          // User aborted — leave whatever text was streamed in place
          return;
        }
        console.error('[useAIChat] Stream error:', err);
        const errorMessage = "Hmm, I couldn't reach my brain right now! Try again in a moment 🤔";
        setError(err.message ?? 'Unknown error');
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === 'ai') {
            updated[lastIdx] = { role: 'ai', text: errorMessage };
          }
          return updated;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [aiService, contextData]
  );

  return {
    messages,
    sendMessage,
    addNotification,
    isStreaming,
    error,
    abortResponse,
  };
}
