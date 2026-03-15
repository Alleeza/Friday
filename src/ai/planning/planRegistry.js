/**
 * planRegistry.js — Single source of truth for what is buildable on the platform.
 *
 * All constants here are derived from or must match:
 *   - src/utils/scriptCompiler.js  (block + event names)
 *   - src/data/sandboxAssets.js    (asset definitions + level thresholds)
 *
 * Pure data and pure functions; no AI or React dependencies.
 */

import { sandboxAssets } from '../../data/sandboxAssets.js';
import { calculateLevel } from '../../gamification/levels.js';
import { PLANNER_BLOCK_CAPABILITIES, PLANNER_EVENT_CAPABILITIES } from './plannerCapabilityCatalog.js';

// ---------------------------------------------------------------------------
// Block catalogue (must match scriptCompiler.js action/loop labels)
// ---------------------------------------------------------------------------

export const AVAILABLE_BLOCKS = Object.freeze(
  ['movement', 'looks', 'sound', 'control', 'variables', 'collision', 'condition'].reduce((catalog, category) => ({
    ...catalog,
    [category]: Object.freeze(
      PLANNER_BLOCK_CAPABILITIES
        .filter((block) => block.plannerCategory === category)
        .map((block) => block.name)
    ),
  }), {})
);

/** All block names as a flat Set for fast lookup. */
export const ALL_BLOCK_NAMES = new Set(
  Object.values(AVAILABLE_BLOCKS).flat()
);

// ---------------------------------------------------------------------------
// Event catalogue (must match EVENT_LABELS in scriptCompiler.js)
// ---------------------------------------------------------------------------

export const AVAILABLE_EVENTS = Object.freeze(
  PLANNER_EVENT_CAPABILITIES.map((event) => event.displayName)
);

export const AVAILABLE_EVENTS_SET = new Set(AVAILABLE_EVENTS);

// ---------------------------------------------------------------------------
// While-loop condition options (must match palette in SandboxBuilderPage.jsx)
// ---------------------------------------------------------------------------

export const WHILE_CONDITIONS = Object.freeze(['score < 10', 'is alive', 'time > 0']);

// ---------------------------------------------------------------------------
// Impossible mechanics — keywords that signal things we can't build
// ---------------------------------------------------------------------------

export const IMPOSSIBLE_KEYWORDS = Object.freeze([
  'shoot', 'shooting', 'laser', 'bullet',
  'gravity', 'physics', 'fall', 'falling',
  'jump', 'jumping', 'double jump',
  'health', 'lives', 'hit points', 'damage',
  'inventory', 'item', 'pickup',
  'multiplayer', 'two player', '2 player', 'pvp',
  'platformer', 'side scroller',
  'enemy ai', 'enemies', 'pathfind',
  'save', 'load', 'level', 'levels',
  'menu', 'screen', 'pause',
  'animation frame', 'sprite sheet',
]);

// ---------------------------------------------------------------------------
// Difficulty profiles — map XP tiers to plan constraints
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} DifficultyProfile
 * @property {string}   label            - Human-readable tier name
 * @property {number}   minStages        - Minimum number of stages a plan should contain
 * @property {number}   maxStages        - Maximum number of stages in a plan
 * @property {number}   minStepsPerStage - Minimum number of steps each stage should contain
 * @property {number}   maxAssets        - Maximum number of distinct asset types
 * @property {string[]} allowedCategories - Block categories the student can use
 */

const DIFFICULTY_TIERS = [
  {
    minXp: 80,
    profile: Object.freeze({
      label: 'creator',
      minStages: 6,
      maxStages: 8,
      minStepsPerStage: 3,
      maxAssets: 7,
      allowedCategories: Object.freeze(['movement', 'looks', 'sound', 'control']),
    }),
  },
  {
    minXp: 50,
    profile: Object.freeze({
      label: 'builder',
      minStages: 5,
      maxStages: 7,
      minStepsPerStage: 3,
      maxAssets: 5,
      allowedCategories: Object.freeze(['movement', 'looks', 'sound', 'control']),
    }),
  },
  {
    minXp: 20,
    profile: Object.freeze({
      label: 'explorer',
      minStages: 5,
      maxStages: 6,
      minStepsPerStage: 3,
      maxAssets: 4,
      allowedCategories: Object.freeze(['movement', 'looks', 'sound', 'control']),
    }),
  },
  {
    minXp: 0,
    profile: Object.freeze({
      label: 'beginner',
      minStages: 4,
      maxStages: 5,
      minStepsPerStage: 3,
      maxAssets: 3,
      allowedCategories: Object.freeze(['movement', 'looks', 'sound', 'control']),
    }),
  },
];

/**
 * Returns the difficulty profile for a given XP value.
 * @param {number} xp
 * @returns {DifficultyProfile}
 */
export function getDifficultyProfile(xp = 0) {
  const tier = DIFFICULTY_TIERS.find((t) => xp >= t.minXp);
  return tier ? tier.profile : DIFFICULTY_TIERS[DIFFICULTY_TIERS.length - 1].profile;
}

// ---------------------------------------------------------------------------
// Asset helpers
// ---------------------------------------------------------------------------

/**
 * Returns assets the student can use given their current level.
 * @param {number} xp
 * @returns {Array<{ id: string, emoji: string, label: string, unlockLevel: number }>}
 */
export function getUnlockedAssets(xp = 0) {
  const level = calculateLevel(xp);
  return sandboxAssets.filter((asset) => (asset.unlockLevel || 1) <= level);
}

/**
 * Returns blocks available to a student given their difficulty profile.
 * @param {DifficultyProfile} profile
 * @returns {Record<string, string[]>} - only the allowed categories
 */
export function getAllowedBlocks(profile) {
  return Object.fromEntries(
    profile.allowedCategories.map((cat) => [cat, AVAILABLE_BLOCKS[cat] ?? []])
  );
}

/**
 * Returns a flat array of allowed block names for a given profile.
 * @param {DifficultyProfile} profile
 * @returns {string[]}
 */
export function getAllowedBlockNames(profile) {
  return profile.allowedCategories.flatMap((cat) => AVAILABLE_BLOCKS[cat] ?? []);
}
