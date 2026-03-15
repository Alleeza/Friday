import { BLOCK_PALETTE, DEFAULT_EVENT, EVENT_OPTIONS } from '../../data/builderCapabilities.js';
import { sandboxAssets } from '../../data/sandboxAssets.js';

const PALETTE_TO_PLANNER_CATEGORY = Object.freeze({
  Movement: 'movement',
  Control: 'control',
  Variables: 'variables',
  Collisions: 'collision',
  Conditionals: 'condition',
});

const ASSET_SEMANTICS = Object.freeze({
  bunny: {
    roles: ['player', 'hero', 'mover'],
    uses: ['main controllable character', 'collector avatar', 'runner or explorer'],
    pairings: ['carrot', 'rock', 'goal', 'tree'],
    constraints: ['Best used as the thing that moves', 'Movement plans should usually attach scripts to the Bunny'],
  },
  chicken: {
    roles: ['player', 'hero', 'runner'],
    uses: ['crossing roads', 'dodging obstacles', 'main controllable character'],
    pairings: ['car', 'goal', 'coin'],
    constraints: ['Works best as the player character in road-crossing or dodge games'],
  },
  carrot: {
    roles: ['collectible', 'reward', 'pickup'],
    uses: ['item to reach or collect', 'object that reacts when touched'],
    pairings: ['bunny', 'coin', 'goal'],
    constraints: ['Usually works best as a static reward object'],
  },
  car: {
    roles: ['hazard', 'obstacle', 'moving blocker'],
    uses: ['traffic obstacle', 'moving hazard', 'lane-based dodge challenge'],
    pairings: ['chicken', 'goal', 'coin'],
    constraints: ['Best used as a moving obstacle with a repeating script'],
  },
  rock: {
    roles: ['obstacle', 'wall', 'hazard stand-in'],
    uses: ['maze walls', 'blocking paths', 'collision targets'],
    pairings: ['bunny', 'goal'],
    constraints: ['Use multiple Rocks for paths or barriers'],
  },
  tree: {
    roles: ['scenery', 'landmark', 'soft obstacle'],
    uses: ['decorate the world', 'create spacing in a scene'],
    pairings: ['bunny', 'cloud', 'sun'],
    constraints: ['Mostly visual unless given a reaction script'],
  },
  goal: {
    roles: ['finish line', 'target', 'win marker'],
    uses: ['end point to reach', 'object that celebrates success'],
    pairings: ['bunny', 'rock'],
    constraints: ['Usually placed at the end of a path or challenge'],
  },
  coin: {
    roles: ['collectible', 'score item'],
    uses: ['score target', 'pickup that can play a sound or disappear'],
    pairings: ['bunny', 'goal'],
    constraints: ['Good for repeatable collection mechanics'],
  },
  cloud: {
    roles: ['scenery', 'background'],
    uses: ['sky decoration', 'moving background object'],
    pairings: ['sun', 'tree', 'star'],
    constraints: ['Usually decorative unless intentionally animated'],
  },
  sun: {
    roles: ['scenery', 'background'],
    uses: ['world decoration', 'visual target in a sky scene'],
    pairings: ['cloud', 'tree', 'star'],
    constraints: ['Usually decorative unless intentionally animated'],
  },
  star: {
    roles: ['collectible', 'reward', 'goal marker'],
    uses: ['special reward', 'rare collectible', 'space-theme target'],
    pairings: ['bunny', 'cloud', 'sun'],
    constraints: ['Can work as either reward or finish point'],
  },
  heart: {
    roles: ['reward', 'status item'],
    uses: ['friendly pickup', 'theme object', 'survival reward'],
    pairings: ['bunny', 'gift'],
    constraints: ['There is no built-in health system, so treat it as a collectible or theme object'],
  },
  gift: {
    roles: ['reward', 'surprise object'],
    uses: ['present to reach', 'end reward', 'theme object'],
    pairings: ['bunny', 'key', 'heart'],
    constraints: ['Works best as a target or reward, not an inventory item'],
  },
  key: {
    roles: ['target item', 'unlock theme prop'],
    uses: ['special collectible', 'goal-themed pickup'],
    pairings: ['gift', 'goal', 'bunny'],
    constraints: ['There is no real lock system, so use it as a thematic collectible'],
  },
});

