import { useEffect, useRef } from 'react';
import { buildContext } from '../ai/context/contextBuilder.js';
import { evaluateStepChecks } from '../utils/stepChecker.js';

const AI_DEBOUNCE_MS = 4500;
const STEP_CHECK_SYSTEM_PROMPT =
  'You are a silent progress checker for a kids block-based game builder. ' +
  'Reply with exactly one word: YES or NO. No punctuation, no explanation.';

/**
 * Calls the AI provider to evaluate a natural-language condition against workspace state.
 *
 * @param {import('../ai/providers/AIProvider.js').AIProvider} provider
 * @param {string} condition - The natural-language condition to evaluate
 * @param {object} workspaceState - Current workspace for context
 * @returns {Promise<boolean>}
 */
async function runAiCheck(provider, condition, workspaceState) {
  const workspaceText = buildContext(workspaceState);
  const userContent =
    `[WORKSPACE]\n${workspaceText}\n[END WORKSPACE]\n\n` +
    `Condition to check: "${condition}"\n\n` +
    `Does the student's current workspace satisfy this condition? YES or NO.`;

  // Use a throwaway provider with maxTokens: 5 to keep it cheap
  const { text } = await provider.constructor
    ? new provider.constructor({ model: provider.model, maxTokens: 5 }).sendMessage({
        messages: [{ role: 'user', content: userContent }],
        systemPrompt: STEP_CHECK_SYSTEM_PROMPT,
      })
    : provider.sendMessage({
        messages: [{ role: 'user', content: userContent }],
        systemPrompt: STEP_CHECK_SYSTEM_PROMPT,
      });

  return text.trim().toUpperCase().startsWith('YES');
}

/**
 * useStepDetection — continuously evaluates step completion checks for the current stage.
 *
 * Programmatic checks (hasAsset, hasBlockOnAsset, etc.) run on every workspace change instantly.
 * AI checks run debounced (4.5s) only when programmatic checks first pass.
 *
 * Tracks completed keys so they can be reverted if checks stop passing.
 *
 * @param {{
 *   provider: import('../ai/providers/AIProvider.js').AIProvider | null,
 *   currentStage: import('../ai/planning/planModels.js').Stage | null,
 *   workspaceState: {
 *     sceneInstances: Array,
 *     scriptsByInstanceKey: Record<string, Array>,
 *     runtimeSnapshot: object | null,
 *   } | null,
 *   completedStepKeys: Record<string, boolean>,
 *   onStepAutoCompleted: (stepKey: string) => void,
 *   onStepAutoReverted: (stepKey: string) => void,
 * }} options
 */
export function useStepDetection({
  provider,
  currentStage,
  workspaceState,
  completedStepKeys,
  onStepAutoCompleted,
  onStepAutoReverted,
}) {
  // Track which steps are pending AI evaluation (programmatic checks passed, awaiting AI)
  const pendingAiRef = useRef({}); // stepKey -> true
  const aiDebounceRef = useRef(null);
  const aiInFlightRef = useRef(false);
  const lastWorkspaceFingerprintRef = useRef(null);

  // ---------------------------------------------------------------------------
  // Effect 1: Programmatic checks — run on every workspace change (instant)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!workspaceState || !currentStage) return;

    currentStage.steps.forEach((_, stepIndex) => {
      const checks = currentStage.stepChecks?.[stepIndex] ?? [];
      const stepKey = `${currentStage.id}:${stepIndex}`;
      const isCompleted = Boolean(completedStepKeys[stepKey]);

      if (checks.length === 0) {
        // No checks defined — this step is manual only, clear any pending AI for it
        delete pendingAiRef.current[stepKey];
        return;
      }

      const { passed, pendingAiChecks } = evaluateStepChecks(checks, workspaceState);

      if (passed) {
        // All programmatic checks pass and no AI checks — auto-complete
        if (!isCompleted) {
          onStepAutoCompleted(stepKey);
        }
        delete pendingAiRef.current[stepKey];
      } else if (pendingAiChecks.length > 0 && !passed) {
        // Programmatic checks pass but AI checks remain — queue for AI evaluation
        // (evaluateStepChecks returns passed:false when pendingAiChecks exist)
        // Re-check: programmatic part might still pass — we need to know if only AI is left
        const programmaticOnlyChecks = checks.filter((c) => c.type !== 'aiCheck');
        const { passed: progPassed } = programmaticOnlyChecks.length > 0
          ? evaluateStepChecks(programmaticOnlyChecks, workspaceState)
          : { passed: true };

        if (progPassed) {
          // Queue for AI evaluation
          pendingAiRef.current[stepKey] = pendingAiChecks;
        } else {
          // Programmatic checks failed — revert any completed state
          delete pendingAiRef.current[stepKey];
          if (isCompleted) {
            onStepAutoReverted(stepKey);
          }
        }
      } else {
        // Programmatic checks failed, no AI pending — revert if auto-completed
        delete pendingAiRef.current[stepKey];
        if (isCompleted) {
          onStepAutoReverted(stepKey);
        }
      }
    });
  }, [workspaceState, currentStage, completedStepKeys, onStepAutoCompleted, onStepAutoReverted]);

  // ---------------------------------------------------------------------------
  // Effect 2: AI checks — debounced, only for steps queued in pendingAiRef
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!provider || !workspaceState || !currentStage) return;

    // Compute fingerprint to avoid re-running AI for the same workspace state
    const fingerprint = JSON.stringify({
      instances: (workspaceState.sceneInstances ?? []).map((i) => ({ id: i.id, key: i.key })),
      scripts: workspaceState.scriptsByInstanceKey ?? {},
    });

    if (fingerprint === lastWorkspaceFingerprintRef.current) return;

    clearTimeout(aiDebounceRef.current);

    aiDebounceRef.current = setTimeout(async () => {
      if (aiInFlightRef.current) return;

      const pendingEntries = Object.entries(pendingAiRef.current);
      if (pendingEntries.length === 0) return;

      aiInFlightRef.current = true;
      lastWorkspaceFingerprintRef.current = fingerprint;

      try {
        for (const [stepKey, aiChecks] of pendingEntries) {
          // Skip if already completed or no longer pending
          if (completedStepKeys[stepKey] || !pendingAiRef.current[stepKey]) continue;

          // All AI checks for this step must pass
          let allPassed = true;
          for (const check of aiChecks) {
            try {
              const result = await runAiCheck(provider, check.condition, workspaceState);
              if (!result) { allPassed = false; break; }
            } catch {
              allPassed = false;
              break;
            }
          }

          if (allPassed) {
            onStepAutoCompleted(stepKey);
            delete pendingAiRef.current[stepKey];
          }
        }
      } finally {
        aiInFlightRef.current = false;
      }
    }, AI_DEBOUNCE_MS);

    return () => clearTimeout(aiDebounceRef.current);
  }, [workspaceState, currentStage, provider, completedStepKeys, onStepAutoCompleted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(aiDebounceRef.current);
      pendingAiRef.current = {};
    };
  }, []);
}
