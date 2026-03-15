/**
 * planValidator.js — Two-layer validation for AI-generated plans.
 *
 * Layer 1: Structure validation  — does the JSON have the right shape?
 * Layer 2: Feasibility validation — does the plan only use what's available?
 *
 * Both are pure functions with no AI or React dependencies.
 */

import { createPlan } from './planModels.js';
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

const PLAYER_CONTROL_EVENTS = new Set([
  'key pressed',
  'key is pressed',
  'object is tapped',
  'sprite clicked',
]);

const REACTION_CHECK_TYPES = new Set([
  'minBlockCount',
  'hasBlockOnAsset',
  'scriptOnAssetContains',
  'blockValueOnAsset',
]);

const AUTOPLAY_LANGUAGE_PATTERNS = [
  /\bautomatic(?:ally)?\b/,
  /\bautonomous\b/,
  /\bon its own\b/,
  /\bby itself\b/,
  /\bplays itself\b/,
  /\bscreensaver\b/,
  /\bidle\b/,
  /\bdemo mode\b/,
];

const ROTATION_HEAVY_LANGUAGE_PATTERNS = [
  /\bsteer(?:ing)?\b/,
  /\bturn(?:ing)?\b/,
  /\brotation\b/,
  /\brotate\b/,
  /\bspin(?:ning)?\b/,
];

const OBJECTIVE_PATTERNS = [
  /\b(win|goal|finish|finish line|survive|before the timer ends|before time runs out|score reaches|timer reaches)\b/,
  /\b(collect|find|discover|reach|get|gather)\s+(all|every|both|each|\d+|two|three|four|five)\b/,
  /\b(all|every|both|each|\d+|two|three|four|five)\s+(carrots?|coins?|stars?|targets?|goals?)\b/,
];

const PATHING_WORDS = [
  'challenge',
  'path',
  'route',
  'obstacle',
  'maze',
  'avoid',
  'dodge',
  'navigate',
  'steer around',
  'through the',
];

const POLISH_STAGE_WORDS = [
  'polish',
  'playtest',
  'play test',
  'test',
  'tune',
  'final',
  'touch',
];

const WEAK_POLISH_STEP_PATTERNS = [
  /\badjust\b/,
  /\btweak\b/,
  /\bimprove\b/,
  /\bbetter\b/,
  /\bfeel\b/,
  /\bexperience\b/,
  /\bpace\b/,
  /\bdifficulty\b/,
  /\bfinal adjustment\b/,
];

function collectStepEntries(plan) {
  return plan.stages.flatMap((stage) => stage.steps.map((stepText, stepIndex) => ({
    stage,
    stepIndex,
    stepText,
    checks: Array.isArray(stage.stepChecks?.[stepIndex]) ? stage.stepChecks[stepIndex] : [],
  })));
}

function getPrimaryPlayerAsset(plan) {
  if (plan.entities.assets.includes('bunny')) return 'bunny';
  return plan.entities.assets[0] ?? null;
}

function checkUsesAsset(check, assetId) {
  return check?.asset === assetId || check?.value === assetId;
}

function checkMentionsBlock(check, blockName) {
  const normalizedBlock = normalizeBlockName(blockName);
  if (check?.type === 'hasBlockOnAsset' || check?.type === 'blockValueOnAsset') {
    return normalizeBlockName(check.block) === normalizedBlock;
  }
  if (check?.type === 'scriptOnAssetContains' && Array.isArray(check.blocks)) {
    return check.blocks.some((value) => normalizeBlockName(value) === normalizedBlock);
  }
  return false;
}

function planHasEvent(entries, assetId, eventName) {
  return entries.some(({ checks }) => checks.some((check) => (
    check?.type === 'eventIs'
    && check.asset === assetId
    && normalizeEventName(check.event) === normalizeEventName(eventName)
  )));
}

function planHasBlock(entries, assetId, blockName) {
  return entries.some(({ checks }) => checks.some((check) => (
    checkUsesAsset(check, assetId) && checkMentionsBlock(check, blockName)
  )));
}

function planHasAnyBlock(entries, assetId, blockNames) {
  return blockNames.some((blockName) => planHasBlock(entries, assetId, blockName));
}