const EVENT_SEMANTICS = Object.freeze({
  'game starts': {
    summary: 'Runs immediately when Play begins',
    commonUses: ['start automatic movement', 'set up a scene', 'start timers or repeated actions'],
    seedEvent: true,
    preferredCheck: 'eventIs',
  },
  'sprite clicked': {
    summary: 'Runs when the object is clicked in play mode',
    commonUses: ['simple interactivity', 'click-to-react objects'],
    seedEvent: false,
    preferredCheck: 'eventIs',
  },
  'object is tapped': {
    summary: 'Runs when the object is tapped or clicked',
    commonUses: ['touch-friendly interactions', 'tap-to-react objects'],
    seedEvent: false,
    preferredCheck: 'eventIs',
  },
  'key pressed': {
    summary: 'Runs once when a keyboard input is triggered',
    commonUses: ['step movement', 'player control', 'manual actions'],
    seedEvent: false,
    preferredCheck: 'eventIs',
  },
  'key is pressed': {
    summary: 'Runs while a key press condition is active',
    commonUses: ['continuous control', 'hold-to-move behaviors'],
    seedEvent: false,
    preferredCheck: 'eventIs',
  },
  'timer reaches 0': {
    summary: 'Runs when the runtime timer hits zero',
    commonUses: ['time-up ending', 'late-game reaction'],
    seedEvent: false,
    preferredCheck: 'eventIs',
  },
  'score reaches 10': {
    summary: 'Runs when score reaches the win threshold',
    commonUses: ['score-based win moment', 'unlock celebration'],
    seedEvent: false,
    preferredCheck: 'eventIs',
  },
  bumps: {
    summary: 'Runs when the object first collides with another object',
    commonUses: ['collection reactions', 'goal reached reactions', 'collision feedback'],
    seedEvent: false,
    preferredCheck: 'eventIs',
  },
  'is touching': {
    summary: 'Runs when the object begins touching another object',
    commonUses: ['contact reactions', 'while-touching logic'],
    seedEvent: false,
    preferredCheck: 'eventIs',
  },
  'is not touching (pro)': {
    summary: 'Runs when contact ends',
    commonUses: ['leave-zone reactions', 'separation logic'],
    seedEvent: false,
    preferredCheck: 'eventIs',
  },
});

