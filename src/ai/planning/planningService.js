/**
 * planningService.js — Main facade for game plan generation.
 *
 * Takes a student's game idea and runs it through a multi-step pipeline:
 *   sanitize → build prompt → call AI → parse → validate → retry → fallback
 *
 * Usage:
 *   import { PlanningService } from './planningService.js';
 *   import { ClaudeProvider } from '../providers/ClaudeProvider.js';
 *
 *   const planner = new PlanningService(new ClaudeProvider({ maxTokens: 2048 }), { xp: 0 });
 *   const result = await planner.generatePlan('I want a bunny that collects carrots');
 *   // result: { ok, plan, infeasible, suggestion, error, usedFallback }
 *
 * No React dependencies — pure JavaScript service layer.
 */

import {
  getDifficultyProfile,
  getUnlockedAssets,
  getAllowedBlockNames,
} from './planRegistry.js';
import {
  buildPlanningSystemPrompt,
  buildRefinementSystemPrompt,
  buildRefinementUserMessage,
  buildStructureRetryMessage,
  buildFeasibilityRetryMessage,
  buildSemanticRetryMessage,
} from './planningPrompt.js';
import { validateStructure, validateFeasibility, validateSemanticAlignment } from './planValidator.js';
import { createPlan, createSuccessResult, createErrorResult } from './planModels.js';
import { getFallbackPlan } from './fallbackPlans.js';
import { getPlannerCapabilityConstraints } from './plannerCapabilityCatalog.js';

// Max idea text length accepted (chars)
const MAX_IDEA_LENGTH = 500;

// Patterns that suggest prompt-injection attempts
const INJECTION_PATTERNS = [
  /ignore\s+(previous|prior|all|above)\s+instructions?/i,
  /system\s*:/i,
  /you\s+are\s+now/i,
  /\[system\]/i,
  /\[assistant\]/i,
  /<\s*system\s*>/i,
];

// ---------------------------------------------------------------------------
// PlanningService
// ---------------------------------------------------------------------------

