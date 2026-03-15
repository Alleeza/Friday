const backdropImageModules = import.meta.glob('../../assets/*.png', {
  eager: true,
  import: 'default',
});

export const sandboxAssets = [
  { id: 'bunny', emoji: '🐰', label: 'Bunny', unlockXp: 0 },
  { id: 'chicken', emoji: '🐓', label: 'Chicken', unlockXp: 0 },
  { id: 'carrot', emoji: '🥕', label: 'Carrot', unlockXp: 0 },
  { id: 'car', emoji: '🚗', label: 'Car', unlockXp: 0 },
  { id: 'rock', emoji: '🪨', label: 'Rock', unlockXp: 0 },
  { id: 'tree', emoji: '🌳', label: 'Tree', unlockXp: 0 },
  { id: 'frog', emoji: '🐸', label: 'Frog', unlockXp: 10 },
  { id: 'goal', emoji: '🏁', label: 'Goal', unlockXp: 20 },
  { id: 'flower', emoji: '🌸', label: 'Flower', unlockXp: 20 },
  { id: 'coin', emoji: '🪙', label: 'Coin', unlockXp: 30 },
  { id: 'mushroom', emoji: '🍄', label: 'Mushroom', unlockXp: 30 },
  { id: 'cloud', emoji: '☁️', label: 'Cloud', unlockXp: 40 },
  { id: 'rainbow', emoji: '🌈', label: 'Rainbow', unlockXp: 40 },
  { id: 'sun', emoji: '🌞', label: 'Sun', unlockXp: 50 },
  { id: 'robot', emoji: '🤖', label: 'Robot', unlockXp: 50 },
  { id: 'star', emoji: '⭐', label: 'Star', unlockXp: 60 },
  { id: 'rocket', emoji: '🚀', label: 'Rocket', unlockXp: 60 },
  { id: 'heart', emoji: '❤️', label: 'Heart', unlockXp: 70 },
  { id: 'ghost', emoji: '👻', label: 'Ghost', unlockXp: 70 },
  { id: 'gift', emoji: '🎁', label: 'Gift', unlockXp: 80 },
  { id: 'crown', emoji: '👑', label: 'Crown', unlockXp: 80 },
  { id: 'key', emoji: '🗝️', label: 'Key', unlockXp: 90 },
  { id: 'planet', emoji: '🪐', label: 'Planet', unlockXp: 90 },
  { id: 'dragon', emoji: '🐉', label: 'Dragon', unlockXp: 100 },
  { id: 'castle', emoji: '🏰', label: 'Castle', unlockXp: 100 },
  { id: 'treasure', emoji: '💎', label: 'Gem', unlockXp: 110 },
  { id: 'volcano', emoji: '🌋', label: 'Volcano', unlockXp: 120 },
  { id: 'unicorn', emoji: '🦄', label: 'Unicorn', unlockXp: 130 },
  { id: 'satellite', emoji: '🛰️', label: 'Satellite', unlockXp: 140 },
];

export const backdropAssets = Object.entries(backdropImageModules)
  .map(([path, src]) => {
    const match = path.match(/\/(\d+)\.png$/);
    const number = Number(match?.[1] || 0);
    const unlockXp = number <= 4
      ? 0
      : number <= 8
        ? 20
        : number <= 12
          ? 50
          : 80;

    return {
      id: `backdrop-${number}`,
      label: `Backdrop ${number}`,
      previewLabel: `${number}`,
      src,
      unlockXp,
      type: 'backdrop',
      sortOrder: number,
    };
  })
  .filter((asset) => asset.sortOrder > 0)
  .sort((a, b) => a.sortOrder - b.sortOrder);
