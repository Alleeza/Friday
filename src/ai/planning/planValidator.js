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

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeEventName(value) {
  return normalizeText(value).replace(/^when\s+/, '');
}

function normalizeBlockName(value) {
  return normalizeText(value);
}

function textMentionsAny(text, items) {
  const normalized = normalizeText(text);
  return items.some((item) => normalized.includes(normalizeText(item)));
}

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

  // stepChecks — soft requirement: validate shape but don't fail the plan, createStage() will normalise
  if (Array.isArray(raw.stages)) {
    raw.stages.forEach((stage, i) => {
      if (!stage || typeof stage !== 'object') return;
      if (stage.stepChecks !== undefined) {
        if (!Array.isArray(stage.stepChecks)) {
          errors.push(`Stage ${i + 1}: "stepChecks" must be an array if present`);
        } else if (Array.isArray(stage.steps) && stage.stepChecks.length !== stage.steps.length) {
          // Log a warning but don't fail — createStage() will pad/truncate
          errors.push(`Stage ${i + 1}: "stepChecks" length (${stage.stepChecks.length}) does not match "steps" length (${stage.steps.length}) — will be padded`);
        }
      }
    });
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
// Layer 3: Semantic validation
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SemanticResult
 * @property {boolean}  valid
 * @property {string[]} issues
 */

/**
 * Validates that step wording and stepChecks align with the planner catalog.
 *
 * @param {import('./planModels.js').Plan} plan
 * @param {{
 *   plannerAssets: Array<{ id: string, label: string }>,
 *   plannerBlocks: Array<{ name: string, directlyCheckable: boolean, editableParts: Array<{ index: number }> }>,
 *   plannerEvents: Array<{ value: string, displayName: string }>,
 *   plannerCheckabilityGuide: Array<{ type: string }>,
 * }} constraints
 * @returns {SemanticResult}
 */
export function validateSemanticAlignment(plan, {
  plannerAssets = [],
  plannerBlocks = [],
  plannerEvents = [],
  plannerCheckabilityGuide = [],
} = {}) {
  const issues = [];
  const assetIds = new Set(plannerAssets.map((asset) => asset.id));
  const assetLabels = plannerAssets.map((asset) => asset.label);
  const blockMap = new Map(plannerBlocks.map((block) => [normalizeBlockName(block.name), block]));
  const blockNames = plannerBlocks.map((block) => block.name);
  const eventValues = new Set(plannerEvents.map((event) => normalizeEventName(event.value)));
  const eventPhrases = plannerEvents.flatMap((event) => [event.value, event.displayName]);
  const knownCheckTypes = new Set(plannerCheckabilityGuide.map((guide) => guide.type));

  plan.stages.forEach((stage) => {
    stage.steps.forEach((stepText, stepIndex) => {
      const checks = stage.stepChecks?.[stepIndex] ?? [];
      const prefix = `${stage.label} / Step ${stepIndex + 1}`;
      const normalizedStep = normalizeText(stepText);

      if (!Array.isArray(checks)) {
        issues.push(`${prefix}: stepChecks entry must be an array`);
        return;
      }

      checks.forEach((check) => {
        if (!check || typeof check.type !== 'string') return;

        if (!knownCheckTypes.has(check.type)) {
          issues.push(`${prefix}: unsupported check type "${check.type}"`);
        }

        if ((check.type === 'hasBlockOnAsset' || check.type === 'blockValueOnAsset') && typeof check.block === 'string') {
          const normalizedBlock = normalizeBlockName(check.block);
          if (eventValues.has(normalizeEventName(check.block)) || normalizedBlock.startsWith('when ')) {
            issues.push(`${prefix}: "${check.block}" looks like an event, so use eventIs instead of ${check.type}`);
          }
          if (!blockMap.has(normalizedBlock)) {
            issues.push(`${prefix}: block "${check.block}" is not present in the planner block catalog`);
          }
        }

        if (check.type === 'scriptOnAssetContains' && Array.isArray(check.blocks)) {
          check.blocks.forEach((blockName) => {
            if (eventValues.has(normalizeEventName(blockName)) || normalizeBlockName(blockName).startsWith('when ')) {
              issues.push(`${prefix}: "${blockName}" looks like an event, so use eventIs instead of scriptOnAssetContains`);
            }
            if (!blockMap.has(normalizeBlockName(blockName))) {
              issues.push(`${prefix}: block "${blockName}" is not present in the planner block catalog`);
            }
          });
        }

        if (check.type === 'eventIs') {
          if (!assetIds.has(check.asset)) {
            issues.push(`${prefix}: eventIs references unknown asset "${check.asset}"`);
          }
          if (!eventValues.has(normalizeEventName(check.event))) {
            issues.push(`${prefix}: eventIs references unknown event "${check.event}"`);
          }
        }

        if ((check.type === 'hasAsset' && !assetIds.has(check.value)) || ((check.type === 'assetCount' || check.type === 'minBlockCount' || check.type === 'assetMoved') && !assetIds.has(check.asset ?? check.value))) {
          issues.push(`${prefix}: check "${check.type}" references an asset that is not in the planner asset catalog`);
        }

        if (check.type === 'blockValueOnAsset') {
          const block = blockMap.get(normalizeBlockName(check.block));
          const editableIndexes = new Set((block?.editableParts || []).map((part) => part.index));
          if (block && editableIndexes.size > 0 && !editableIndexes.has(check.partIndex ?? 1)) {
            issues.push(`${prefix}: blockValueOnAsset uses partIndex ${check.partIndex ?? 1} but "${check.block}" exposes ${[...editableIndexes].join(', ')}`);
          }
        }
      });

      if (checks.length === 0) {
        if (/(place|add|drag)/.test(normalizedStep) && textMentionsAny(stepText, assetLabels)) {
          issues.push(`${prefix}: mentions placing an asset but has no machine check; prefer hasAsset or assetCount`);
        } else if (/(event|when|clicked|tapped|key|bumps|touching|timer|score)/.test(normalizedStep) || textMentionsAny(stepText, eventPhrases)) {
          issues.push(`${prefix}: mentions an observable event choice but has no machine check; prefer eventIs`);
        } else if (textMentionsAny(stepText, blockNames) || /(loop|forever|repeat|move|turn|say|sound)/.test(normalizedStep)) {
          issues.push(`${prefix}: mentions an observable block choice but has no machine check; prefer hasBlockOnAsset, scriptOnAssetContains, or blockValueOnAsset`);
        }
      }
    });
  });

  return { valid: issues.length === 0, issues };
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
  if (!feasResult.valid) {
    return {
      valid: false,
      issues: feasResult.violations,
      plan: structResult.plan,
    };
  }

  const semanticResult = validateSemanticAlignment(structResult.plan, constraints);
  return {
    valid: semanticResult.valid,
    issues: semanticResult.issues,
    plan: structResult.plan,
  };
}
