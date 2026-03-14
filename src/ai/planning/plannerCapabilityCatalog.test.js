import test from 'node:test';
import assert from 'node:assert/strict';

import { getFallbackPlan } from './fallbackPlans.js';
import { getDifficultyProfile, getAllowedBlockNames, getUnlockedAssets } from './planRegistry.js';
import {
  buildPlanningSystemPrompt,
} from './planningPrompt.js';
import {
  getPlannerCapabilityConstraints,
  validatePlannerCapabilityCatalog,
} from './plannerCapabilityCatalog.js';
import { validateSemanticAlignment } from './planValidator.js';

function buildConstraints(xp) {
  const difficultyProfile = getDifficultyProfile(xp);
  return {
    difficultyProfile,
    unlockedAssets: getUnlockedAssets(xp),
    allowedBlockNames: getAllowedBlockNames(difficultyProfile),
    ...getPlannerCapabilityConstraints(difficultyProfile, xp),
  };
}

test('planner capability catalog stays aligned with builder metadata', () => {
  assert.deepEqual(validatePlannerCapabilityCatalog(), []);
});

test('planning prompt includes structured catalog guidance and hides locked assets', () => {
  const constraints = buildConstraints(0);
  const prompt = buildPlanningSystemPrompt({
    unlockedAssets: constraints.unlockedAssets,
    difficultyProfile: constraints.difficultyProfile,
    plannerAssets: constraints.plannerAssets,
    plannerBlocks: constraints.plannerBlocks,
    plannerEvents: constraints.plannerEvents,
    plannerCheckabilityGuide: constraints.plannerCheckabilityGuide,
  });

  assert.match(prompt, /Available Assets/);
  assert.match(prompt, /Checkability Guide/);
  assert.match(prompt, /Good Step Patterns/);
  assert.match(prompt, /Bunny/);
  assert.doesNotMatch(prompt, /Goal \(id: "goal"/);
  assert.match(prompt, /Move Forward/);
  assert.match(prompt, /When game starts/);
});

test('semantic validation rejects brittle event-as-block plans', () => {
  const constraints = buildConstraints(0);
  const badPlan = {
    summary: 'Bad event plan',
    eta: '10 minutes',
    entities: {
      assets: ['bunny'],
      blocks: ['Move Forward'],
      events: ['When game starts'],
    },
    checkpoints: ['Start'],
    stages: [
      {
        id: 'stage-1',
        label: 'Start moving',
        objective: 'Make the Bunny move',
        why: 'Events start scripts',
        success: 'The Bunny moves',
        steps: [
          'Choose which event should start the Bunny moving',
          'Place a Bunny on the canvas',
        ],
        stepXp: [10, 10],
        stepChecks: [
          [{ type: 'hasBlockOnAsset', asset: 'bunny', block: 'When game starts' }],
          [],
        ],
        optionalSteps: [],
      },
    ],
  };

  const result = validateSemanticAlignment(badPlan, constraints);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.includes('use eventIs instead')));
  assert.ok(result.issues.some((issue) => issue.includes('prefer hasAsset or assetCount')));
});

test('fallback plans satisfy semantic validation under the planner catalog', () => {
  const constraints = buildConstraints(0);
  const plan = getFallbackPlan('bunny collects carrots', 0);
  const result = validateSemanticAlignment(plan, constraints);

  assert.equal(result.valid, true, result.issues.join('\n'));
});
