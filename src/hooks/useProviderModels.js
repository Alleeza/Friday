import { useEffect, useMemo, useState } from 'react';
import { getClaudeModels } from '../ai/providerCatalog.js';

function normalizeModelNames(models) {
  return Array.from(
    new Set(
      models
        .map((model) => String(model ?? '').trim())
        .filter(Boolean)
    )
  );
}

export function useProviderModels({ selectedProvider, addNotification }) {
  const [ollamaModels, setOllamaModels] = useState([]);
  const [claudeModels, setClaudeModels] = useState(() => getClaudeModels());
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    let ignore = false;

    if (selectedProvider !== 'ollama') return undefined;

    const loadOllamaModels = async () => {
      setIsLoadingModels(true);

      try {
        const response = await fetch('/api/ollama/api/tags');
        if (!response.ok) {
          throw new Error(`Could not load Ollama models (${response.status})`);
        }

        const data = await response.json();
        const names = normalizeModelNames(
          Array.isArray(data.models) ? data.models.map((model) => model?.name) : []
        );

        if (ignore) return;
        setOllamaModels(names);
      } catch (err) {
        if (ignore) return;
        setOllamaModels([]);
        addNotification?.(`Couldn't load local Ollama models. ${err.message}`);
      } finally {
        if (!ignore) setIsLoadingModels(false);
      }
    };

    loadOllamaModels();
    return () => {
      ignore = true;
    };
  }, [addNotification, selectedProvider]);

  useEffect(() => {
    let ignore = false;

    if (selectedProvider !== 'claude') return undefined;

    const loadClaudeModels = async () => {
      setIsLoadingModels(true);

      try {
        const response = await fetch('/api/claude/models');
        if (!response.ok) {
          throw new Error(`Could not load Claude models (${response.status})`);
        }

        const data = await response.json();
        const names = normalizeModelNames(
          Array.isArray(data.data) ? data.data.map((model) => model?.id) : []
        );

        if (ignore || !names.length) return;
        setClaudeModels(names);
      } catch (err) {
        if (ignore) return;
        setClaudeModels(getClaudeModels());
        addNotification?.(`Couldn't load Claude models automatically. ${err.message}`);
      } finally {
        if (!ignore) setIsLoadingModels(false);
      }
    };

    loadClaudeModels();
    return () => {
      ignore = true;
    };
  }, [addNotification, selectedProvider]);

  const modelOptions = useMemo(
    () => (selectedProvider === 'claude' ? claudeModels : ollamaModels),
    [claudeModels, ollamaModels, selectedProvider]
  );

  return {
    modelOptions,
    isLoadingModels,
  };
}