function planHasInteractiveTarget(entries, playerAssetId) {
  const targetState = new Map();

  entries.forEach(({ checks }) => {
    checks.forEach((check) => {
      const assetId = check?.asset ?? check?.value;
      if (!assetId || assetId === playerAssetId) return;

      const current = targetState.get(assetId) ?? { bumps: false, reaction: false };
      if (check.type === 'eventIs' && normalizeEventName(check.event) === 'bumps') {
        current.bumps = true;
      }
      if (REACTION_CHECK_TYPES.has(check.type)) {
        current.reaction = true;
      }
      targetState.set(assetId, current);
    });
  });

  return [...targetState.values()].some((state) => state.bumps && state.reaction);
}

function planHasExplicitObjective(plan) {
  const normalizedPlanText = normalizeText([
    plan.summary,
    ...plan.checkpoints,
    ...plan.stages.flatMap((stage) => [stage.label, stage.objective, stage.success, ...stage.steps]),
  ].join(' '));

  return OBJECTIVE_PATTERNS.some((pattern) => pattern.test(normalizedPlanText));
}

function planHasPathingStage(plan) {
  return plan.stages.some((stage) => {
    const stageText = normalizeText([
      stage.label,
      stage.objective,
      stage.success,
      ...stage.steps,
    ].join(' '));
    return PATHING_WORDS.some((word) => stageText.includes(word));
  });
}

function stageLooksLikePolish(stage) {
  const normalizedStageText = normalizeText([stage.label, stage.objective, stage.success].join(' '));
  return POLISH_STAGE_WORDS.some((word) => normalizedStageText.includes(word));
}

