const DEFAULT_CLAUDE_MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-6',
];

function parseModelList(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getProviderOptions() {
  return [
    { value: 'ollama', label: 'Ollama Local' },
    { value: 'claude', label: 'Claude API' },
  ];
}

export function getDefaultProviderName() {
  return String(import.meta.env.VITE_AI_PROVIDER ?? 'ollama').trim().toLowerCase();
}

export function getClaudeModels() {
  const configured = parseModelList(import.meta.env.VITE_CLAUDE_MODELS);
  return configured.length ? configured : DEFAULT_CLAUDE_MODELS;
}

export function getDefaultModelForProvider(providerName) {
  if (providerName === 'claude') {
    return import.meta.env.VITE_CLAUDE_MODEL || getClaudeModels()[0];
  }
  return import.meta.env.VITE_OLLAMA_MODEL || 'llama3.2';
}
