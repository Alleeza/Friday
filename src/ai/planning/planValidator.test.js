import test from 'node:test';
import assert from 'node:assert/strict';

import { getFallbackPlan } from './fallbackPlans.js';
import { getDifficultyProfile, getAllowedBlockNames, getUnlockedAssets } from './planRegistry.js';
import { deriveGameplayRequirements } from './gameplayRequirements.js';
import { buildPlanningSystemPrompt } from './planningPrompt.js';
import { getPlannerCapabilityConstraints } from './plannerCapabilityCatalog.js';
import { validateGameplayQuality, validateStructure } from './planValidator.js';

function buildConstraints(xp, ideaText = '') {
  const difficultyProfile = getDifficultyProfile(xp);
  return {
    difficultyProfile,
    unlockedAssets: getUnlockedAssets(xp),
    allowedBlockNames: getAllowedBlockNames(difficultyProfile),
    gameplayRequirements: deriveGameplayRequirements(ideaText, difficultyProfile),
    ...getPlannerCapabilityConstraints(difficultyProfile, xp),
  };
}

test('difficulty profiles expose higher stage and step minimums', () => {
  assert.deepEqual(getDifficultyProfile(0), {
    label: 'beginner',
    minStages: 4,
    maxStages: 5,
    minStepsPerStage: 3,
    maxAssets: 3,
    allowedCategories: ['movement', 'looks', 'sound', 'control'],
  });

  assert.deepEqual(getDifficultyProfile(80), {
    label: 'creator',
    minStages: 6,
    maxStages: 8,
    minStepsPerStage: 3,
    maxAssets: 7,
    allowedCategories: ['movement', 'looks', 'sound', 'control'],
  });
});

test('beginner allowed blocks include looks and sound without unlocking score systems', () => {
  const beginnerBlocks = getAllowedBlockNames(getDifficultyProfile(0));

  assert.ok(beginnerBlocks.includes('Say'));
  assert.ok(beginnerBlocks.includes('Play sound'));
  assert.ok(!beginnerBlocks.includes('Change score by'));
});

test('structure validation flags undersized plans using minimum thresholds', () => {
  const raw = {
    summary: 'A short test plan',
    stages: [
      {
        id: 'stage-1',
        label: 'Start moving',
        objective: 'Make the Bunny move',
        steps: ['Place a Bunny', 'Add movement'],
      },
      {
        id: 'stage-2',
        label: 'Add a Carrot',
        objective: 'Give the Bunny something to find',
        steps: ['Place a Carrot', 'Add a reaction', 'Press Play'],
      },
    ],
  };

  const result = validateStructure(raw, { minStages: 4, minStepsPerStage: 3 });

  assert.equal(result.valid, false);
  assert.ok(result.plan);
  assert.ok(result.errors.some((error) => error.includes('Plan has 2 stage(s) but minimum is 4')));
  assert.ok(result.errors.some((error) => error.includes('Stage 1 has 2 step(s) but minimum is 3')));
});

test('planning prompt calls for player-controlled gameplay and a full lifecycle', () => {
  const constraints = buildConstraints(0, 'Make a game where a bunny explores a forest of trees and finds carrots.');
  const prompt = buildPlanningSystemPrompt({
    unlockedAssets: constraints.unlockedAssets,
    difficultyProfile: constraints.difficultyProfile,
    plannerAssets: constraints.plannerAssets,
    plannerBlocks: constraints.plannerBlocks,
    plannerEvents: constraints.plannerEvents,
    plannerCheckabilityGuide: constraints.plannerCheckabilityGuide,
    gameplayRequirements: constraints.gameplayRequirements,
  });

  assert.match(prompt, /Plan Completeness/);
  assert.match(prompt, /A plan with only 2-3 stages is NEVER sufficient/);
  assert.match(prompt, /Gameplay Requirements For This Idea/);
  assert.match(prompt, /Minimum 4 stages required, maximum 5 allowed/);
  assert.match(prompt, /Each stage must have at least 3 steps/);
  assert.match(prompt, /player-controlled/i);
  assert.match(prompt, /WASD-style axis movement/i);
  assert.match(prompt, /Change X by/);
  assert.match(prompt, /Change Y by/);
  assert.match(prompt, /watch the Bunny wander/i);
  assert.match(prompt, /Polish & Testing/);
});

test('collector fallback plans now provide five full stages', () => {
  const plan = getFallbackPlan('bunny collects carrots', 0);

  assert.equal(plan.stages.length, 5);
  assert.ok(plan.stages.every((stage) => stage.steps.length >= 3));
  assert.match(plan.summary, /Carrot/i);
});

