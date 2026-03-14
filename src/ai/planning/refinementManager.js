/**
 * refinementManager.js — Multi-turn plan refinement session.
 *
 * Wraps PlanningService to maintain conversation state across multiple
 * refinement requests from the student ("make it easier", "add more stages",
 * "don't use coins", etc.).
 *
 * Usage:
 *   import { RefinementSession } from './refinementManager.js';
 *   import { PlanningService } from './planningService.js';
 *   import { ClaudeProvider } from '../providers/ClaudeProvider.js';
 *
 *   const planner = new PlanningService(new ClaudeProvider({ maxTokens: 2048 }), { xp: 25 });
 *   const session = new RefinementSession(planner);
 *
 *   const initial = await session.startSession('bunny collects carrots');
 *   const refined = await session.refine('make it easier, only 2 stages');
 *   const refined2 = await session.refine('remove the coin, use a star instead');
 *
 * No React dependencies — pure JavaScript service layer.
 */

import { createErrorResult } from './planModels.js';

/** Maximum refinement turns per session before asking the student to restart. */
const MAX_TURNS = 10;

export class RefinementSession {
  /**
   * @param {import('./planningService.js').PlanningService} planningService
   */
  constructor(planningService) {
    if (!planningService || typeof planningService.generatePlan !== 'function') {
      throw new Error('RefinementSession requires a PlanningService instance');
    }
    this._service = planningService;
    this._currentPlan = null;
    this._history = []; // Array of { role: 'user'|'assistant', content: string }
    this._turnCount = 0;
    this._originalIdea = '';
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Start a new session by generating the initial plan.
   *
   * @param {string} ideaText - The student's game idea
   * @param {AbortSignal} [signal]
   * @returns {Promise<import('./planModels.js').PlanResult>}
   */
  async startSession(ideaText, signal) {
    this.reset();
    this._originalIdea = String(ideaText ?? '').trim();

    const result = await this._service.generatePlan(ideaText, signal);

    if (result.ok && result.plan) {
      this._currentPlan = result.plan;
      // Seed the history with the initial exchange
      this._history.push(
        { role: 'user', content: ideaText },
        { role: 'assistant', content: JSON.stringify(result.plan) }
      );
    }

    return result;
  }

  /**
   * Refine the current plan based on a student's request.
   *
   * @param {string} requestText - e.g. "make it easier" or "remove the coin"
   * @param {AbortSignal} [signal]
   * @returns {Promise<import('./planModels.js').PlanResult>}
   */
  async refine(requestText, signal) {
    if (!this._currentPlan) {
      return createErrorResult('No plan to refine — call startSession() first');
    }

    if (this._turnCount >= MAX_TURNS) {
      return createErrorResult(
        `We've made ${MAX_TURNS} changes to this plan! Try starting fresh with a new idea to keep things clear.`
      );
    }

    if (!requestText || !String(requestText).trim()) {
      return createErrorResult('Please describe how you want to change the plan');
    }

    this._turnCount += 1;

    const result = await this._service.refinePlan(this._currentPlan, requestText, signal);

    if (result.ok && result.plan) {
      this._currentPlan = result.plan;
      // Append this turn to history
      this._history.push(
        { role: 'user', content: requestText },
        { role: 'assistant', content: JSON.stringify(result.plan) }
      );
      // Trim history to a sliding window (last 6 messages = 3 turns)
      if (this._history.length > 6) {
        // Always keep the first 2 entries (original exchange) for context
        const first2 = this._history.slice(0, 2);
        const recent = this._history.slice(-4);
        this._history = [...first2, ...recent];
      }
    }

    return result;
  }

  /**
   * Returns the current (most recently accepted) plan.
   * @returns {import('./planModels.js').Plan|null}
   */
  getCurrentPlan() {
    return this._currentPlan;
  }

  /**
   * Returns the conversation history for this session.
   * Useful for debugging or passing to the frontend.
   * @returns {Array<{ role: 'user'|'assistant', content: string }>}
   */
  getHistory() {
    return [...this._history];
  }

  /**
   * Returns how many refinement turns have been used.
   * @returns {{ used: number, max: number, remaining: number }}
   */
  getTurnStats() {
    return {
      used: this._turnCount,
      max: MAX_TURNS,
      remaining: MAX_TURNS - this._turnCount,
    };
  }

  /**
   * Returns the original game idea that started this session.
   * @returns {string}
   */
  getOriginalIdea() {
    return this._originalIdea;
  }

  /**
   * Resets the session, clearing all state.
   * Call this before starting a brand new game idea.
   */
  reset() {
    this._currentPlan = null;
    this._history = [];
    this._turnCount = 0;
    this._originalIdea = '';
  }
}
