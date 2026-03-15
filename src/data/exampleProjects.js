import { getFallbackPlan } from '../ai/planning/fallbackPlans.js';

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createBunnyCarrotExampleProject() {
  const idea = 'A bunny chases a carrot across the field.';

  return {
    idea,
    title: 'Bunny Chases Carrot',
    plan: getFallbackPlan(idea, 0),
    initialScene: cloneValue([]),
    initialScripts: cloneValue({}),
  };
}

export function createCrossyRoadExampleProject() {
  const idea = 'A chicken crosses a busy road, avoids cars, and reaches the goal.';

  return {
    idea,
    title: 'Crossy Road Dash',
    plan: getFallbackPlan(idea, 20),
    initialScene: cloneValue([]),
    initialScripts: cloneValue({}),
  };
}
