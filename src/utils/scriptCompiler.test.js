import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScriptsByInstance } from './scriptCompiler.js';

test('key is pressed scripts compile into key-specific event channels', () => {
  const scriptsByInstanceKey = {
    bunny1: [
      {
        id: 'event-start',
        type: 'block',
        parts: ['When', 'key is pressed', { type: 'dropdown', value: 'w' }],
        tone: 'events',
      },
      {
        id: 'move-forward',
        type: 'block',
        parts: ['Move Forward', { label: '10' }],
        tone: 'movement',
      },
      {
        id: 'event-start-2',
        type: 'block',
        parts: ['When', 'key is pressed', { type: 'dropdown', value: 'a' }],
        tone: 'events',
      },
      {
        id: 'change-y',
        type: 'block',
        parts: ['Change Y by', { label: '10' }],
        tone: 'movement',
      },
    ],
  };

  const { programsByKey, errorsByKey } = compileScriptsByInstance(scriptsByInstanceKey);

  assert.deepEqual(errorsByKey, {});
  assert.ok(programsByKey.bunny1);
  assert.equal(programsByKey.bunny1.events['key is pressed'], undefined);
  assert.equal(programsByKey.bunny1.events['key is pressed|w']?.length, 1);
  assert.equal(programsByKey.bunny1.events['key is pressed|a']?.length, 1);
  assert.equal(programsByKey.bunny1.events['key is pressed|d'], undefined);
});