export class PlanningService {
  /**
   * @param {import('../providers/AIProvider.js').AIProvider} provider
   * @param {{ xp?: number }} options
   */
  constructor(provider, { xp = 0 } = {}) {
    if (!provider || typeof provider.sendMessage !== 'function') {
      throw new Error('PlanningService requires a provider with a sendMessage() method');
    }
    this._provider = provider;
    this._xp = Math.max(0, Number.isFinite(xp) ? xp : 0);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Generate a game plan from a student's idea.
   *
   * @param {string} ideaText
   * @param {AbortSignal} [signal]
   * @returns {Promise<import('./planModels.js').PlanResult>}
   */
  async generatePlan(ideaText, signal) {
    // 1. Sanitize
    const sanitized = this._sanitize(ideaText);
    if (!sanitized) {
      return createErrorResult('Please describe a game idea — what do you want to build?');
    }

    // 2. Build constraints
    const constraints = this._buildConstraints();

    // 3. Build system prompt
    const systemPrompt = buildPlanningSystemPrompt({
      unlockedAssets: constraints.unlockedAssets,
      difficultyProfile: constraints.difficultyProfile,
      plannerAssets: constraints.plannerAssets,
      plannerBlocks: constraints.plannerBlocks,
      plannerEvents: constraints.plannerEvents,
      plannerCheckabilityGuide: constraints.plannerCheckabilityGuide,
    });

    // 4. Call AI → parse → validate (with one retry per stage)
    return this._runPipeline({
      userMessage: sanitized,
      systemPrompt,
      constraints,
      ideaText: sanitized,
      signal,
    });
  }

  /**
   * Refine an existing plan based on a student's request.
   *
   * @param {import('./planModels.js').Plan} currentPlan
   * @param {string} refinementText
   * @param {AbortSignal} [signal]
   * @returns {Promise<import('./planModels.js').PlanResult>}
   */
  async refinePlan(currentPlan, refinementText, signal) {
    const sanitized = this._sanitize(refinementText);
    if (!sanitized) {
      return createErrorResult('Please describe how you want the plan to change');
    }

    const constraints = this._buildConstraints();

    const systemPrompt = buildRefinementSystemPrompt({
      unlockedAssets: constraints.unlockedAssets,
      difficultyProfile: constraints.difficultyProfile,
      plannerAssets: constraints.plannerAssets,
      plannerBlocks: constraints.plannerBlocks,
      plannerEvents: constraints.plannerEvents,
      plannerCheckabilityGuide: constraints.plannerCheckabilityGuide,
    });

    const userMessage = buildRefinementUserMessage(currentPlan, sanitized);

    return this._runPipeline({
      userMessage,
      systemPrompt,
      constraints,
      ideaText: sanitized,
      signal,
    });
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Build the constraint set for this student's XP level.
   * @private
   */
  _buildConstraints() {
    const difficultyProfile = getDifficultyProfile(this._xp);
    const unlockedAssets = getUnlockedAssets(this._xp);
    const allowedBlockNames = getAllowedBlockNames(difficultyProfile);
    return {
      difficultyProfile,
      unlockedAssets,
      allowedBlockNames,
      ...getPlannerCapabilityConstraints(difficultyProfile, this._xp),
    };
  }

  /**
   * Core pipeline: call AI → parse → validate structure → validate feasibility.
   * Each validation stage gets one retry before falling back.
   *
   * @private
   */
  async _runPipeline({ userMessage, systemPrompt, constraints, ideaText, signal }) {
    // --- First attempt ---
    let rawText;
    try {
      const response = await this._provider.sendMessage({
        messages: [{ role: 'user', content: userMessage }],
        systemPrompt,
        signal,
      });
      rawText = response.text;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      return createErrorResult(`Could not reach the AI service: ${err.message}`);
    }

    // Parse JSON from raw text
    let parsed = this._parseJSON(rawText);

    // --- Structure validation (retry if needed) ---
    let structResult = validateStructure(parsed);
    if (!structResult.valid) {
      // Retry once with error feedback
      const retryText = await this._retry({
        systemPrompt,
        retryMessage: buildStructureRetryMessage(ideaText, structResult.errors),
        signal,
      });
      if (retryText) {
        parsed = this._parseJSON(retryText);
        structResult = validateStructure(parsed);
      }
      if (!structResult.valid || !structResult.plan) {
        return createSuccessResult(getFallbackPlan(ideaText, this._xp), { usedFallback: true });
      }
    }

    let plan = structResult.plan;

    // --- Feasibility validation (retry if needed) ---
    const feasResult = validateFeasibility(plan, constraints);
    if (!feasResult.valid) {
      const retryText = await this._retry({
        systemPrompt,
        retryMessage: buildFeasibilityRetryMessage(ideaText, feasResult.violations),
        signal,
      });
      if (retryText) {
        const retryParsed = this._parseJSON(retryText);
        const retryStruct = validateStructure(retryParsed);
        if (retryStruct.valid && retryStruct.plan) {
          const retryFeas = validateFeasibility(retryStruct.plan, constraints);
          if (retryFeas.valid) {
            plan = retryStruct.plan;
          } else {
            // Still failing after retry — use fallback
            return createSuccessResult(getFallbackPlan(ideaText, this._xp), { usedFallback: true });
          }
        } else {
          return createSuccessResult(getFallbackPlan(ideaText, this._xp), { usedFallback: true });
        }
      } else {
        return createSuccessResult(getFallbackPlan(ideaText, this._xp), { usedFallback: true });
      }
    }

    // --- Semantic validation (retry if needed) ---
    const semanticResult = validateSemanticAlignment(plan, constraints);
    if (!semanticResult.valid) {
      const retryText = await this._retry({
        systemPrompt,
        retryMessage: buildSemanticRetryMessage(ideaText, semanticResult.issues),
        signal,
      });
      if (retryText) {
        const retryParsed = this._parseJSON(retryText);
        const retryStruct = validateStructure(retryParsed);
        if (retryStruct.valid && retryStruct.plan) {
          const retryFeas = validateFeasibility(retryStruct.plan, constraints);
          const retrySemantic = retryFeas.valid
            ? validateSemanticAlignment(retryStruct.plan, constraints)
            : { valid: false };

          if (retryFeas.valid && retrySemantic.valid) {
            plan = retryStruct.plan;
            parsed = retryParsed;
          } else {
            return createSuccessResult(getFallbackPlan(ideaText, this._xp), { usedFallback: true });
          }
        } else {
          return createSuccessResult(getFallbackPlan(ideaText, this._xp), { usedFallback: true });
        }
      } else {
        return createSuccessResult(getFallbackPlan(ideaText, this._xp), { usedFallback: true });
      }
    }

    // --- Apply hard rules (clamp stage count, fix IDs) ---
    plan = this._applyRules(plan, constraints.difficultyProfile);

    // --- Handle infeasibility flag from the AI ---
    const wasInfeasible = Boolean(parsed?.infeasible);
    const suggestion = wasInfeasible && typeof parsed?.suggestion === 'string'
      ? parsed.suggestion
      : null;

    return createSuccessResult(plan, { infeasible: wasInfeasible, suggestion });
  }

  /**
   * Make a single retry call with a correction message.
   * Returns the raw text response or null if the call fails.
   * @private
   */
  async _retry({ systemPrompt, retryMessage, signal }) {
    try {
      const response = await this._provider.sendMessage({
        messages: [{ role: 'user', content: retryMessage }],
        systemPrompt,
        signal,
      });
      return response.text;
    } catch {
      return null;
    }
  }

  /**
   * Parse JSON from raw AI text.
   * Tries JSON.parse first, then extracts from markdown fences, then substring search.
   * @private
   */
  _parseJSON(text) {
    if (!text || typeof text !== 'string') return null;

    // Direct parse
    try { return JSON.parse(text.trim()); } catch { /* continue */ }

    // Extract from ```json ... ``` or ``` ... ```
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try { return JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ }
    }

    // Extract first { ... } substring
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try { return JSON.parse(text.slice(firstBrace, lastBrace + 1)); } catch { /* continue */ }
    }

    return null;
  }

