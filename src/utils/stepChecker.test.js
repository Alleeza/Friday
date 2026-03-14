import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateStepChecks } from './stepChecker.js';

function createWorkspace(eventName) {
  return {
    sceneInstances: [{ id: 'bunny', key: 'bunny-1' }],
    scriptsByInstanceKey: {
      'bunny-1': [
        {
          id: 'event-start-1',
          parts: ['When', eventName],
        },
      ],
    },
    runtimeSnapshot: null,
  };
}

test('eventIs treats "key pressed" and "key is pressed" as the same event', () => {
  const result = evaluateStepChecks(
    [{ type: 'eventIs', asset: 'bunny', event: 'key pressed' }],
    createWorkspace('key is pressed')
  );

  assert.equal(result.passed, true);
  assert.deepEqual(result.pendingAiChecks, []);
});

test('eventIs treats "sprite clicked" and "object is tapped" as the same event', () => {
  const result = evaluateStepChecks(
    [{ type: 'eventIs', asset: 'bunny', event: 'sprite clicked' }],
    createWorkspace('object is tapped')
  );

  assert.equal(result.passed, true);
  assert.deepEqual(result.pendingAiChecks, []);
});
