export const missionsData = [
  {
    id: 'mission_1',
    title: 'Feed the Bunny',
    description: 'Help the bunny collect carrots.',
    learningObjectives: ['drag objects', 'detect collision', 'trigger event'],
    reward_xp: 50,
    steps: [
      {
        id: 'add_bunny',
        description: 'Add a Bunny to the canvas',
        target: 1,
        check: (event) => event.type === 'ObjectAdded' && event.payload?.type === 'bunny'
      },
      {
        id: 'add_carrot',
        description: 'Add Carrots to the canvas',
        target: 2,
        check: (event) => event.type === 'ObjectAdded' && event.payload?.type === 'carrot'
      },
      {
        id: 'collect_carrots',
        description: 'Collect 2 carrots',
        target: 2,
        check: (event) => event.type === 'ItemCollected' && event.payload?.item === 'carrot'
      }
    ]
  },
  {
    id: 'mission_2',
    title: 'Hungry Bunny',
    description: 'Collect 5 carrots before time runs out.',
    learningObjectives: ['timers', 'variables'],
    reward_xp: 100,
    steps: [
      {
        id: 'set_timer',
        description: 'Set a timer',
        target: 1,
        check: (event) => event.type === 'BlockUsed' && event.payload?.blockType === 'Variables' && event.payload?.action?.includes('time')
      },
      {
        id: 'collect_5_carrots',
        description: 'Collect 5 carrots',
        target: 5,
        check: (event) => event.type === 'ItemCollected' && event.payload?.item === 'carrot'
      }
    ]
  },
  {
    id: 'mission_3',
    title: 'Carrot Maze',
    description: 'Collect carrots while avoiding obstacles.',
    learningObjectives: ['conditions', 'object movement'],
    reward_xp: 150,
    steps: [
      {
        id: 'move_bunny',
        description: 'Use movement blocks on the bunny',
        target: 3,
        check: (event) => event.type === 'BlockUsed' && event.payload?.blockType === 'Movement'
      },
      {
        id: 'avoid_obstacles',
        description: 'Complete level without hitting obstacles',
        target: 1,
        check: (event) => event.type === 'LevelCompleted' && event.payload?.hits === 0
      }
    ]
  }
];