test('gameplay validation rejects autoplay exploration loops for the forest carrot prompt', () => {
  const constraints = buildConstraints(0, 'Make a game where a bunny explores a forest of trees and finds carrots.');
  const result = validateGameplayQuality({
    summary: 'Program the Bunny to move continuously and automatically explore the forest.',
    eta: '20-30 minutes',
    entities: {
      assets: ['bunny', 'carrot', 'tree'],
      blocks: ['Forever', 'Move Forward', 'Turn degrees', 'Say'],
      events: ['When game starts', 'When bumps'],
    },
    checkpoints: ['Build the world', 'Make the Bunny wander', 'React to carrots', 'Add trees', 'Test it'],
    stages: [
      {
        id: 'stage-1',
        label: 'Build your forest world',
        objective: 'Place the Bunny, Trees, and Carrots',
        why: 'Setup comes first',
        success: 'The forest is ready',
        steps: ['Place a Bunny', 'Add Trees', 'Add Carrots'],
        stepXp: [5, 5, 5],
        stepChecks: [
          [{ type: 'hasAsset', value: 'bunny' }],
          [{ type: 'assetCount', asset: 'tree', min: 2 }],
          [{ type: 'assetCount', asset: 'carrot', min: 2 }],
        ],
        optionalSteps: [],
      },
      {
        id: 'stage-2',
        label: 'Let the Bunny wander',
        objective: 'Make the Bunny move automatically through the forest',
        why: 'Loops keep motion going',
        success: 'The Bunny moves by itself',
        steps: ['Keep the start event', 'Add a forever movement loop', 'Add turning so it circles the map'],
        stepXp: [10, 10, 10],
        stepChecks: [
          [{ type: 'eventIs', asset: 'bunny', event: 'game starts' }],
          [{ type: 'scriptOnAssetContains', asset: 'bunny', blocks: ['Forever', 'Move Forward'] }],
          [{ type: 'scriptOnAssetContains', asset: 'bunny', blocks: ['Forever', 'Turn degrees'] }],
        ],
        optionalSteps: [],
      },
      {
        id: 'stage-3',
        label: 'Make carrots react',
        objective: 'Make Carrots react when found',
        why: 'Interactions matter',
        success: 'Carrots react',
        steps: ['Use bumps on Carrot', 'Add a Say block', 'Test the reaction'],
        stepXp: [10, 10, 10],
        stepChecks: [
          [{ type: 'eventIs', asset: 'carrot', event: 'bumps' }],
          [{ type: 'hasBlockOnAsset', asset: 'carrot', block: 'Say' }],
          [{ type: 'eventIs', asset: 'carrot', event: 'bumps' }, { type: 'hasBlockOnAsset', asset: 'carrot', block: 'Say' }],
        ],
        optionalSteps: [],
      },
      {
        id: 'stage-4',
        label: 'Add a forest path',
        objective: 'Use Trees to shape the route',
        why: 'Challenges make it a game',
        success: 'The forest has a route',
        steps: ['Add more Trees', 'Change movement speed', 'Change turn speed'],
        stepXp: [10, 10, 10],
        stepChecks: [
          [{ type: 'assetCount', asset: 'tree', min: 3 }],
          [{ type: 'blockValueOnAsset', asset: 'bunny', block: 'Move Forward', partIndex: 1, op: '!=', value: '12' }],
          [{ type: 'blockValueOnAsset', asset: 'bunny', block: 'Turn degrees', partIndex: 1, op: '!=', value: '15' }],
        ],
        optionalSteps: [],
      },
      {
        id: 'stage-5',
        label: 'Polish and playtest',
        objective: 'Tune the exploration experience',
        why: 'Polish helps',
        success: 'The game works',
        steps: ['Make one final adjustment to improve the exploration experience', 'Press Play', 'Check the carrots'],
        stepXp: [10, 10, 10],
        stepChecks: [
          [],
          [{ type: 'assetMoved', asset: 'bunny', minDistance: 10 }],
          [{ type: 'eventIs', asset: 'carrot', event: 'bumps' }, { type: 'hasBlockOnAsset', asset: 'carrot', block: 'Say' }],
        ],
        optionalSteps: [],
      },
    ],
  }, constraints);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.includes('autoplay toy')));
  assert.ok(result.issues.some((issue) => issue.includes('student-controlled')));
  assert.ok(result.issues.some((issue) => issue.includes('WASD-style movement')));
  assert.ok(result.issues.some((issue) => issue.includes('Rotation or steering')));
  assert.ok(result.issues.some((issue) => issue.includes('explicit objective')));
});

test('explorer fallback uses axis-based player control instead of autoplay wandering', () => {
  const plan = getFallbackPlan('Make a game where a bunny explores a forest of trees and finds carrots.', 0);
  const bunnyChecks = plan.stages.flatMap((stage) => stage.stepChecks.flat()).filter((check) => check.asset === 'bunny');

  assert.ok(bunnyChecks.some((check) => check.type === 'eventIs' && String(check.event).includes('key')));
  assert.ok(bunnyChecks.some((check) => check.type === 'hasBlockOnAsset' && check.block === 'Change X by'));
  assert.ok(bunnyChecks.some((check) => check.type === 'hasBlockOnAsset' && check.block === 'Change Y by'));
  assert.ok(!bunnyChecks.some((check) => check.type === 'hasBlockOnAsset' && check.block === 'Turn degrees'));
  assert.ok(!bunnyChecks.some((check) => check.type === 'eventIs' && check.event === 'game starts'));
});

