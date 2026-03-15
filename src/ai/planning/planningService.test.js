import test from 'node:test';
import assert from 'node:assert/strict';

import { getFallbackPlan } from './fallbackPlans.js';
import { PlanningService } from './planningService.js';

const FOREST_PROMPT = 'Make a game where a bunny explores a forest of trees and finds carrots.';

function createForestPlan({ autoplay = false } = {}) {
  const plan = structuredClone(getFallbackPlan(FOREST_PROMPT, 0));

  if (!autoplay) {
    return plan;
  }

  plan.summary = 'Watch the Bunny automatically roam a forest path and find every Carrot.';
  plan.entities.blocks = ['Move Forward', 'Turn degrees', 'Forever', 'Say', 'Play sound'];
  plan.entities.events = ['When game starts', 'When bumps'];
  plan.checkpoints[1] = 'Start autoplay';

  plan.stages[1] = {
    ...plan.stages[1],
    label: 'Start autoplay',
    objective: 'Make the Bunny move automatically when play begins',
    why: 'Loops keep motion going without player input',
    success: 'The Bunny moves by itself around the forest',
    steps: [
      'Keep the start event on the Bunny',
      'Add a forever movement loop',
      'Add turning so the Bunny wanders around the forest',
    ],
    stepChecks: [
      [{ type: 'eventIs', asset: 'bunny', event: 'game starts' }],
      [{ type: 'scriptOnAssetContains', asset: 'bunny', blocks: ['Forever', 'Move Forward'] }],
      [{ type: 'scriptOnAssetContains', asset: 'bunny', blocks: ['Forever', 'Turn degrees'] }],
    ],
  };

  plan.stages[4] = {
    ...plan.stages[4],
    objective: 'Test the automatic forest demo from start to finish',
    success: 'The Bunny roams the forest and the Carrots still react',
    steps: [
      'Press Play and watch the autoplay route',
      'Double-check that each Carrot still reacts when found',
      'Keep the Bunny moving automatically while you test the full route',
    ],
    stepChecks: [
      [{ type: 'assetMoved', asset: 'bunny', minDistance: 10 }],
      [{ type: 'eventIs', asset: 'carrot', event: 'bumps' }, { type: 'minBlockCount', asset: 'carrot', min: 2 }],
      [{ type: 'scriptOnAssetContains', asset: 'bunny', blocks: ['Forever', 'Move Forward'] }],
    ],
  };

  return plan;
}

class MockProvider {
  constructor(responses) {
    this.responses = [...responses];
    this.calls = [];
    this.model = 'mock-model';
    this.maxTokens = 8192;
    this.apiUrl = '/mock';
  }

  async sendMessage({ messages, systemPrompt }) {
    this.calls.push({
      messages,
      systemPrompt,
    });

    if (this.responses.length === 0) {
      throw new Error('No more mock responses queued');
    }

    return {
      text: JSON.stringify(this.responses.shift()),
    };
  }
}

test('planning service retries when gameplay validation rejects an autoplay plan', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ok: true }),
  });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const provider = new MockProvider([
    createForestPlan({ autoplay: true }),
    createForestPlan({ autoplay: false }),
  ]);
  const planner = new PlanningService(provider, { xp: 0 });

  const result = await planner.generatePlan(FOREST_PROMPT);

  assert.equal(result.ok, true);
  assert.equal(result.usedFallback, false);
  assert.equal(provider.calls.length, 2);
  assert.match(provider.calls[1].messages[0].content, /autoplay toy/i);
  assert.ok(result.plan.stages.some((stage) => stage.stepChecks.flat().some((check) => (
    check.type === 'eventIs' && check.asset === 'bunny' && check.event === 'key is pressed'
  ))));
  assert.ok(result.plan.stages.some((stage) => stage.stepChecks.flat().some((check) => (
    check.type === 'hasBlockOnAsset' && check.asset === 'bunny' && check.block === 'Change X by'
  ))));
  assert.ok(result.plan.stages.some((stage) => stage.stepChecks.flat().some((check) => (
    check.type === 'hasBlockOnAsset' && check.asset === 'bunny' && check.block === 'Change Y by'
  ))));
  assert.doesNotMatch(result.plan.summary, /automatic/i);
});