  /**
   * Sanitize idea text: trim, truncate, strip injection patterns.
   * Returns null if the input is unusable.
   * @private
   */
  _sanitize(text) {
    if (!text || typeof text !== 'string') return null;

    let sanitized = text.trim().slice(0, MAX_IDEA_LENGTH);
    if (!sanitized) return null;

    // Strip prompt-injection attempts
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(sanitized)) {
        // Replace the matching portion with a safe placeholder
        sanitized = sanitized.replace(pattern, '[...]');
      }
    }

    return sanitized.trim() || null;
  }

  /**
   * Post-process a plan to enforce hard constraints after AI generation.
   * @private
   */
  _applyRules(plan, difficultyProfile) {
    let stages = [...plan.stages];

    // Clamp stage count to profile maximum
    if (stages.length > difficultyProfile.maxStages) {
      stages = stages.slice(0, difficultyProfile.maxStages);
    }

    // Ensure sequential stage IDs
    stages = stages.map((stage, i) =>
      Object.freeze({ ...stage, id: `stage-${i + 1}` })
    );

    // Clamp asset count to profile maximum
    const uniqueAssets = [...new Set(plan.entities.assets)];
    const clampedAssets = uniqueAssets.slice(0, difficultyProfile.maxAssets);

    return createPlan({
      ...plan,
      stages,
      entities: {
        ...plan.entities,
        assets: clampedAssets,
      },
    });
  }
}
