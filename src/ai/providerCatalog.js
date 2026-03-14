export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_OLLAMA_MODEL = 'gemma3:12b';

export function getDefaultProviderName() {
  const configuredProvider = String(import.meta.env.VITE_AI_PROVIDER ?? 'claude').trim().toLowerCase();
  return configuredProvider === 'ollama' ? 'ollama' : 'claude';
}

export function getDefaultModelForProvider(providerName, availableModels = []) {
  if (providerName === 'claude') {
    return String(import.meta.env.VITE_CLAUDE_MODEL ?? DEFAULT_CLAUDE_MODEL).trim() || DEFAULT_CLAUDE_MODEL;
  }

  const configuredDefault = String(import.meta.env.VITE_OLLAMA_MODEL ?? '').trim();
  if (configuredDefault && (!availableModels.length || availableModels.includes(configuredDefault))) {
    return configuredDefault;
  }
  return availableModels[0] || DEFAULT_OLLAMA_MODEL;
}
