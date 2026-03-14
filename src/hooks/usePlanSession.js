/**
 * usePlanSession.js — React hook wrapping RefinementSession for plan generation & refinement.
 *
 * Manages all planning state so GuidedSetupFlow stays declarative.
 * Follows the pattern established in useAIChat.js.
 */

import { useState, useRef, useCallback } from 'react';
import { PlanningService } from '../ai/planning/planningService.js';
import { RefinementSession } from '../ai/planning/refinementManager.js';
import { createPlanningProvider } from '../ai/createPlanningProvider.js';

/**
 * @typedef {'idle' | 'generating' | 'ready' | 'refining' | 'error'} PlanStatus
 */

/**
 * Hook that manages a full plan generation + refinement session.
 *
 * @param {{ xp?: number, providerName?: string, model?: string }} options - xp defaults to 0 (beginner level)
 * @returns {{
 *   plan: import('../ai/planning/planModels.js').Plan | null,
 *   status: PlanStatus,
 *   error: string | null,
 *   infeasible: boolean,
 *   suggestion: string | null,
 *   usedFallback: boolean,
 *   turnStats: { used: number, max: number, remaining: number },
 *   refinementHistory: Array<{ role: 'user' | 'assistant', text: string }>,
 *   generatePlan: (ideaText: string) => Promise<void>,
 *   refinePlan: (requestText: string) => Promise<void>,
 *   abort: () => void,
 *   reset: () => void,
 * }}
 */
export function usePlanSession({ xp = 0, providerName, model } = {}) {
  const [plan, setPlan] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [infeasible, setInfeasible] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [turnStats, setTurnStats] = useState({ used: 0, max: 10, remaining: 10 });
  const [refinementHistory, setRefinementHistory] = useState([]);

  // Lazily created and persisted across renders
  const sessionRef = useRef(null);
  const abortControllerRef = useRef(null);

  /** Lazily initialise the RefinementSession (and its dependencies). */
  function getSession() {
    const nextProviderName = String(providerName || '').trim().toLowerCase();
    const sessionKey = `${nextProviderName}:${model || ''}:${xp}`;

    if (!sessionRef.current || sessionRef.current.__sessionKey !== sessionKey) {
      const provider = createPlanningProvider({ providerName: nextProviderName || undefined, model });
      const planningService = new PlanningService(provider, { xp });
      sessionRef.current = new RefinementSession(planningService);
      sessionRef.current.__sessionKey = sessionKey;
    }
    return sessionRef.current;
  }

  /** Apply a PlanResult to state. */
  function applyResult(result) {
    if (!result.ok) {
      setStatus('error');
      setError(result.error || 'Something went wrong generating the plan.');
      return;
    }

    setPlan(result.plan);
    setInfeasible(result.infeasible ?? false);
    setSuggestion(result.suggestion ?? null);
    setUsedFallback(result.usedFallback ?? false);
    setStatus('ready');
    setError(null);
  }

  const generatePlan = useCallback(async (ideaText) => {
    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus('generating');
    setError(null);
    setRefinementHistory([]);

    try {
      const session = getSession();
      session.reset();
      const result = await session.startSession(ideaText, controller.signal);
      applyResult(result);
      setTurnStats(session.getTurnStats());
    } catch (err) {
      if (err.name === 'AbortError') return;
      setStatus('error');
      setError(err.message || 'Failed to generate plan.');
    }
  }, [model, providerName, xp]); // eslint-disable-line react-hooks/exhaustive-deps

  const refinePlan = useCallback(async (requestText) => {
    if (!requestText?.trim()) return;

    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus('refining');
    setError(null);

    // Append user message to history immediately for responsiveness
    setRefinementHistory((prev) => [...prev, { role: 'user', text: requestText }]);

    try {
      const session = getSession();
      const result = await session.refine(requestText, controller.signal);

      if (!result.ok) {
        setStatus('ready'); // Revert to ready on refinement error
        setError(result.error || 'Could not refine the plan.');
        setRefinementHistory((prev) => prev.slice(0, -1)); // Remove optimistic user msg
        return;
      }

      setPlan(result.plan);
      setInfeasible(result.infeasible ?? false);
      setSuggestion(result.suggestion ?? null);
      setUsedFallback(result.usedFallback ?? false);
      setStatus('ready');
      setTurnStats(session.getTurnStats());

      // Append assistant summary to history
      setRefinementHistory((prev) => [
        ...prev,
        { role: 'assistant', text: result.plan.summary },
      ]);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setStatus('ready');
      setError(err.message || 'Failed to refine plan.');
      setRefinementHistory((prev) => prev.slice(0, -1)); // Remove optimistic user msg
    }
  }, [model, providerName, xp]); // eslint-disable-line react-hooks/exhaustive-deps

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStatus('idle');
  }, []);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    sessionRef.current = null;
    setPlan(null);
    setStatus('idle');
    setError(null);
    setInfeasible(false);
    setSuggestion(null);
    setUsedFallback(false);
    setTurnStats({ used: 0, max: 10, remaining: 10 });
    setRefinementHistory([]);
  }, []);

  return {
    plan,
    status,
    error,
    infeasible,
    suggestion,
    usedFallback,
    turnStats,
    refinementHistory,
    generatePlan,
    refinePlan,
    abort,
    reset,
  };
}
