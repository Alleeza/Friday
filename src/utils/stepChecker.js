/**
 * stepChecker.js — Pure functions for evaluating step completion checks.
 *
 * No React, no AI, no side effects. Takes a check list and workspace state,
 * returns whether programmatic checks pass and which AI checks are pending.
 */

function readTokenValue(token) {
  if (typeof token === 'string') return token;
  if (!token || typeof token !== 'object') return '';
  return token.label ?? token.value ?? '';
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeEventName(value) {
  const normalized = normalizeText(value).replace(/^when\s+/, '');

  if (normalized === 'key pressed') return 'key is pressed';
  if (normalized === 'sprite clicked') return 'object is tapped';
  if (normalized === 'is not touching (pro)') return 'is not touching';

  return normalized;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Recursively collects all block part-text strings from a script block tree.
 * For each block, grabs the first string element from parts[] as the block name.
 *
 * @param {Array} blocks - array of script block objects
 * @returns {string[]} flat list of block name strings (lowercased)
 */
function collectBlockNames(blocks) {
  if (!Array.isArray(blocks)) return [];
  const names = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    // Find the first string in parts[] — that's the block name
    const parts = Array.isArray(block.parts) ? block.parts : [];
    const name = parts.find((p) => typeof p === 'string');
    if (name) names.push(name.toLowerCase());
    // Recurse into loop children
    if (Array.isArray(block.children)) {
      names.push(...collectBlockNames(block.children));
    }
  }
  return names;
}

function collectBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  const collected = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    collected.push(block);
    if (Array.isArray(block.children)) {
      collected.push(...collectBlocks(block.children));
    }
  }
  return collected;
}

function getMatchingBlocks(blocks, blockName) {
  const target = normalizeText(blockName);
  return collectBlocks(blocks).filter((block) => {
    const parts = Array.isArray(block.parts) ? block.parts : [];
    const name = parts.find((part) => typeof part === 'string');
    const normalized = normalizeText(name);
    return normalized === target || normalized.startsWith(target);
  });
}

function getEventName(blocks) {
  const eventBlock = Array.isArray(blocks)
    ? blocks.find((block) => block?.id === 'event-start' || normalizeText(readTokenValue(block?.parts?.[0])) === 'when')
    : null;
  return normalizeEventName(readTokenValue(eventBlock?.parts?.[1]));
}

function coerceComparableValue(raw) {
  if (typeof raw === 'number' || typeof raw === 'boolean') return raw;
  const text = String(raw ?? '').trim();
  const lowered = text.toLowerCase();
  if (lowered === 'true') return true;
  if (lowered === 'false') return false;
  const numeric = Number.parseFloat(text);
  return Number.isFinite(numeric) && String(numeric) === text.replace(/\.0+$/, '') ? numeric : text;
}

function compareValues(actual, expected, op = '==') {
  const left = coerceComparableValue(actual);
  const right = coerceComparableValue(expected);

  switch (op) {
    case '==':
      return normalizeText(left) === normalizeText(right);
    case '!=':
      return normalizeText(left) !== normalizeText(right);
    case '>':
      return Number(left) > Number(right);
    case '>=':
      return Number(left) >= Number(right);
    case '<':
      return Number(left) < Number(right);
    case '<=':
      return Number(left) <= Number(right);
    default:
      return false;
  }
}

/**
 * Returns true if the given script block array contains a block matching blockName.
 * Matches are case-insensitive and check if any block name starts with or equals blockName.
 *
 * @param {Array} blocks
 * @param {string} blockName
 * @returns {boolean}
 */
function hasBlockInScript(blocks, blockName) {
  const target = blockName.toLowerCase();
  const names = collectBlockNames(blocks);
  return names.some((n) => n === target || n.startsWith(target));
}

/**
 * Returns true if a single script contains ALL of the given block names.
 * Uses same case-insensitive prefix matching as hasBlockInScript.
 *
 * @param {Array} blocks
 * @param {string[]} blockNames
 * @returns {boolean}
 */
