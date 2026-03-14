import { ClaudeProvider } from './providers/ClaudeProvider.js';
import { OllamaProvider } from './providers/OllamaProvider.js';
import { getDefaultModelForProvider, getDefaultProviderName } from './providerCatalog.js';

/**
 * Creates a raw AI provider suitable for use with PlanningService.
 *
 * Unlike createDefaultAIService(), this returns the provider directly (not
 * wrapped in AIService) because PlanningService calls provider.sendMessage()
 * directly. Uses maxTokens: 2048 to accommodate structured JSON plan output.
 *
 * @param {{ providerName?: string, model?: string }} options
 * @returns {import('./providers/AIProvider.js').AIProvider}
 */
export function createPlanningProvider(options = {}) {
  const providerName = String(options.providerName ?? getDefaultProviderName()).trim().toLowerCase();
  const model = options.model || getDefaultModelForProvider(providerName);

  if (providerName === 'ollama') {
    return new OllamaProvider({
      model,
      apiUrl: import.meta.env.VITE_OLLAMA_API_URL || '/api/ollama/api/chat',
    });
  }

  return new ClaudeProvider({
    model,
    maxTokens: 2048,
    apiUrl: import.meta.env.VITE_CLAUDE_API_URL || '/api/claude/messages',
  });
}
