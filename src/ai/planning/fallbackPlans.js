/**
 * fallbackPlans.js — Hardcoded game plan archetypes.
 *
 * These are used when the AI returns garbage, fails validation twice,
 * or when the network is unavailable. They guarantee the student always
 * gets a valid, buildable plan.
 *
 * All plans are pre-validated against the platform's available blocks/assets.
 * Asset lists are filtered at call time to respect the student's XP level.
 *
 * Pure data and pure functions; no AI or React dependencies.
 */

import { createPlan } from './planModels.js';
import { getUnlockedAssets } from './planRegistry.js';

// ---------------------------------------------------------------------------
// Raw archetype definitions
// ---------------------------------------------------------------------------

/** Bunny collects Carrots — simplest possible game, suitable for beginners. */
const COLLECTOR_ARCHETYPE = {
  summary: 'Move your Bunny around the screen to collect Carrots',
  eta: '15–20 minutes',
  infeasible: false,
  suggestion: null,
  entities: {
    assets: ['bunny', 'carrot'],
    blocks: ['Move Forward', 'Forever'],
    events: ['When game starts', 'When bumps'],
  },
  checkpoints: ['Get your Bunny moving', 'Add something to collect'],
  stages: [
    {
      id: 'stage-1',
      label: 'Bring your Bunny to life',
      objective: 'Make the Bunny move when the game starts',
      why: 'Events tell your code when to start — this is how all games begin',
      success: 'Your Bunny is moving across the screen when you press Play',
      steps: [
        'Place a Bunny on the canvas — where do you want it to start?',
        'Think about which event should start the Bunny moving',
        'Which block makes a character keep moving forever?',
        'What number makes the movement feel right — fast or slow?',
      ],
      stepXp: [5, 10, 10, 5],
      stepChecks: [
        [{ type: 'hasAsset', value: 'bunny' }],
        [{ type: 'eventIs', asset: 'bunny', event: 'game starts' }],
        [{ type: 'scriptOnAssetContains', asset: 'bunny', blocks: ['Forever'] }],
        [{ type: 'blockValueOnAsset', asset: 'bunny', block: 'Move Forward', partIndex: 1, op: '!=', value: '12' }],
      ],
      optionalSteps: [
        { description: 'Can you make the Bunny turn as it moves?', bonusXp: 10 },
      ],
    },
    {
      id: 'stage-2',
      label: 'Add something to collect',
      objective: 'Place a Carrot on the canvas with its own script',
      why: 'Each object has its own script — this is how object-based programming works',
      success: 'The Carrot is on the canvas and the Bunny can reach it',
      steps: [
        'Drag a Carrot onto the canvas',
        'Choose the event that should make the Carrot react when the Bunny arrives',
        'Add an action so the Carrot actually responds when it is bumped',
      ],
      stepXp: [5, 10, 15],
      stepChecks: [
        [{ type: 'hasAsset', value: 'carrot' }],
        [{ type: 'eventIs', asset: 'carrot', event: 'bumps' }],
        [{ type: 'minBlockCount', asset: 'carrot', min: 1 }],
      ],
      optionalSteps: [
        { description: 'Add a second Carrot in a different position', bonusXp: 5 },
      ],
    },
  ],
};