const BLOCK_SEMANTICS = Object.freeze({
  'Move Forward': {
    purpose: 'Moves an object in the direction it is facing',
    commonUses: ['automatic movement', 'key-step movement'],
    editableParts: [{ index: 1, name: 'distance', defaultValue: '12' }],
    defaultValues: ['12'],
    kind: 'action',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset', 'scriptOnAssetContains', 'assetMoved'],
  },
  'Turn degrees': {
    purpose: 'Rotates an object by a number of degrees',
    commonUses: ['wandering movement', 'change direction'],
    editableParts: [{ index: 1, name: 'degrees', defaultValue: '15' }],
    defaultValues: ['15'],
    kind: 'action',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset', 'scriptOnAssetContains'],
  },
  'Set rotation style': {
    purpose: 'Changes whether an object rotates or flips',
    commonUses: ['left-right facing', 'keep art upright'],
    editableParts: [{ index: 1, name: 'style', defaultValue: 'dont rotate' }],
    defaultValues: ['dont rotate'],
    kind: 'action',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset'],
  },
  'Change X by': {
    purpose: 'Moves an object horizontally',
    commonUses: ['left-right movement', 'scrolling motion'],
    editableParts: [{ index: 1, name: 'deltaX', defaultValue: '6' }],
    defaultValues: ['6'],
    kind: 'action',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset', 'assetMoved'],
  },
  'Change Y by': {
    purpose: 'Moves an object vertically',
    commonUses: ['up-down movement', 'vertical drift'],
    editableParts: [{ index: 1, name: 'deltaY', defaultValue: '6' }],
    defaultValues: ['6'],
    kind: 'action',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset', 'assetMoved'],
  },
  'Go to X': {
    purpose: 'Places an object at a fixed location',
    commonUses: ['spawn positions', 'reset position'],
    editableParts: [
      { index: 1, name: 'x', defaultValue: '320' },
      { index: 3, name: 'y', defaultValue: '220' },
    ],
    defaultValues: ['320', '220'],
    kind: 'action',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset'],
  },
  'Point in direction': {
    purpose: 'Makes an object face a chosen direction',
    commonUses: ['set facing direction', 'prepare movement'],
    editableParts: [{ index: 1, name: 'direction', defaultValue: '90' }],
    defaultValues: ['90'],
    kind: 'action',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset'],
  },
  'Switch costume to': {
    purpose: 'Changes an object costume',
    commonUses: ['visual reaction', 'state change'],
    editableParts: [{ index: 1, name: 'costume', defaultValue: 'bunny jump' }],
    defaultValues: ['bunny jump'],
    kind: 'action',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset'],
  },
  'Next costume': {
    purpose: 'Cycles to the next costume',
    commonUses: ['simple animation', 'visual response'],
    editableParts: [],
    defaultValues: [],
    kind: 'action',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset'],
  },
  'Play sound': {
    purpose: 'Plays a sound effect',
    commonUses: ['reward feedback', 'collision response', 'celebration'],
    editableParts: [{ index: 1, name: 'sound', defaultValue: 'jump' }],
    defaultValues: ['jump'],
    kind: 'action',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset'],
  },
  Say: {
    purpose: 'Shows a speech bubble with text',
    commonUses: ['character reaction', 'feedback message'],
    editableParts: [{ index: 1, name: 'text', defaultValue: 'Hello!' }],
    defaultValues: ['Hello!'],
    kind: 'action',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset'],
  },
  Forever: {
    purpose: 'Repeats its inner blocks without stopping',
    commonUses: ['continuous movement', 'idle behaviors', 'repeated reactions'],
    editableParts: [],
    defaultValues: [],
    kind: 'loop',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'scriptOnAssetContains'],
  },
  Repeat: {
    purpose: 'Repeats its inner blocks a chosen number of times',
    commonUses: ['fixed number of actions', 'short animations'],
    editableParts: [{ index: 1, name: 'times', defaultValue: '5' }],
    defaultValues: ['5'],
    kind: 'loop',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset', 'scriptOnAssetContains'],
  },
  While: {
    purpose: 'Repeats while a condition stays true',
    commonUses: ['timer-based loops', 'score-based loops'],
    editableParts: [{ index: 1, name: 'condition', defaultValue: 'time > 0' }],
    defaultValues: ['time > 0'],
    kind: 'loop',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset', 'scriptOnAssetContains'],
  },
  Wait: {
    purpose: 'Pauses before continuing',
    commonUses: ['timing reactions', 'spacing out actions'],
    editableParts: [{ index: 1, name: 'seconds', defaultValue: '1' }],
    defaultValues: ['1'],
    kind: 'action',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset'],
  },
  'Change score by': {
    purpose: 'Adds or subtracts score',
    commonUses: ['collection scoring', 'reward systems'],
    editableParts: [{ index: 1, name: 'amount', defaultValue: '1' }],
    defaultValues: ['1'],
    kind: 'runtime-variable',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset', 'runtimeVar'],
  },
  'Set score to': {
    purpose: 'Sets score to a fixed value',
    commonUses: ['reset score', 'win threshold setup'],
    editableParts: [{ index: 1, name: 'value', defaultValue: '0' }],
    defaultValues: ['0'],
    kind: 'runtime-variable',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset', 'runtimeVar'],
  },
  'Change timer by': {
    purpose: 'Adds or subtracts time',
    commonUses: ['bonus time', 'time penalties'],
    editableParts: [{ index: 1, name: 'amount', defaultValue: '2' }],
    defaultValues: ['2'],
    kind: 'runtime-variable',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset', 'runtimeVar'],
  },
  'Set timer to': {
    purpose: 'Sets the timer to a fixed number',
    commonUses: ['start a countdown', 'reset time'],
    editableParts: [{ index: 1, name: 'value', defaultValue: '30' }],
    defaultValues: ['30'],
    kind: 'runtime-variable',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset', 'runtimeVar'],
  },
  'Set alive to': {
    purpose: 'Changes the alive state',
    commonUses: ['simple fail state', 'toggle survival flag'],
    editableParts: [{ index: 1, name: 'alive', defaultValue: 'true' }],
    defaultValues: ['true'],
    kind: 'runtime-variable',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset', 'blockValueOnAsset', 'runtimeVar'],
  },
  bumps: {
    purpose: 'Checks whether two objects collide',
    commonUses: ['collision conditions', 'touching logic'],
    editableParts: [],
    defaultValues: [],
    kind: 'predicate',
    directlyCheckable: false,
    preferredChecks: ['eventIs'],
  },
  'is touching': {
    purpose: 'Checks whether two objects are touching',
    commonUses: ['contact tests', 'touch-triggered logic'],
    editableParts: [],
    defaultValues: [],
    kind: 'predicate',
    directlyCheckable: false,
    preferredChecks: ['eventIs'],
  },
  'is not touching': {
    purpose: 'Checks whether two objects are no longer touching',
    commonUses: ['leave-zone logic', 'separation checks'],
    editableParts: [],
    defaultValues: [],
    kind: 'predicate',
    directlyCheckable: false,
    preferredChecks: ['eventIs'],
  },
});

