import { getFallbackPlan } from '../ai/planning/fallbackPlans.js';

const BUNNY_KEY = 'example-bunny';
const CARROT_KEY = 'example-carrot';

const BUNNY_CARROT_SCENE = [
  {
    id: 'bunny',
    emoji: '🐰',
    label: 'Bunny',
    x: 220,
    y: 330,
    scale: 1,
    rotation: 0,
    key: BUNNY_KEY,
  },
  {
    id: 'carrot',
    emoji: '🥕',
    label: 'Carrot',
    x: 860,
    y: 330,
    scale: 1,
    rotation: 0,
    key: CARROT_KEY,
  },
];

const BUNNY_CARROT_SCRIPTS = {
  [BUNNY_KEY]: [
    { id: 'event-start', type: 'block', parts: ['When', 'game starts'], tone: 'events' },
    {
      id: 'set-rotation-style',
      type: 'block',
      tone: 'movement',
      parts: [
        'Set rotation style',
        { type: 'dropdown', value: 'left-right', options: ['dont rotate', 'left-right', 'all around'] },
      ],
    },
    {
      id: 'forever-move',
      type: 'loop',
      tone: 'control',
      parts: ['Forever'],
      children: [
        {
          id: 'move-forward',
          type: 'block',
          tone: 'movement',
          parts: ['Move Forward', { label: '4' }],
        },
      ],
    },
  ],
  [CARROT_KEY]: [
    { id: 'event-start', type: 'block', parts: ['When', 'bumps'], tone: 'events' },
    {
      id: 'change-score',
      type: 'block',
      tone: 'variables',
      parts: ['Change score by', { label: '1' }],
    },
    {
      id: 'say-crunch',
      type: 'block',
      tone: 'looks',
      parts: ['Say', { label: 'Crunch!' }],
    },
  ],
};

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createBunnyCarrotExampleProject() {
  const idea = 'A bunny chases a carrot across the field.';

  return {
    idea,
    title: 'Bunny Chases Carrot',
    plan: getFallbackPlan(idea, 0),
    initialScene: cloneValue(BUNNY_CARROT_SCENE),
    initialScripts: cloneValue(BUNNY_CARROT_SCRIPTS),
  };
}
