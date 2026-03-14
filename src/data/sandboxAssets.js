const backdropImageModules = import.meta.glob('../../assets/*.png', {
  eager: true,
  import: 'default',
});

export const sandboxAssets = [
  { id: 'bunny', emoji: '🐰', label: 'Bunny', unlockXp: 0 },
  { id: 'carrot', emoji: '🥕', label: 'Carrot', unlockXp: 0 },
  { id: 'rock', emoji: '🪨', label: 'Rock', unlockXp: 0 },
  { id: 'tree', emoji: '🌳', label: 'Tree', unlockXp: 0 },
  { id: 'goal', emoji: '🏁', label: 'Goal', unlockXp: 20 },
  { id: 'coin', emoji: '🪙', label: 'Coin', unlockXp: 30 },
  { id: 'cloud', emoji: '☁️', label: 'Cloud', unlockXp: 40 },
  { id: 'sun', emoji: '🌞', label: 'Sun', unlockXp: 50 },
  { id: 'star', emoji: '⭐', label: 'Star', unlockXp: 60 },
  { id: 'heart', emoji: '❤️', label: 'Heart', unlockXp: 70 },
  { id: 'gift', emoji: '🎁', label: 'Gift', unlockXp: 80 },
  { id: 'key', emoji: '🗝️', label: 'Key', unlockXp: 90 },
];

export const backdropAssets = Object.entries(backdropImageModules)
  .map(([path, src]) => {
    const match = path.match(/\/(\d+)\.png$/);
    const number = Number(match?.[1] || 0);

    return {
      id: `backdrop-${number}`,
      label: `Backdrop ${number}`,
      previewLabel: `${number}`,
      src,
      unlockXp: 0,
      type: 'backdrop',
      sortOrder: number,
    };
  })
  .filter((asset) => asset.sortOrder > 0)
  .sort((a, b) => a.sortOrder - b.sortOrder);
