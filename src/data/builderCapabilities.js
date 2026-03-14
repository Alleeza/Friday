export const EVENT_OPTIONS = [
  'game starts',
  'sprite clicked',
  'object is tapped',
  'key pressed',
  'key is pressed',
  'timer reaches 0',
  'score reaches 10',
  'bumps',
  'is touching',
  'is not touching (pro)',
];

export const DEFAULT_EVENT = 'game starts';

export const BLOCK_PALETTE = {
  Collisions: [
    { id: 'bumps', tone: 'collision', parts: [{ type: 'asset', value: 'Self' }, 'bumps', { type: 'asset', value: 'Self' }] },
    { id: 'touching', tone: 'collision', parts: [{ type: 'asset', value: 'Self' }, 'is touching', { type: 'asset', value: 'Self' }] },
    { id: 'not-touching-pro', tone: 'collision', parts: [{ type: 'asset', value: 'Self' }, 'is not touching', { type: 'asset', value: 'Self' }, '(PRO)'] },
  ],
  Conditionals: [
    { id: 'cond-eq', tone: 'condition', parts: [{ label: 'A' }, '=', { label: 'B' }] },
    { id: 'cond-neq', tone: 'condition', parts: [{ label: 'A' }, '≠', { label: 'B' }] },
    { id: 'cond-lt', tone: 'condition', parts: [{ label: 'A' }, '<', { label: 'B' }] },
    { id: 'cond-gt', tone: 'condition', parts: [{ label: 'A' }, '>', { label: 'B' }] },
    { id: 'cond-lte', tone: 'condition', parts: [{ label: 'A' }, '≤', { label: 'B' }] },
    { id: 'cond-gte', tone: 'condition', parts: [{ label: 'A' }, '≥', { label: 'B' }] },
    { id: 'cond-and', tone: 'condition', parts: [{ label: 'A' }, 'and', { label: 'B' }] },
    { id: 'cond-or', tone: 'condition', parts: [{ label: 'A' }, 'or', { label: 'B' }] },
    { id: 'cond-not', tone: 'condition', parts: ['not', { label: 'A' }] },
    { id: 'cond-flipped', tone: 'condition', parts: ['flipped'] },
    { id: 'cond-matches', tone: 'condition', parts: [{ label: 'A' }, 'matches', { label: 'B' }] },
  ],
  Movement: [
    { id: 'move-forward', tone: 'movement', parts: ['Move Forward', { label: '12' }] },
    { id: 'turn', tone: 'movement', parts: ['Turn degrees', { label: '15' }] },
    { id: 'set-rotation', tone: 'movement', parts: ['Set rotation style', { type: 'dropdown', value: 'dont rotate', options: ['dont rotate', 'left-right', 'all around'] }] },
    { id: 'change-x', tone: 'movement', parts: ['Change X by', { label: '6' }] },
    { id: 'change-y', tone: 'movement', parts: ['Change Y by', { label: '6' }] },
    { id: 'go-to', tone: 'movement', parts: ['Go to X', { label: '320' }, 'Y', { label: '220' }] },
    { id: 'point-direction', tone: 'movement', parts: ['Point in direction', { label: '90' }] },
  ],
  'Looks & Sounds': [
    { id: 'switch-costume', tone: 'looks', parts: ['Switch costume to', { type: 'dropdown', value: 'bunny jump', options: ['bunny jump', 'tree glow', 'crab legs'] }] },
    { id: 'next-costume', tone: 'sound', parts: ['Next costume'] },
    { id: 'play-sound', tone: 'sound', parts: ['Play sound', { type: 'dropdown', value: 'jump', options: ['jump', 'coin', 'Human Beatbox1'] }, 'until done'] },
    { id: 'say', tone: 'looks', parts: ['Say', { label: 'Hello!' }] },
  ],
  Control: [
    { id: 'forever', tone: 'control', type: 'loop', parts: ['Forever'] },
    { id: 'repeat', tone: 'control', type: 'loop', parts: ['Repeat', { label: '5' }, 'times'] },
    { id: 'while', tone: 'control', type: 'loop', parts: ['While', { type: 'dropdown', value: 'time > 0', options: ['score < 10', 'score >= 10', 'is alive', 'time > 0', 'time <= 0'] }] },
    { id: 'wait', tone: 'control', parts: ['Wait', { label: '1' }, 'seconds'] },
  ],
  Variables: [
    { id: 'change-score', tone: 'variables', parts: ['Change score by', { label: '1' }] },
    { id: 'set-score', tone: 'variables', parts: ['Set score to', { label: '0' }] },
    { id: 'change-time', tone: 'variables', parts: ['Change timer by', { label: '2' }] },
    { id: 'set-time', tone: 'variables', parts: ['Set timer to', { label: '30' }] },
    { id: 'set-alive', tone: 'variables', parts: ['Set alive to', { type: 'dropdown', value: 'true', options: ['true', 'false'] }] },
  ],
};