export const PLANNER_CHECKABILITY_GUIDE = Object.freeze([
  { type: 'hasAsset', useFor: 'Placing one asset on the canvas' },
  { type: 'assetCount', useFor: 'Placing multiple copies of the same asset' },
  { type: 'eventIs', useFor: 'Choosing a specific event trigger on an asset' },
  { type: 'hasBlockOnAsset', useFor: 'Adding a single named block' },
  { type: 'scriptOnAssetContains', useFor: 'Combining a loop/action pair or multiple required blocks' },
  { type: 'minBlockCount', useFor: 'Any reaction script with at least one action' },
  { type: 'blockValueOnAsset', useFor: 'Changing a default numeric or dropdown value' },
  { type: 'assetMoved', useFor: 'Play-mode proof that movement actually happened' },
  { type: 'runtimeVar', useFor: 'Score, timer, or alive state results' },
]);

function firstStringPart(parts = []) {
  return parts.find((part) => typeof part === 'string') || '';
}

function formatEventDisplay(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed.toLowerCase().startsWith('when ') ? trimmed : `When ${trimmed}`;
}

function buildAssetCapability(asset) {
  const semantics = ASSET_SEMANTICS[asset.id] ?? {
    roles: ['object'],
    uses: ['general scene object'],
    pairings: [],
    constraints: [],
  };

  return Object.freeze({
    id: asset.id,
    label: asset.label,
    emoji: asset.emoji,
    unlockXp: asset.unlockXp || 0,
    roles: semantics.roles,
    commonUses: semantics.uses,
    commonPairings: semantics.pairings,
    constraints: semantics.constraints,
    preferredChecks: ['hasAsset', 'assetCount'],
  });
}