test('autoplay ideas can still pass gameplay validation when explicitly requested', () => {
  const constraints = buildConstraints(0, 'Make an automatic demo where a bunny roams a forest and finds both carrots.');
  const result = validateGameplayQuality({
    summary: 'Watch the Bunny automatically roam a forest path and find both Carrots.',
    eta: '20-30 minutes',
    entities: {
      assets: ['bunny', 'carrot', 'tree'],
      blocks: ['Forever', 'Move Forward', 'Turn degrees', 'Say'],
      events: ['When game starts', 'When bumps'],
    },
    checkpoints: ['Build the world', 'Start autoplay', 'Make carrots react', 'Add a path', 'Test the demo'],
    stages: [
      {
        id: 'stage-1',
        label: 'Build the world',
        objective: 'Place the Bunny, Trees, and Carrots',
        why: 'Setup matters',
        success: 'The world is ready',
        steps: ['Place a Bunny', 'Add Trees', 'Add Carrots'],
        stepXp: [5, 5, 5],
        stepChecks: [
          [{ type: 'hasAsset', value: 'bunny' }],
          [{ type: 'assetCount', asset: 'tree', min: 2 }],
          [{ type: 'assetCount', asset: 'carrot', min: 2 }],
        ],
        optionalSteps: [],
      },
      {
        id: 'stage-2',
        label: 'Start autoplay',
        objective: 'Make the Bunny roam automatically when play begins',
        why: 'Loops create self-running motion',
        success: 'The Bunny moves by itself',
        steps: ['Keep the start event', 'Add a forever movement loop', 'Add turning to change the route'],
        stepXp: [10, 10, 10],
        stepChecks: [
          [{ type: 'eventIs', asset: 'bunny', event: 'game starts' }],
          [{ type: 'scriptOnAssetContains', asset: 'bunny', blocks: ['Forever', 'Move Forward'] }],
          [{ type: 'scriptOnAssetContains', asset: 'bunny', blocks: ['Forever', 'Turn degrees'] }],
        ],
        optionalSteps: [],
      },
      {
        id: 'stage-3',
        label: 'Make carrots react',
        objective: 'Give the Carrots a reaction when found',
        why: 'Targets need feedback',
        success: 'Each Carrot reacts',
        steps: ['Use bumps on Carrot', 'Add a Say block', 'Check the response'],
        stepXp: [10, 10, 10],
        stepChecks: [
          [{ type: 'eventIs', asset: 'carrot', event: 'bumps' }],
          [{ type: 'hasBlockOnAsset', asset: 'carrot', block: 'Say' }],
          [{ type: 'eventIs', asset: 'carrot', event: 'bumps' }, { type: 'hasBlockOnAsset', asset: 'carrot', block: 'Say' }],
        ],
        optionalSteps: [],
      },
      {
        id: 'stage-4',
        label: 'Add a forest path',
        objective: 'Use Trees to shape a route toward both Carrots',
        why: 'Route design improves the demo',
        success: 'The world has a visible path',
        steps: ['Add more Trees', 'Change movement speed', 'Change turn speed'],
        stepXp: [10, 10, 10],
        stepChecks: [
          [{ type: 'assetCount', asset: 'tree', min: 3 }],
          [{ type: 'blockValueOnAsset', asset: 'bunny', block: 'Move Forward', partIndex: 1, op: '!=', value: '12' }],
          [{ type: 'blockValueOnAsset', asset: 'bunny', block: 'Turn degrees', partIndex: 1, op: '!=', value: '15' }],
        ],
        optionalSteps: [],
      },
      {
        id: 'stage-5',
        label: 'Test the demo',
        objective: 'Make sure the automatic forest demo still finds both Carrots',
        why: 'Testing catches broken loops',
        success: 'The Bunny moves and the Carrots react',
        steps: ['Press Play and watch the path', 'Check the carrots still react', 'Keep the movement loop active'],
        stepXp: [10, 10, 10],
        stepChecks: [
          [{ type: 'assetMoved', asset: 'bunny', minDistance: 10 }],
          [{ type: 'eventIs', asset: 'carrot', event: 'bumps' }, { type: 'hasBlockOnAsset', asset: 'carrot', block: 'Say' }],
          [{ type: 'scriptOnAssetContains', asset: 'bunny', blocks: ['Forever', 'Move Forward'] }],
        ],
        optionalSteps: [],
      },
    ],
  }, constraints);

  assert.equal(result.valid, true, result.issues.join('\n'));
});