function getWeakPolishIssues(plan) {
  const issues = [];

  plan.stages.forEach((stage) => {
    if (!stageLooksLikePolish(stage)) return;

    stage.steps.forEach((stepText, stepIndex) => {
      const checks = Array.isArray(stage.stepChecks?.[stepIndex]) ? stage.stepChecks[stepIndex] : [];
      if (checks.length > 0) return;

      const normalizedStep = normalizeText(stepText);
      if (!WEAK_POLISH_STEP_PATTERNS.some((pattern) => pattern.test(normalizedStep))) return;

      issues.push(
        `${stage.label} / Step ${stepIndex + 1}: this polish step asks for a concrete tweak but uses [] instead of a programmatic check`
      );
    });
  });

  return issues;
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
 * @param {{ minStages?: number, minStepsPerStage?: number }} [options]
 * @returns {StructureResult}
 */
export function validateStructure(raw, { minStages = 1, minStepsPerStage = 1 } = {}) {
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

  if (raw.stages.length < minStages) {
    errors.push(
      `Plan has ${raw.stages.length} stage(s) but minimum is ${minStages} — add more stages to cover the full game creation lifecycle`
    );
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
      if (stage.steps.length < minStepsPerStage) {
        errors.push(`${prefix} has ${stage.steps.length} step(s) but minimum is ${minStepsPerStage}`);
      }
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

        if (check.type === 'aiCheck') {
          issues.push(`${prefix}: aiCheck is disabled for the MVP; rewrite this step to use only measurable programmatic checks or []`);
        }

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
// Layer 4: Gameplay quality validation
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} GameplayValidationResult
 * @property {boolean} valid
 * @property {string[]} issues
 */

/**
 * Rejects technically valid plans that still fail to create a playable game loop.
 *
 * @param {import('./planModels.js').Plan} plan
 * @param {{ gameplayRequirements?: import('./gameplayRequirements.js').GameplayRequirements }} [options]
 * @returns {GameplayValidationResult}
 */
export function validateGameplayQuality(plan, { gameplayRequirements = {} } = {}) {
  const issues = [];
  const entries = collectStepEntries(plan);
  const playerAssetId = getPrimaryPlayerAsset(plan);
  const normalizedPlanText = normalizeText([
    plan.summary,
    ...plan.checkpoints,
    ...plan.stages.flatMap((stage) => [stage.label, stage.objective, stage.success, ...stage.steps]),
  ].join(' '));

  const hasPlayerControl = Boolean(
    playerAssetId && entries.some(({ checks }) => checks.some((check) => (
      check?.type === 'eventIs'
      && check.asset === playerAssetId
      && PLAYER_CONTROL_EVENTS.has(normalizeEventName(check.event))
    )))
  );

  const hasAutoplayCoreLoop = Boolean(
    playerAssetId
    && planHasEvent(entries, playerAssetId, 'game starts')
    && planHasBlock(entries, playerAssetId, 'Forever')
    && planHasBlock(entries, playerAssetId, 'Move Forward')
  );
  const hasAxisMovement = Boolean(
    playerAssetId && planHasAnyBlock(entries, playerAssetId, ['Change X by', 'Change Y by'])
  );
  const hasRotationHeavyPlayerMovement = Boolean(
    playerAssetId && (
      planHasBlock(entries, playerAssetId, 'Turn degrees')
      || planHasBlock(entries, playerAssetId, 'Move Forward')
    )
  );

  if (gameplayRequirements.requiresPlayerAgency) {
    if (!hasPlayerControl) {
      issues.push('Exploration must be student-controlled for this prompt. Add a player-control event on the main character, usually "When key is pressed".');
    }

    if (gameplayRequirements.forbidAutoplayCoreLoop && hasAutoplayCoreLoop && !hasPlayerControl) {
      issues.push('This plan is an autoplay toy, not a player-controlled game. The main character moves automatically on "When game starts" instead of being guided by the player.');
    }

    if (AUTOPLAY_LANGUAGE_PATTERNS.some((pattern) => pattern.test(normalizedPlanText))) {
      issues.push('The summary or objectives describe the game as automatic/autonomous even though this idea should be player-controlled.');
    }
  }

  if (gameplayRequirements.preferAxisMovement && !hasAxisMovement) {
    issues.push('This plan should use simple WASD-style movement with "Change X by" and "Change Y by" on the player instead of rotation-heavy control.');
  }

  if (gameplayRequirements.discourageRotationMovement && hasRotationHeavyPlayerMovement && !hasAxisMovement) {
    issues.push('Rotation or steering is doing too much of the player-control work here. For this idea, prefer direct horizontal/vertical movement over "Turn degrees" and "Move Forward".');
  }

  if (gameplayRequirements.discourageRotationMovement && ROTATION_HEAVY_LANGUAGE_PATTERNS.some((pattern) => pattern.test(normalizedPlanText)) && !hasAxisMovement) {
    issues.push('The plan talks about steering or turning as the main control scheme, but this idea should default to direct axis movement.');
  }

  if (gameplayRequirements.requiresExplicitObjective && !planHasExplicitObjective(plan)) {
    issues.push('The plan needs an explicit objective with a finish condition, such as finding every target or reaching a goal.');
  }

  if (gameplayRequirements.requiresInteractiveTarget && !planHasInteractiveTarget(entries, playerAssetId)) {
    issues.push('The plan needs an interactive target with a "When bumps" event and a visible reaction script.');
  }

  if (gameplayRequirements.preferObstacleOrPathing && !planHasPathingStage(plan)) {
    issues.push('The plan needs a meaningful challenge or pathing stage so the objective takes effort.');
  }

  issues.push(...getWeakPolishIssues(plan));

  return { valid: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Combined validate helper
// ---------------------------------------------------------------------------

/**
 * Runs both layers and returns a merged result.
 * @param {unknown} raw
 * @param {{
 *   unlockedAssets: Array<{id:string,label:string}>,
 *   allowedBlockNames: string[],
 *   minStages?: number,
 *   minStepsPerStage?: number,
 *   gameplayRequirements?: import('./gameplayRequirements.js').GameplayRequirements,
 * }} constraints
 * @returns {{ valid: boolean, issues: string[], plan: import('./planModels.js').Plan|null }}
 */
export function validatePlan(raw, constraints = {}) {
  const structResult = validateStructure(raw, {
    minStages: constraints.minStages,
    minStepsPerStage: constraints.minStepsPerStage,
  });
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
  if (!semanticResult.valid) {
    return {
      valid: false,
      issues: semanticResult.issues,
      plan: structResult.plan,
    };
  }

  const gameplayResult = validateGameplayQuality(structResult.plan, constraints);
  return {
    valid: gameplayResult.valid,
    issues: gameplayResult.issues,
    plan: structResult.plan,
  };
}