function buildEventCapability(value) {
  const semantics = EVENT_SEMANTICS[value] ?? {
    summary: 'Runs when that event happens',
    commonUses: ['event-driven reactions'],
    seedEvent: value === DEFAULT_EVENT,
    preferredCheck: 'eventIs',
  };

  return Object.freeze({
    value,
    displayName: formatEventDisplay(value),
    summary: semantics.summary,
    commonUses: semantics.commonUses,
    seedEvent: semantics.seedEvent,
    preferredCheck: semantics.preferredCheck,
  });
}

function buildBlockCapability(categoryLabel, template) {
  const canonicalName = firstStringPart(template.parts);
  const semantics = BLOCK_SEMANTICS[canonicalName] ?? {
    purpose: 'General builder block',
    commonUses: ['general scripting'],
    editableParts: [],
    defaultValues: [],
    kind: template.type === 'loop' ? 'loop' : 'action',
    directlyCheckable: true,
    preferredChecks: ['hasBlockOnAsset'],
  };

  return Object.freeze({
    id: template.id,
    name: canonicalName,
    categoryLabel,
    plannerCategory: categoryLabel === 'Looks & Sounds'
      ? (template.tone === 'sound' ? 'sound' : 'looks')
      : (PALETTE_TO_PLANNER_CATEGORY[categoryLabel] ?? 'misc'),
    tone: template.tone,
    blockType: template.type === 'loop' ? 'loop' : semantics.kind,
    purpose: semantics.purpose,
    commonUses: semantics.commonUses,
    editableParts: semantics.editableParts,
    defaultValues: semantics.defaultValues,
    directlyCheckable: semantics.directlyCheckable,
    preferredChecks: semantics.preferredChecks,
  });
}

export const PLANNER_ASSET_CAPABILITIES = Object.freeze(sandboxAssets.map(buildAssetCapability));

export const PLANNER_EVENT_CAPABILITIES = Object.freeze(EVENT_OPTIONS.map(buildEventCapability));

export const PLANNER_BLOCK_CAPABILITIES = Object.freeze(
  Object.entries(BLOCK_PALETTE).flatMap(([categoryLabel, templates]) =>
    templates.map((template) => buildBlockCapability(categoryLabel, template))
  )
);

export function getPlannerAssetCapabilities(xp = 0) {
  return PLANNER_ASSET_CAPABILITIES.filter((asset) => asset.unlockXp <= xp);
}

export function getPlannerEventCapabilities() {
  return [...PLANNER_EVENT_CAPABILITIES];
}

export function getPlannerBlockCapabilities(profile) {
  const allowedCategories = new Set(profile?.allowedCategories || []);
  return PLANNER_BLOCK_CAPABILITIES.filter((block) => allowedCategories.has(block.plannerCategory));
}

export function getPlannerCapabilityConstraints(profile, xp = 0) {
  return {
    plannerAssets: getPlannerAssetCapabilities(xp),
    plannerEvents: getPlannerEventCapabilities(),
    plannerBlocks: getPlannerBlockCapabilities(profile),
    plannerCheckabilityGuide: [...PLANNER_CHECKABILITY_GUIDE],
  };
}

export function validatePlannerCapabilityCatalog() {
  const issues = [];

  for (const asset of PLANNER_ASSET_CAPABILITIES) {
    if (!asset.id || !asset.label) issues.push(`Asset capability is missing id or label: ${JSON.stringify(asset)}`);
  }

  for (const event of PLANNER_EVENT_CAPABILITIES) {
    if (!EVENT_OPTIONS.includes(event.value)) {
      issues.push(`Planner event "${event.value}" is not present in builder event options`);
    }
  }

  for (const block of PLANNER_BLOCK_CAPABILITIES) {
    if (!block.name) issues.push(`Planner block "${block.id}" is missing a canonical name`);
    if (!PLANNER_CHECKABILITY_GUIDE.some((guide) => block.preferredChecks.includes(guide.type))) {
      issues.push(`Planner block "${block.name}" has no recognized preferred check type`);
    }
  }

  return issues;
}
