import { achievementsData } from './achievements';

export function distributeStepRewards(totalXp, stepCount) {
  if (!stepCount) return [];
  const baseReward = Math.floor(totalXp / stepCount);
  const remainder = totalXp % stepCount;
  return Array.from({ length: stepCount }, (_, index) => baseReward + (index < remainder ? 1 : 0));
}

export function sumNumericValues(record) {
  return Object.values(record || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

export function calculateAchievementXp(achievementIds = []) {
  const achievementXpById = Object.fromEntries(
    achievementsData.map((achievement) => [achievement.id, achievement.reward_xp || 0]),
  );
  return (achievementIds || []).reduce((sum, achievementId) => sum + (achievementXpById[achievementId] || 0), 0);
}

export function collectUnlocksForLevel(levelUnlocks, level) {
  const items = new Set();
  const events = new Set();
  const actions = new Set();
  const skins = new Set();

  for (let currentLevel = 2; currentLevel <= level; currentLevel += 1) {
    const unlocks = levelUnlocks[currentLevel];
    if (!unlocks) continue;
    (unlocks.items || []).forEach((item) => items.add(item));
    (unlocks.events || []).forEach((eventName) => events.add(eventName));
    (unlocks.actions || []).forEach((action) => actions.add(action));
    (unlocks.skins || []).forEach((skin) => skins.add(skin));
  }

  return {
    items: Array.from(items),
    events: Array.from(events),
    actions: Array.from(actions),
    skins: Array.from(skins),
  };
}
