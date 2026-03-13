import { AIService } from './aiService.js';
import { ClaudeProvider } from './providers/ClaudeProvider.js';
import { OllamaProvider } from './providers/OllamaProvider.js';
import { getDefaultModelForProvider, getDefaultProviderName } from './providerCatalog.js';

function normalizeProviderName(value) {
  return String(value ?? getDefaultProviderName()).trim().toLowerCase();
}

export function createDefaultAIService(options = {}) {
  const providerName = normalizeProviderName(options.providerName);
  const model = options.model || getDefaultModelForProvider(providerName);

  if (providerName === 'ollama') {
    return new AIService(
      new OllamaProvider({
        model,
        apiUrl: import.meta.env.VITE_OLLAMA_API_URL || '/api/ollama/api/chat',
      })
    );
  }

  return new AIService(
    new ClaudeProvider({
      model,
      apiUrl: import.meta.env.VITE_CLAUDE_API_URL || '/api/claude',
    })
  );
}
