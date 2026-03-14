export const CLAUDE_HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_OLLAMA_MODEL = 'llama3.2';

export function getDefaultProviderName() {
  const configuredProvider = String(import.meta.env.VITE_AI_PROVIDER ?? 'claude').trim().toLowerCase();
  return configuredProvider === 'ollama' ? 'ollama' : 'claude';
}

export function getDefaultModelForProvider(providerName, availableModels = []) {
  if (providerName === 'claude') {
    return CLAUDE_HAIKU_MODEL;
  }

  const configuredDefault = String(import.meta.env.VITE_OLLAMA_MODEL ?? '').trim();
  if (configuredDefault && (!availableModels.length || availableModels.includes(configuredDefault))) {
    return configuredDefault;
  }
  return availableModels[0] || DEFAULT_OLLAMA_MODEL;
}
