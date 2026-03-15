let backdropImageModules = {};

try {
  backdropImageModules = import.meta.glob('../../assets/*.png', {
    eager: true,
    import: 'default',
  });
} catch {
  // Node-based tests do not provide Vite's import.meta.glob helper.
}

export const sandboxAssets = [
  { id: 'bunny', emoji: '🐰', label: 'Bunny', unlockLevel: 1 },
  { id: 'chicken', emoji: '🐓', label: 'Chicken', unlockLevel: 1 },
  { id: 'carrot', emoji: '🥕', label: 'Carrot', unlockLevel: 1 },
  { id: 'car', emoji: '🚗', label: 'Car', unlockLevel: 1 },
  { id: 'rock', emoji: '🪨', label: 'Rock', unlockLevel: 1 },
  { id: 'tree', emoji: '🌳', label: 'Tree', unlockLevel: 1 },
  { id: 'frog', emoji: '🐸', label: 'Frog', unlockLevel: 2 },
  { id: 'goal', emoji: '🏁', label: 'Goal', unlockLevel: 2 },
  { id: 'flower', emoji: '🌸', label: 'Flower', unlockLevel: 2 },
  { id: 'coin', emoji: '🪙', label: 'Coin', unlockLevel: 2 },
  { id: 'mushroom', emoji: '🍄', label: 'Mushroom', unlockLevel: 2 },
  { id: 'cloud', emoji: '☁️', label: 'Cloud', unlockLevel: 3 },
  { id: 'rainbow', emoji: '🌈', label: 'Rainbow', unlockLevel: 3 },
  { id: 'sun', emoji: '🌞', label: 'Sun', unlockLevel: 3 },
  { id: 'robot', emoji: '🤖', label: 'Robot', unlockLevel: 3 },
  { id: 'star', emoji: '⭐', label: 'Star', unlockLevel: 3 },
  { id: 'rocket', emoji: '🚀', label: 'Rocket', unlockLevel: 3 },
  { id: 'heart', emoji: '❤️', label: 'Heart', unlockLevel: 4 },
  { id: 'ghost', emoji: '👻', label: 'Ghost', unlockLevel: 4 },
  { id: 'gift', emoji: '🎁', label: 'Gift', unlockLevel: 4 },
  { id: 'crown', emoji: '👑', label: 'Crown', unlockLevel: 4 },
  { id: 'key', emoji: '🗝️', label: 'Key', unlockLevel: 4 },
  { id: 'planet', emoji: '🪐', label: 'Planet', unlockLevel: 4 },
  { id: 'dragon', emoji: '🐉', label: 'Dragon', unlockLevel: 5 },
  { id: 'castle', emoji: '🏰', label: 'Castle', unlockLevel: 5 },
  { id: 'treasure', emoji: '💎', label: 'Gem', unlockLevel: 5 },
  { id: 'volcano', emoji: '🌋', label: 'Volcano', unlockLevel: 5 },
  { id: 'unicorn', emoji: '🦄', label: 'Unicorn', unlockLevel: 5 },
  { id: 'satellite', emoji: '🛰️', label: 'Satellite', unlockLevel: 5 },
];

export const backdropAssets = Object.entries(backdropImageModules)
  .map(([path, src]) => {
    const match = path.match(/\/(\d+)\.png$/);
    const number = Number(match?.[1] || 0);
    const unlockLevel = number <= 4
      ? 1
      : number <= 8
        ? 2
        : number <= 12
          ? 3
          : 4;

    return {
      id: `backdrop-${number}`,
      label: `Backdrop ${number}`,
      previewLabel: `${number}`,
      src,
      unlockLevel,
      type: 'backdrop',
      sortOrder: number,
    };
  })
  .filter((asset) => asset.sortOrder > 0)
  .sort((a, b) => a.sortOrder - b.sortOrder);
