export function calculateLevel(totalXp) {
  return Math.floor(Math.sqrt(totalXp / 50)) + 1;
}

export function getXpForLevel(level) {
  if (level <= 1) return 0;
  return Math.pow(level - 1, 2) * 50;
}

export const levelUnlocks = {
  2: { items: ['apple'], events: ['timer'] },
  3: { items: ['berry'], actions: ['jump'] },
  4: { actions: ['rotate'], skins: ['glow'] },
  5: { items: ['star'], events: ['keyboard_input'] }
};
