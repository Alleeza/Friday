/**
 * planValidator.js — Two-layer validation for AI-generated plans.
 *
 * Layer 1: Structure validation  — does the JSON have the right shape?
 * Layer 2: Feasibility validation — does the plan only use what's available?
 *
 * Both are pure functions with no AI or React dependencies.
 */

import { createPlan, createStage } from './planModels.js';
import { ALL_BLOCK_NAMES, AVAILABLE_EVENTS_SET, IMPOSSIBLE_KEYWORDS } from './planRegistry.js';

// ---------------------------------------------------------------------------
// Layer 1: Structure validation
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} StructureResult
 * @property {boolean}   valid  - True if the structure is valid (with defaults applied)
 * @property {string[]}  errors - List of structural problems found
 * @property {import('./planModels.js').Plan|null} plan - Parsed plan (null only on catastrophic failure)
 */

/**
 * Validates and normalises raw AI output into a Plan.
 *
 * This is lenient: missing optional fields are filled in by `createPlan()`.
 * Only hard requirements cause `valid: false`.
 *
 * @param {unknown} raw - Parsed JSON from the AI response
 * @returns {StructureResult}
 */
export function validateStructure(raw) {
  const errors = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Response is not a JSON object'], plan: null };
  }

  // summary
  if (!raw.summary || typeof raw.summary !== 'string' || !raw.summary.trim()) {
    errors.push('Missing or empty "summary" field');
  }

  // stages — hard requirement
  if (!Array.isArray(raw.stages) || raw.stages.length === 0) {
    errors.push('"stages" must be a non-empty array');
    return { valid: false, errors, plan: null };
  }

  // Validate each stage
  raw.stages.forEach((stage, i) => {
    const prefix = `Stage ${i + 1}`;
    if (!stage || typeof stage !== 'object') {
      errors.push(`${prefix}: not an object`);
      return;
    }
    if (!stage.label || typeof stage.label !== 'string' || !stage.label.trim()) {
      errors.push(`${prefix}: missing "label"`);
    }
    if (!stage.objective || typeof stage.objective !== 'string' || !stage.objective.trim()) {
      errors.push(`${prefix}: missing "objective"`);
    }
    if (!Array.isArray(stage.steps) || stage.steps.length === 0) {
      errors.push(`${prefix}: "steps" must be a non-empty array`);
    } else {
      if (stage.stepXp !== undefined) {
        if (!Array.isArray(stage.stepXp)) {
          errors.push(`${prefix}: "stepXp" must be an array`);
        } else if (stage.stepXp.length !== stage.steps.length) {
          errors.push(`${prefix}: "stepXp" length (${stage.stepXp.length}) must match "steps" length (${stage.steps.length})`);
        } else if (stage.stepXp.some((v) => typeof v !== 'number' || v < 0 || !Number.isFinite(v))) {
          errors.push(`${prefix}: all "stepXp" values must be non-negative numbers`);
        }
      }
    }
  });

  // entities — soft requirement (fill defaults if missing)
  if (raw.entities !== undefined) {
    if (typeof raw.entities !== 'object' || Array.isArray(raw.entities)) {
      errors.push('"entities" must be an object');
    }
  }

  if (errors.length > 0) {
    // Try to build a plan anyway for partial recovery
    try {
      const plan = createPlan(raw);
      return { valid: false, errors, plan };
    } catch {
      return { valid: false, errors, plan: null };
    }
  }

  return { valid: true, errors: [], plan: createPlan(raw) };
}

// ---------------------------------------------------------------------------
// Layer 2: Feasibility validation
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} FeasibilityResult
 * @property {boolean}  valid      - True if the plan is buildable
 * @property {string[]} violations - List of specific feasibility problems
 */

/**
 * Validates that a plan only references assets, blocks, and events
 * that are actually available to the student.
 *
 * @param {import('./planModels.js').Plan} plan
 * @param {{
 *   unlockedAssets: Array<{ id: string, label: string }>,
 *   allowedBlockNames: string[],
 * }} constraints
 * @returns {FeasibilityResult}
 */
export function validateFeasibility(plan, { unlockedAssets, allowedBlockNames }) {
  const violations = [];

  const unlockedAssetIds = new Set(unlockedAssets.map((a) => a.id));
  const allowedBlockSet = new Set(allowedBlockNames.map((b) => b.toLowerCase()));

  // Check referenced assets
  for (const assetId of plan.entities.assets) {
    if (!unlockedAssetIds.has(assetId)) {
      const unlockedLabels = unlockedAssets.map((a) => a.label).join(', ');
      violations.push(
        `Asset "${assetId}" is not unlocked (available: ${unlockedLabels})`
      );
    }
  }

  // Check referenced blocks
  for (const blockName of plan.entities.blocks) {
    if (!allowedBlockSet.has(blockName.toLowerCase()) && !ALL_BLOCK_NAMES.has(blockName)) {
      violations.push(`Block "${blockName}" is not available on this platform`);
    } else if (!allowedBlockSet.has(blockName.toLowerCase())) {
      violations.push(`Block "${blockName}" is not unlocked at this level`);
    }
  }

  // Check referenced events
  for (const event of plan.entities.events) {
    if (!AVAILABLE_EVENTS_SET.has(event)) {
      violations.push(
        `Event "${event}" does not exist (available: ${[...AVAILABLE_EVENTS_SET].join(', ')})`
      );
    }
  }

  // Heuristic: scan all step text for impossible mechanic keywords
  for (const stage of plan.stages) {
    const allText = [
      stage.objective,
      stage.why,
      stage.success,
      ...stage.steps,
      ...stage.optionalSteps.map((s) => s.description),
    ].join(' ').toLowerCase();

    for (const keyword of IMPOSSIBLE_KEYWORDS) {
      if (allText.includes(keyword)) {
        violations.push(
          `Stage "${stage.label}" mentions "${keyword}" which is not supported by the block system`
        );
        break; // One violation per stage is enough
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------
// Combined validate helper
// ---------------------------------------------------------------------------

/**
 * Runs both layers and returns a merged result.
 * @param {unknown} raw
 * @param {{ unlockedAssets: Array<{id:string,label:string}>, allowedBlockNames: string[] }} constraints
 * @returns {{ valid: boolean, issues: string[], plan: import('./planModels.js').Plan|null }}
 */
export function validatePlan(raw, constraints) {
  const structResult = validateStructure(raw);
  if (!structResult.valid) {
    return {
      valid: false,
      issues: structResult.errors,
      plan: structResult.plan,
    };
  }

  const feasResult = validateFeasibility(structResult.plan, constraints);
  return {
    valid: feasResult.valid,
    issues: feasResult.violations,
    plan: structResult.plan,
  };
}
