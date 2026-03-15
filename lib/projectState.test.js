import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeProjectState } from './projectState.js';

test('normalizeProjectState preserves a top-level persisted plan', () => {
  const plan = {
    summary: 'Persisted plan',
    stages: [{ id: 'stage-1', steps: ['One step'] }],
  };

  const result = normalizeProjectState({
    plan,
    setupData: { idea: 'Top-level plan project' },
  });

  assert.equal(result.plan, plan);
});

test('normalizeProjectState falls back to legacy setupData.plan', () => {
  const plan = {
    summary: 'Legacy nested plan',
    stages: [{ id: 'stage-1', steps: ['Legacy step'] }],
  };

  const result = normalizeProjectState({
    setupData: {
      idea: 'Legacy project',
      plan,
    },
  });

  assert.equal(result.plan, plan);
});
