export const achievementsData = [
  {
    id: 'first_builder',
    name: 'First Builder',
    description: 'Add first object to canvas',
    condition: (eventsHistory, state) => eventsHistory.some(e => e.type === 'ObjectAdded'),
    reward_xp: 20
  },
  {
    id: 'collector',
    name: 'Collector',
    description: 'Collect 10 carrots',
    condition: (eventsHistory, state) => {
      const carrotCollects = eventsHistory.filter(e => e.type === 'ItemCollected' && e.payload?.item === 'carrot');
      return carrotCollects.length >= 10;
    },
    reward_xp: 50
  },
  {
    id: 'fast_learner',
    name: 'Fast Learner',
    description: 'Complete a mission under 30 seconds',
    condition: (eventsHistory, state) => eventsHistory.some(e => e.type === 'MissionCompleted' && e.payload?.timeTaken <= 30),
    reward_xp: 100
  },
  {
    id: 'explorer',
    name: 'Explorer',
    description: 'Use 5 different block types',
    condition: (eventsHistory, state) => {
      const blockTypes = new Set(eventsHistory.filter(e => e.type === 'BlockUsed').map(e => e.payload?.blockType));
      return blockTypes.size >= 5;
    },
    reward_xp: 50
  }
];
