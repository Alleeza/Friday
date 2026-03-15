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
 *   const planner = new PlanningService(new ClaudeProvider({ maxTokens: 8192 }), { xp: 0 });
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
  buildGameplayRetryMessage,
} from './planningPrompt.js';
import {
  validateStructure,
  validateFeasibility,
  validateSemanticAlignment,
  validateGameplayQuality,
} from './planValidator.js';
import { createPlan, createSuccessResult, createErrorResult } from './planModels.js';
import { getFallbackPlan, getFallbackPlanResultMeta } from './fallbackPlans.js';
import { getPlannerCapabilityConstraints } from './plannerCapabilityCatalog.js';
import { deriveGameplayRequirements } from './gameplayRequirements.js';
import {
  createPlannerDebugRun,
  addPlannerDebugAttempt,
  addPlannerDebugNote,
  finalizePlannerDebugRun,
} from './plannerDebug.js';

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
    const constraints = this._buildConstraints(sanitized);

    // 3. Build system prompt
    const systemPrompt = buildPlanningSystemPrompt({
      unlockedAssets: constraints.unlockedAssets,
      difficultyProfile: constraints.difficultyProfile,
      plannerAssets: constraints.plannerAssets,
      plannerBlocks: constraints.plannerBlocks,
      plannerEvents: constraints.plannerEvents,
      plannerCheckabilityGuide: constraints.plannerCheckabilityGuide,
      gameplayRequirements: constraints.gameplayRequirements,
    });

    const debugRun = createPlannerDebugRun({
      mode: 'generate',
      ideaText: sanitized,
      userMessage: sanitized,
      systemPrompt,
      constraints,
      provider: this._provider,
      xp: this._xp,
    });

    // 4. Call AI → parse → validate (with one retry per stage)
    return this._runPipeline({
      userMessage: sanitized,
      systemPrompt,
      constraints,
      ideaText: sanitized,
      signal,
      debugRun,
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

    const gameplayIdea = `${currentPlan?.summary ?? ''} ${sanitized}`.trim();
    const constraints = this._buildConstraints(gameplayIdea);

    const systemPrompt = buildRefinementSystemPrompt({
      unlockedAssets: constraints.unlockedAssets,
      difficultyProfile: constraints.difficultyProfile,
      plannerAssets: constraints.plannerAssets,
      plannerBlocks: constraints.plannerBlocks,
      plannerEvents: constraints.plannerEvents,
      plannerCheckabilityGuide: constraints.plannerCheckabilityGuide,
      gameplayRequirements: constraints.gameplayRequirements,
    });

    const userMessage = buildRefinementUserMessage(currentPlan, sanitized);

    const debugRun = createPlannerDebugRun({
      mode: 'refine',
      ideaText: sanitized,
      userMessage,
      systemPrompt,
      constraints,
      provider: this._provider,
      xp: this._xp,
      currentPlan,
    });

    return this._runPipeline({
      userMessage,
      systemPrompt,
      constraints,
      ideaText: sanitized,
      signal,
      debugRun,
    });
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Build the constraint set for this student's XP level.
   * @private
   */
  _buildConstraints(ideaText = '') {
    const difficultyProfile = getDifficultyProfile(this._xp);
    const unlockedAssets = getUnlockedAssets(this._xp);
    const allowedBlockNames = getAllowedBlockNames(difficultyProfile);
    const gameplayRequirements = deriveGameplayRequirements(ideaText, difficultyProfile);
    return {
      difficultyProfile,
      unlockedAssets,
      allowedBlockNames,
      gameplayRequirements,
      ...getPlannerCapabilityConstraints(difficultyProfile, this._xp),
    };
  }

  _createFallbackResult(ideaText, debugRun, reason) {
    const plan = getFallbackPlan(ideaText, this._xp);
    const meta = getFallbackPlanResultMeta(ideaText, this._xp);
    const result = createSuccessResult(plan, { ...meta, usedFallback: true });
    addPlannerDebugNote(debugRun, 'fallback-result-created', {
      reason,
      meta,
      plan: this._summarizePlan(plan),
    });
    return result;
  }

  /**
   * Core pipeline: call AI → parse → validate structure → validate feasibility.
   * Each validation stage gets one retry before falling back.
   *
   * @private
   */
  async _runPipeline({ userMessage, systemPrompt, constraints, ideaText, signal, debugRun }) {
    const structureOptions = {
      minStages: constraints.difficultyProfile.minStages,
      minStepsPerStage: constraints.difficultyProfile.minStepsPerStage,
    };

    addPlannerDebugNote(debugRun, 'pipeline-start', {
      structureOptions,
      difficultyProfile: constraints.difficultyProfile,
      gameplayRequirements: constraints.gameplayRequirements,
    });

    // --- First attempt ---
    let rawText;
    try {
      rawText = await this._attemptProviderCall({
        label: 'initial-response',
        messageText: userMessage,
        systemPrompt,
        signal,
        debugRun,
      });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      const errorResult = createErrorResult(`Could not reach the AI service: ${err.message}`);
      await finalizePlannerDebugRun(debugRun, {
        status: 'provider-error',
        result: errorResult,
        error: err,
      });
      return errorResult;
    }

    // Parse JSON from raw text
    let parseResult = this._parseJSONWithMeta(rawText);
    let parsed = parseResult.parsed;

    // --- Structure validation (retry if needed) ---
    let structResult = validateStructure(parsed, structureOptions);
    this._recordValidationAttempt(debugRun, 'initial-response', {
      rawText,
      parseResult,
      structure: structResult,
    });

    if (!structResult.valid) {
      // Retry once with error feedback
      const retryText = await this._retry({
        systemPrompt,
        retryMessage: buildStructureRetryMessage(ideaText, structResult.errors),
        signal,
        debugRun,
        label: 'structure-retry',
      });
      if (retryText) {
        parseResult = this._parseJSONWithMeta(retryText);
        parsed = parseResult.parsed;
        structResult = validateStructure(parsed, structureOptions);
        this._recordValidationAttempt(debugRun, 'structure-retry', {
          rawText: retryText,
          parseResult,
          structure: structResult,
        });
      }
      if (!structResult.valid || !structResult.plan) {
        const fallbackResult = this._createFallbackResult(ideaText, debugRun, 'structure-validation-failed');
        await finalizePlannerDebugRun(debugRun, {
          status: 'fallback-structure',
          result: fallbackResult,
        });
        return fallbackResult;
      }
    }

    let plan = structResult.plan;

    // --- Feasibility validation (retry if needed) ---
    const feasResult = validateFeasibility(plan, constraints);
    addPlannerDebugAttempt(debugRun, 'feasibility-initial', {
      feasibility: feasResult,
      plan: this._summarizePlan(plan),
    });
    if (!feasResult.valid) {
      const retryText = await this._retry({
        systemPrompt,
        retryMessage: buildFeasibilityRetryMessage(ideaText, feasResult.violations),
        signal,
        debugRun,
        label: 'feasibility-retry',
      });
      if (retryText) {
        const retryParseResult = this._parseJSONWithMeta(retryText);
        const retryParsed = retryParseResult.parsed;
        const retryStruct = validateStructure(retryParsed, structureOptions);
        this._recordValidationAttempt(debugRun, 'feasibility-retry', {
          rawText: retryText,
          parseResult: retryParseResult,
          structure: retryStruct,
        });
        if (retryStruct.valid && retryStruct.plan) {
          const retryFeas = validateFeasibility(retryStruct.plan, constraints);
          addPlannerDebugAttempt(debugRun, 'feasibility-retry-validation', {
            feasibility: retryFeas,
            plan: this._summarizePlan(retryStruct.plan),
          });
          if (retryFeas.valid) {
            plan = retryStruct.plan;
            parsed = retryParsed;
            parseResult = retryParseResult;
          } else {
            // Still failing after retry — use fallback
            const fallbackResult = this._createFallbackResult(ideaText, debugRun, 'feasibility-validation-failed');
            await finalizePlannerDebugRun(debugRun, {
              status: 'fallback-feasibility',
              result: fallbackResult,
            });
            return fallbackResult;
          }
        } else {
          const fallbackResult = this._createFallbackResult(ideaText, debugRun, 'feasibility-retry-structure-invalid');
          await finalizePlannerDebugRun(debugRun, {
            status: 'fallback-feasibility',
            result: fallbackResult,
          });
          return fallbackResult;
        }
      } else {
        const fallbackResult = this._createFallbackResult(ideaText, debugRun, 'feasibility-retry-no-response');
        await finalizePlannerDebugRun(debugRun, {
          status: 'fallback-feasibility',
          result: fallbackResult,
        });
        return fallbackResult;
      }
    }

    // --- Semantic validation (retry if needed) ---
    const semanticResult = validateSemanticAlignment(plan, constraints);
    addPlannerDebugAttempt(debugRun, 'semantic-initial', {
      semantic: semanticResult,
      plan: this._summarizePlan(plan),
    });
    if (!semanticResult.valid) {
      const retryText = await this._retry({
        systemPrompt,
        retryMessage: buildSemanticRetryMessage(ideaText, semanticResult.issues),
        signal,
        debugRun,
        label: 'semantic-retry',
      });
      if (retryText) {
        const retryParseResult = this._parseJSONWithMeta(retryText);
        const retryParsed = retryParseResult.parsed;
        const retryStruct = validateStructure(retryParsed, structureOptions);
        this._recordValidationAttempt(debugRun, 'semantic-retry', {
          rawText: retryText,
          parseResult: retryParseResult,
          structure: retryStruct,
        });
        if (retryStruct.valid && retryStruct.plan) {
          const retryFeas = validateFeasibility(retryStruct.plan, constraints);
          const retrySemantic = retryFeas.valid
            ? validateSemanticAlignment(retryStruct.plan, constraints)
            : { valid: false };

          addPlannerDebugAttempt(debugRun, 'semantic-retry-validation', {
            feasibility: retryFeas,
            semantic: retrySemantic,
            plan: this._summarizePlan(retryStruct.plan),
          });

          if (retryFeas.valid && retrySemantic.valid) {
            plan = retryStruct.plan;
            parsed = retryParsed;
            parseResult = retryParseResult;
          } else {
            const fallbackResult = this._createFallbackResult(ideaText, debugRun, 'semantic-validation-failed');
            await finalizePlannerDebugRun(debugRun, {
              status: 'fallback-semantic',
              result: fallbackResult,
            });
            return fallbackResult;
          }
        } else {
          const fallbackResult = this._createFallbackResult(ideaText, debugRun, 'semantic-retry-structure-invalid');
          await finalizePlannerDebugRun(debugRun, {
            status: 'fallback-semantic',
            result: fallbackResult,
          });
          return fallbackResult;
        }
      } else {
        const fallbackResult = this._createFallbackResult(ideaText, debugRun, 'semantic-retry-no-response');
        await finalizePlannerDebugRun(debugRun, {
          status: 'fallback-semantic',
          result: fallbackResult,
        });
        return fallbackResult;
      }
    }

    // --- Gameplay quality validation (retry if needed) ---
    const gameplayResult = validateGameplayQuality(plan, constraints);
    addPlannerDebugAttempt(debugRun, 'gameplay-initial', {
      gameplay: gameplayResult,
      plan: this._summarizePlan(plan),
      requirements: constraints.gameplayRequirements,
    });
    if (!gameplayResult.valid) {
      const retryText = await this._retry({
        systemPrompt,
        retryMessage: buildGameplayRetryMessage(ideaText, gameplayResult.issues),
        signal,
        debugRun,
        label: 'gameplay-retry',
      });
      if (retryText) {
        const retryParseResult = this._parseJSONWithMeta(retryText);
        const retryParsed = retryParseResult.parsed;
        const retryStruct = validateStructure(retryParsed, structureOptions);
        this._recordValidationAttempt(debugRun, 'gameplay-retry', {
          rawText: retryText,
          parseResult: retryParseResult,
          structure: retryStruct,
        });
        if (retryStruct.valid && retryStruct.plan) {
          const retryFeas = validateFeasibility(retryStruct.plan, constraints);
          const retrySemantic = retryFeas.valid
            ? validateSemanticAlignment(retryStruct.plan, constraints)
            : { valid: false };
          const retryGameplay = retryFeas.valid && retrySemantic.valid
            ? validateGameplayQuality(retryStruct.plan, constraints)
            : { valid: false, issues: ['Gameplay validation skipped because feasibility or semantic validation failed first.'] };

          addPlannerDebugAttempt(debugRun, 'gameplay-retry-validation', {
            feasibility: retryFeas,
            semantic: retrySemantic,
            gameplay: retryGameplay,
            plan: this._summarizePlan(retryStruct.plan),
          });

          if (retryFeas.valid && retrySemantic.valid && retryGameplay.valid) {
            plan = retryStruct.plan;
            parsed = retryParsed;
            parseResult = retryParseResult;
          } else {
            const fallbackResult = this._createFallbackResult(ideaText, debugRun, 'gameplay-validation-failed');
            await finalizePlannerDebugRun(debugRun, {
              status: 'fallback-gameplay',
              result: fallbackResult,
            });
            return fallbackResult;
          }
        } else {
          const fallbackResult = this._createFallbackResult(ideaText, debugRun, 'gameplay-retry-structure-invalid');
          await finalizePlannerDebugRun(debugRun, {
            status: 'fallback-gameplay',
            result: fallbackResult,
          });
          return fallbackResult;
        }
      } else {
        const fallbackResult = this._createFallbackResult(ideaText, debugRun, 'gameplay-retry-no-response');
        await finalizePlannerDebugRun(debugRun, {
          status: 'fallback-gameplay',
          result: fallbackResult,
        });
        return fallbackResult;
      }
    }

    // --- Apply hard rules (clamp stage count, fix IDs) ---
    const planBeforeRules = plan;
    plan = this._applyRules(plan, constraints.difficultyProfile);
    addPlannerDebugAttempt(debugRun, 'post-rules', {
      parsedWith: parseResult.strategy,
      beforeRules: this._summarizePlan(planBeforeRules),
      afterRules: this._summarizePlan(plan),
    });

    // --- Handle infeasibility flag from the AI ---
    const wasInfeasible = Boolean(parsed?.infeasible);
    const suggestion = wasInfeasible && typeof parsed?.suggestion === 'string'
      ? parsed.suggestion
      : null;
    const successResult = createSuccessResult(plan, { infeasible: wasInfeasible, suggestion });
    await finalizePlannerDebugRun(debugRun, {
      status: 'success',
      result: {
        ...successResult,
        parsed,
        finalPlanSummary: this._summarizePlan(plan),
      },
    });
    return successResult;
  }

  /**
   * Make a single retry call with a correction message.
   * Returns the raw text response or null if the call fails.
   * @private
   */
  async _retry({ systemPrompt, retryMessage, signal, debugRun, label }) {
    try {
      return await this._attemptProviderCall({
        label,
        messageText: retryMessage,
        systemPrompt,
        signal,
        debugRun,
      });
    } catch (error) {
      addPlannerDebugNote(debugRun, `${label}-provider-error`, {
        message: error.message,
        name: error.name,
      });
      return null;
    }
  }

  /**
   * Parse JSON from raw AI text.
   * Tries JSON.parse first, then extracts from markdown fences, then substring search.
   * @private
   */
  _parseJSONWithMeta(text) {
    if (!text || typeof text !== 'string') {
      return {
        parsed: null,
        strategy: 'invalid-input',
      };
    }

    // Direct parse
    try {
      return {
        parsed: JSON.parse(text.trim()),
        strategy: 'direct',
      };
    } catch {
      // continue
    }

    // Extract from ```json ... ``` or ``` ... ```
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        return {
          parsed: JSON.parse(fenceMatch[1].trim()),
          strategy: 'markdown-fence',
        };
      } catch {
        // continue
      }
    }

    // Extract first { ... } substring
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return {
          parsed: JSON.parse(text.slice(firstBrace, lastBrace + 1)),
          strategy: 'brace-substring',
        };
      } catch {
        // continue
      }
    }

    return {
      parsed: null,
      strategy: 'failed',
    };
  }

  _parseJSON(text) {
    return this._parseJSONWithMeta(text).parsed;
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

  async _attemptProviderCall({ label, messageText, systemPrompt, signal, debugRun }) {
    addPlannerDebugNote(debugRun, `${label}-request`, {
      systemPrompt,
      messageText,
    });

    const response = await this._provider.sendMessage({
      messages: [{ role: 'user', content: messageText }],
      systemPrompt,
      signal,
    });

    addPlannerDebugAttempt(debugRun, `${label}-raw-response`, {
      rawText: response.text,
      textLength: response.text?.length ?? 0,
    });

    return response.text;
  }

  _recordValidationAttempt(debugRun, label, {
    rawText,
    parseResult,
    structure,
  }) {
    addPlannerDebugAttempt(debugRun, `${label}-parsed`, {
      rawText,
      rawTextLength: rawText?.length ?? 0,
      parseStrategy: parseResult?.strategy ?? 'unknown',
      parsed: parseResult?.parsed ?? null,
      structure: {
        valid: structure?.valid ?? false,
        errors: structure?.errors ?? [],
        planSummary: structure?.plan ? this._summarizePlan(structure.plan) : null,
      },
    });
  }

  _summarizePlan(plan) {
    if (!plan) return null;

    return {
      summary: plan.summary,
      eta: plan.eta,
      checkpoints: plan.checkpoints,
      entities: plan.entities,
      stageCount: plan.stages.length,
      stages: plan.stages.map((stage) => ({
        id: stage.id,
        label: stage.label,
        stepCount: stage.steps.length,
        steps: stage.steps,
        stepChecks: stage.stepChecks,
      })),
    };
  }
}