function scriptContainsAll(blocks, blockNames) {
  return blockNames.every((name) => hasBlockInScript(blocks, name));
}

/**
 * Counts non-event blocks in a script (excludes the seed event-start block).
 *
 * @param {Array} blocks
 * @returns {number}
 */
function countNonEventBlocks(blocks) {
  if (!Array.isArray(blocks)) return 0;
  let count = 0;
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    if (block.id === 'event-start') continue;
    count += 1;
    if (Array.isArray(block.children)) {
      count += countNonEventBlocks(block.children);
    }
  }
  return count;
}

/**
 * Returns all script block arrays for instances of the given asset id.
 * Checks ANY instance of that asset type on the canvas.
 *
 * @param {string} assetId
 * @param {Array<{id: string, key: string}>} sceneInstances
 * @param {Record<string, Array>} scriptsByInstanceKey
 * @returns {Array[]} array of script block arrays
 */
function getScriptsForAsset(assetId, sceneInstances, scriptsByInstanceKey) {
  return sceneInstances
    .filter((inst) => inst.id === assetId)
    .map((inst) => scriptsByInstanceKey[inst.key] ?? []);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluates all checks for a single step against the current workspace state.
 *
 * Returns:
 *   { passed: true }                         — all programmatic checks pass, no AI checks
 *   { passed: false }                        — one or more programmatic checks failed
 *   { passed: true, pendingAiChecks: [...] } — programmatic checks pass, but AI checks remain
 *   { passed: false, pendingAiChecks: [...] } — programmatic failed + AI checks exist
 *
 * "passed" is true only when ALL programmatic checks pass AND pendingAiChecks is empty.
 *
 * @param {import('../ai/planning/planModels.js').StepCheck[]} checks
 * @param {{
 *   sceneInstances: Array<{id: string, key: string}>,
 *   scriptsByInstanceKey: Record<string, Array>,
 *   runtimeSnapshot: {variables: {score: number, time: number, isAlive: boolean}} | null,
 * }} workspace
 * @returns {{ passed: boolean, pendingAiChecks: import('../ai/planning/planModels.js').StepCheck[] }}
 */
export function evaluateStepChecks(checks, workspace) {
  if (!Array.isArray(checks) || checks.length === 0) {
    return { passed: false, pendingAiChecks: [] };
  }

  const { sceneInstances = [], scriptsByInstanceKey = {}, runtimeSnapshot = null } = workspace;
  const pendingAiChecks = [];
  let programmaticPassed = true;

  for (const check of checks) {
    if (!check || typeof check.type !== 'string') continue;

    switch (check.type) {
      case 'hasAsset': {
        const assetId = check.value;
        if (!assetId) { programmaticPassed = false; break; }
        const found = sceneInstances.some((inst) => inst.id === assetId);
        if (!found) programmaticPassed = false;
        break;
      }

      case 'assetCount': {
        const assetId = check.asset ?? check.value;
        const count = sceneInstances.filter((inst) => inst.id === assetId).length;
        if (!assetId || count === 0) { programmaticPassed = false; break; }
        if (typeof check.min === 'number' && count < check.min) programmaticPassed = false;
        if (typeof check.max === 'number' && count > check.max) programmaticPassed = false;
        if (typeof check.exact === 'number' && count !== check.exact) programmaticPassed = false;
        break;
      }

      case 'eventIs': {
        const { asset, event } = check;
        if (!asset || !event) { programmaticPassed = false; break; }
        const scripts = getScriptsForAsset(asset, sceneInstances, scriptsByInstanceKey);
        if (scripts.length === 0) { programmaticPassed = false; break; }
        const targetEvent = normalizeEventName(event);
        const anyMatches = scripts.some((script) => getEventName(script) === targetEvent);
        if (!anyMatches) programmaticPassed = false;
        break;
      }

      case 'hasBlockOnAsset': {
        const { asset, block } = check;
        if (!asset || !block) { programmaticPassed = false; break; }
        const scripts = getScriptsForAsset(asset, sceneInstances, scriptsByInstanceKey);
        if (scripts.length === 0) { programmaticPassed = false; break; }
        const anyHasBlock = scripts.some((s) => hasBlockInScript(s, block));
        if (!anyHasBlock) programmaticPassed = false;
        break;
      }

      case 'scriptOnAssetContains': {
        const { asset, blocks } = check;
        if (!asset || !Array.isArray(blocks) || blocks.length === 0) { programmaticPassed = false; break; }
        const scripts = getScriptsForAsset(asset, sceneInstances, scriptsByInstanceKey);
        if (scripts.length === 0) { programmaticPassed = false; break; }
        const anyContainsAll = scripts.some((s) => scriptContainsAll(s, blocks));
        if (!anyContainsAll) programmaticPassed = false;
        break;
      }

      case 'minBlockCount': {
        const { asset, min } = check;
        if (!asset || typeof min !== 'number') { programmaticPassed = false; break; }
        const scripts = getScriptsForAsset(asset, sceneInstances, scriptsByInstanceKey);
        if (scripts.length === 0) { programmaticPassed = false; break; }
        const anyMeetsMin = scripts.some((s) => countNonEventBlocks(s) >= min);
        if (!anyMeetsMin) programmaticPassed = false;
        break;
      }

      case 'blockValueOnAsset': {
        const { asset, block, partIndex = 1, op = '==', value } = check;
        if (!asset || !block || value === undefined) { programmaticPassed = false; break; }
        const scripts = getScriptsForAsset(asset, sceneInstances, scriptsByInstanceKey);
        if (scripts.length === 0) { programmaticPassed = false; break; }
        const anyMatches = scripts.some((script) =>
          getMatchingBlocks(script, block).some((matchedBlock) =>
            compareValues(readTokenValue(matchedBlock?.parts?.[partIndex]), value, op)
          )
        );
        if (!anyMatches) programmaticPassed = false;
        break;
      }

      case 'assetMoved': {
        const { asset, minDistance = 1 } = check;
        if (!asset || !runtimeSnapshot?.assetsByKey) { programmaticPassed = false; break; }
        const matchingInstances = sceneInstances.filter((inst) => inst.id === asset);
        if (matchingInstances.length === 0) { programmaticPassed = false; break; }
        const anyMoved = matchingInstances.some((instance) => {
          const runtimeAsset = runtimeSnapshot.assetsByKey?.[instance.key];
          if (!runtimeAsset) return false;
          const dx = Number(runtimeAsset.x ?? instance.x ?? 0) - Number(instance.x ?? 0);
          const dy = Number(runtimeAsset.y ?? instance.y ?? 0) - Number(instance.y ?? 0);
          return Math.hypot(dx, dy) >= minDistance;
        });
        if (!anyMoved) programmaticPassed = false;
        break;
      }

      case 'runtimeVar': {
        const { value: varName, op, threshold } = check;
        if (!varName || !op || typeof threshold !== 'number') { programmaticPassed = false; break; }
        const vars = runtimeSnapshot?.variables ?? {};
        const actual = vars[varName];
        if (actual === undefined || actual === null) { programmaticPassed = false; break; }
        let met = false;
        switch (op) {
          case '==': met = actual === threshold; break;
          case '>=': met = actual >= threshold; break;
          case '<=': met = actual <= threshold; break;
          case '>':  met = actual > threshold; break;
          case '<':  met = actual < threshold; break;
          default: met = false;
        }
        if (!met) programmaticPassed = false;
        break;
      }

      case 'aiCheck': {
        // Collect for async evaluation — don't affect programmaticPassed
        if (check.condition && typeof check.condition === 'string') {
          pendingAiChecks.push(check);
        }
        break;
      }

      default:
        // Unknown check type — treat as unmet to be safe
        programmaticPassed = false;
        break;
    }

    // Short-circuit if programmatic checks already failed
    if (!programmaticPassed) break;
  }

  return {
    passed: programmaticPassed && pendingAiChecks.length === 0,
    pendingAiChecks,
  };
}