/** Space-flavoured dodging challenge using beginner-friendly assets. */
const SPACE_DODGER_ARCHETYPE = {
  summary: 'Pilot your Bunny through an asteroid field of Rocks and survive the route',
  eta: '15–20 minutes',
  infeasible: true,
  suggestion: 'Shooting and enemy combat are not supported yet, so this starter plan turns your idea into a movement-and-dodging challenge.',
  entities: {
    assets: ['bunny', 'rock'],
    blocks: ['Move Forward', 'Turn degrees'],
    events: ['When key pressed', 'When game starts'],
  },
  checkpoints: ['Build the asteroid field', 'Pilot through the danger zone'],
  stages: [
    {
      id: 'stage-1',
      label: 'Build the asteroid field',
      objective: 'Place Rocks to create a space path for the Bunny to dodge through',
      why: 'Level design starts with placing obstacles in intentional positions',
      success: 'Your canvas has several Rocks arranged like an asteroid field with gaps to move through',
      steps: [
        'Place several Rocks around the canvas to act like drifting asteroids',
        'Leave gaps wide enough for the Bunny to weave through',
        'Choose a starting spot for the Bunny away from the Rocks',
      ],
      stepXp: [5, 10, 5],
      stepChecks: [
        [{ type: 'assetCount', asset: 'rock', min: 3 }],
        [{ type: 'aiCheck', condition: 'The Rocks are spaced out with visible gaps so the Bunny can navigate between them like an asteroid field' }],
        [{ type: 'hasAsset', value: 'bunny' }],
      ],
      optionalSteps: [
        { description: 'Add one more Rock to make the route tighter', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-2',
      label: 'Pilot the Bunny',
      objective: 'Use key presses to steer the Bunny through the asteroid field',
      why: 'Input events let the player control movement in real time',
      success: 'You can press keys to move the Bunny around the Rocks without getting stuck',
      steps: [
        'Pick the event that should make the Bunny react when the player presses a key',
        'Choose a movement block that helps the Bunny travel through the field',
        'Test the route and tune the movement so dodging the Rocks feels manageable',
      ],
      stepXp: [10, 10, 10],
      stepChecks: [
        [{ type: 'eventIs', asset: 'bunny', event: 'key pressed' }],
        [{ type: 'hasBlockOnAsset', asset: 'bunny', block: 'Move Forward' }],
        [
          { type: 'eventIs', asset: 'bunny', event: 'key pressed' },
          { type: 'hasBlockOnAsset', asset: 'bunny', block: 'Move Forward' },
          { type: 'assetMoved', asset: 'bunny', minDistance: 1 },
        ],
      ],
      optionalSteps: [
        { description: 'Add a turn block so the Bunny can feel more like a spaceship', bonusXp: 10 },
      ],
    },
  ],
};

/** Navigate through Rocks to reach the Goal flag. */
const MAZE_ARCHETYPE = {
  summary: 'Guide your character through Rocks to reach the Goal',
  eta: '20–25 minutes',
  infeasible: false,
  suggestion: null,
  entities: {
    assets: ['bunny', 'rock', 'goal'],
    blocks: ['Move Forward'],
    events: ['When key pressed', 'When bumps'],
  },
  checkpoints: ['Set up the maze', 'Add a goal to reach'],
  stages: [
    {
      id: 'stage-1',
      label: 'Build your maze',
      objective: 'Place Rocks to create a path the player must navigate',
      why: 'Positioning objects at different coordinates is the foundation of game level design',
      success: 'There is a clear (but narrow!) path between the Rocks',
      steps: [
        'Place several Rocks on the canvas to form a path',
        'Make sure there is a gap the Bunny can fit through',
        'Think about where the Bunny should start — far from the Goal',
      ],
      stepXp: [5, 10, 5],
      stepChecks: [
        [{ type: 'assetCount', asset: 'rock', min: 2 }],
        [{ type: 'aiCheck', condition: 'There are multiple Rocks placed on the canvas with visible gaps between them forming a navigable path' }],
        [{ type: 'hasAsset', value: 'bunny' }],
      ],
      optionalSteps: [
        { description: 'Add more Rocks to make the path trickier', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-2',
      label: 'Make the Bunny move',
      objective: 'Control the Bunny with key presses to navigate the path',
      why: 'Key press events let the player interact with your game in real time',
      success: 'You can steer the Bunny through the gap using your keyboard',
      steps: [
        'Select the Bunny and think about which event fires when a key is pressed',
        'What block moves the character? How far should it move per key press?',
        'Try pressing Play and pressing a key — does your Bunny move?',
      ],
      stepXp: [10, 10, 10],
      stepChecks: [
        [{ type: 'eventIs', asset: 'bunny', event: 'key pressed' }],
        [{ type: 'hasBlockOnAsset', asset: 'bunny', block: 'Move Forward' }],
        [
          { type: 'eventIs', asset: 'bunny', event: 'key pressed' },
          { type: 'hasBlockOnAsset', asset: 'bunny', block: 'Move Forward' },
          { type: 'assetMoved', asset: 'bunny', minDistance: 1 },
        ],
      ],
      optionalSteps: [
        { description: 'Make the Bunny face the direction it is moving', bonusXp: 10 },
      ],
    },
    {
      id: 'stage-3',
      label: 'Add the finish line',
      objective: 'Place a Goal flag and give it a reaction when reached',
      why: 'Win conditions make a game feel complete — they are triggered by events',
      success: 'There is a Goal at the end of the path with its own script',
      steps: [
        'Place a Goal flag near the end of your maze path',
        'Set the Goal to react when the Bunny reaches it',
        'Add an action so the Goal actually responds when reached',
      ],
      stepXp: [5, 10, 15],
      stepChecks: [
        [{ type: 'hasAsset', value: 'goal' }],
        [{ type: 'eventIs', asset: 'goal', event: 'bumps' }],
        [{ type: 'minBlockCount', asset: 'goal', min: 1 }],
      ],
      optionalSteps: [
        { description: 'Can you make the Goal play a sound?', bonusXp: 5 },
      ],
    },
  ],
};

/** Free exploration — just move around and discover things. */
const EXPLORER_ARCHETYPE = {
  summary: 'Move your character around and explore the world you build',
  eta: '10–15 minutes',
  infeasible: false,
  suggestion: null,
  entities: {
    assets: ['bunny', 'tree'],
    blocks: ['Move Forward', 'Turn Degrees', 'Forever'],
    events: ['When game starts'],
  },
  checkpoints: ['Get your world moving'],
  stages: [
    {
      id: 'stage-1',
      label: 'Create your world',
      objective: 'Place characters and objects on the canvas to build a scene',
      why: 'Placing objects at different positions is how you design a game world',
      success: 'Your canvas has at least two different objects placed around it',
      steps: [
        'Drag a Bunny onto the canvas — pick a good starting spot',
        'Add some Trees to make the world feel alive',
        'Think about the spacing — does it feel like an open world?',
      ],
      stepXp: [5, 5, 5],
      stepChecks: [
        [{ type: 'hasAsset', value: 'bunny' }],
        [{ type: 'hasAsset', value: 'tree' }],
        [{ type: 'aiCheck', condition: 'The Bunny and Trees are placed with noticeable spacing so the scene feels like an open world' }],
      ],
      optionalSteps: [
        { description: 'Add a third type of object to your world', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-2',
      label: 'Bring it to life',
      objective: 'Give the Bunny a script that makes it move automatically',
      why: 'A Forever loop keeps running your instructions without stopping — great for movement',
      success: 'The Bunny is moving on its own when you press Play',
      steps: [
        'Select the Bunny and think about what should happen when the game starts',
        'What combination of blocks could make the Bunny wander around?',
        'Try adding a turn — does the Bunny change direction?',
      ],
      stepXp: [10, 10, 10],
      stepChecks: [
        [{ type: 'eventIs', asset: 'bunny', event: 'game starts' }],
        [{ type: 'scriptOnAssetContains', asset: 'bunny', blocks: ['Forever', 'Move Forward'] }],
        [{ type: 'scriptOnAssetContains', asset: 'bunny', blocks: ['Forever', 'Turn degrees'] }],
      ],
      optionalSteps: [
        { description: 'Can you make two objects move at the same time?', bonusXp: 10 },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Archetype keyword mapping
// ---------------------------------------------------------------------------

const ARCHETYPES = [
  {
    keywords: ['collect', 'carrot', 'coin', 'gather', 'pick up', 'grab', 'bunny'],
    plan: COLLECTOR_ARCHETYPE,
    requiredAssets: ['bunny', 'carrot'],
  },
  {
    keywords: ['space', 'ship', 'spaceship', 'shooter', 'asteroid', 'asteroids', 'dodge', 'survive', 'survival'],
    plan: SPACE_DODGER_ARCHETYPE,
    requiredAssets: ['bunny', 'rock'],
  },
  {
    keywords: ['maze', 'navigate', 'obstacle', 'avoid', 'rock', 'wall', 'path', 'goal'],
    plan: MAZE_ARCHETYPE,
    requiredAssets: ['bunny', 'rock', 'goal'],
  },
  {
    keywords: ['explore', 'world', 'walk', 'move', 'wander', 'roam'],
    plan: EXPLORER_ARCHETYPE,
    requiredAssets: ['bunny', 'tree'],
  },
];

function selectFallbackArchetype(normalised, unlockedIds) {
  let bestArchetype = null;
  let bestScore = 0;

  for (const archetype of ARCHETYPES) {
    const canUse = archetype.requiredAssets.every((id) => unlockedIds.has(id));
    if (!canUse) continue;

    const score = archetype.keywords.filter((kw) => normalised.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestArchetype = archetype;
    }
  }

  return bestArchetype ?? ARCHETYPES[0];
}

function inferFallbackMetadata(ideaText, selectedPlan) {
  const normalised = ideaText.toLowerCase();

  if (['shoot', 'shooter', 'laser', 'bullet', 'enemy', 'enemies'].some((kw) => normalised.includes(kw))) {
    return {
      infeasible: true,
      suggestion: selectedPlan === SPACE_DODGER_ARCHETYPE
        ? 'Shooting and enemy combat are not supported yet, so we adapted this into a space-themed dodging challenge using movement and obstacles.'
        : 'Combat and projectile mechanics are not supported yet, so we adapted your idea into a simpler movement-based challenge.',
    };
  }

  if (['jump', 'jumping', 'gravity', 'platformer'].some((kw) => normalised.includes(kw))) {
    return {
      infeasible: true,
      suggestion: 'Jumping and gravity are not supported yet, so we adapted your idea into a movement-and-navigation challenge instead.',
    };
  }

  if (['multiplayer', 'two player', '2 player', 'pvp'].some((kw) => normalised.includes(kw))) {
    return {
      infeasible: true,
      suggestion: 'Multiplayer is not supported yet, so we adapted your idea into a single-player starter plan.',
    };
  }

  return {
    infeasible: Boolean(selectedPlan?.infeasible),
    suggestion: selectedPlan?.suggestion ?? null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a hardcoded fallback plan appropriate for the student's idea and XP.
 *
 * Keyword-matches the idea to pick the closest archetype.
 * Falls back to the collector plan if nothing matches.
 * Filters asset references to only include assets the student has unlocked.
 *
 * @param {string} ideaText - The student's original idea (for keyword matching)
 * @param {number} xp       - Student's current XP (for asset filtering)
 * @returns {import('./planModels.js').Plan}
 */
export function getFallbackPlan(ideaText = '', xp = 0) {
  const normalised = ideaText.toLowerCase();
  const unlockedIds = new Set(getUnlockedAssets(xp).map((a) => a.id));
  const bestArchetype = selectFallbackArchetype(normalised, unlockedIds);

  // Filter the plan's entities to only include unlocked assets
  const rawPlan = bestArchetype.plan;
  const filteredAssets = rawPlan.entities.assets.filter((id) => unlockedIds.has(id));

  const adapted = {
    ...rawPlan,
    entities: {
      ...rawPlan.entities,
      assets: filteredAssets.length > 0 ? filteredAssets : ['bunny'],
    },
  };

  return createPlan(adapted);
}

export function getFallbackPlanResultMeta(ideaText = '', xp = 0) {
  const normalised = ideaText.toLowerCase();
  const unlockedIds = new Set(getUnlockedAssets(xp).map((a) => a.id));
  const bestArchetype = selectFallbackArchetype(normalised, unlockedIds);
  return inferFallbackMetadata(ideaText, bestArchetype.plan);
}
