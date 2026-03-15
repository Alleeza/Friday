/**
 * fallbackPlans.js - Hardcoded game plan archetypes.
 *
 * These are used when the AI returns garbage, fails validation twice,
 * or when the network is unavailable. They guarantee the student always
 * gets a valid, buildable plan.
 *
 * All plans are pre-validated against the platform's available blocks/assets.
 * Asset lists are filtered at call time to respect the student's XP level.
 *
 * Pure data and pure functions; no AI or React dependencies.
 */

import { createPlan } from './planModels.js';
import { getUnlockedAssets } from './planRegistry.js';

// ---------------------------------------------------------------------------
// Raw archetype definitions
// ---------------------------------------------------------------------------

/** Bunny collects Carrots - beginner-friendly but now thorough enough to feel like a full project. */
const COLLECTOR_ARCHETYPE = {
  summary: 'Guide your Bunny through a challenge world to find every Carrot',
  eta: '20-30 minutes',
  infeasible: false,
  suggestion: null,
  entities: {
    assets: ['bunny', 'carrot', 'rock'],
    blocks: ['Change X by', 'Change Y by', 'Say', 'Play sound'],
    events: ['When key is pressed', 'When bumps'],
  },
  checkpoints: [
    'Build the world',
    'Make the Bunny move',
    'Make the Carrots react',
    'Shape the challenge',
    'Playtest the full game',
  ],
  stages: [
    {
      id: 'stage-1',
      label: 'Build your collecting world',
      objective: 'Place the player, the things to collect, and the obstacles that make the route interesting',
      why: 'A game world needs clear pieces before the code can bring them to life',
      success: 'Your canvas has a Bunny, several Carrots, and Rocks that create a route to navigate',
      steps: [
        'Place a Bunny on the canvas so your collector has a starting point',
        'Add at least 2 Carrots so there is more than one thing to find',
        'Place at least 2 Rocks to turn the collection into a small challenge',
      ],
      stepXp: [5, 10, 10],
      stepChecks: [
        [{ type: 'hasAsset', value: 'bunny' }],
        [{ type: 'assetCount', asset: 'carrot', min: 2 }],
        [{ type: 'assetCount', asset: 'rock', min: 2 }],
      ],
      optionalSteps: [
        { description: 'Add a third Carrot to make the route longer', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-2',
      label: 'Bring your collector to life',
      objective: 'Give the Bunny player controls so the student can move straight toward each Carrot',
      why: 'Input events turn a moving character into a game the student can actually play',
      success: 'Pressing keys lets the Bunny move left, right, up, and down through the world',
      steps: [
        'Choose the key event that should let the player control the Bunny',
        'Add a horizontal movement block so the Bunny can move left and right toward the Carrots',
        'Add a vertical movement block so the Bunny can move up and down around the Rocks',
      ],
      stepXp: [10, 10, 10],
      stepChecks: [
        [{ type: 'eventIs', asset: 'bunny', event: 'key is pressed' }],
        [{ type: 'hasBlockOnAsset', asset: 'bunny', block: 'Change X by' }],
        [{ type: 'hasBlockOnAsset', asset: 'bunny', block: 'Change Y by' }],
      ],
      optionalSteps: [
        { description: 'Try a smaller movement value first, then speed it up later', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-3',
      label: 'Make carrots worth finding',
      objective: 'Give the Carrots their own reaction so collecting feels interactive',
      why: 'A game becomes interactive when different objects respond to events in their own scripts',
      success: 'When the Bunny reaches a Carrot, the Carrot responds instead of acting like scenery',
      steps: [
        'Choose the event that should fire when the Bunny reaches a Carrot',
        'Add a speech reaction so the Carrot clearly celebrates when it is found',
        'Add a sound so finding a Carrot feels rewarding during play',
      ],
      stepXp: [10, 15, 10],
      stepChecks: [
        [{ type: 'eventIs', asset: 'carrot', event: 'bumps' }],
        [{ type: 'hasBlockOnAsset', asset: 'carrot', block: 'Say' }],
        [{ type: 'hasBlockOnAsset', asset: 'carrot', block: 'Play sound' }],
      ],
      optionalSteps: [
        { description: 'Make the Carrot reaction different from the Bunny movement script', bonusXp: 10 },
      ],
    },
    {
      id: 'stage-4',
      label: 'Shape the challenge',
      objective: 'Tune the route so finding every Carrot takes a bit more thought and control',
      why: 'Changing level layout and movement values is how designers turn a toy into a game',
      success: 'The Bunny has to travel through a more intentional route to reach the Carrots',
      steps: [
        'Add at least one more Rock so the collection path is not over too quickly',
        'Change the Bunny horizontal movement number from the default so the route plays differently',
        'Change the Bunny vertical movement number from the default so moving through the Rocks feels more deliberate',
      ],
      stepXp: [10, 10, 10],
      stepChecks: [
        [{ type: 'assetCount', asset: 'rock', min: 3 }],
        [{ type: 'blockValueOnAsset', asset: 'bunny', block: 'Change X by', partIndex: 1, op: '!=', value: '6' }],
        [{ type: 'blockValueOnAsset', asset: 'bunny', block: 'Change Y by', partIndex: 1, op: '!=', value: '6' }],
      ],
      optionalSteps: [
        { description: 'Move one Rock to create a tighter path for the Bunny', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-5',
      label: 'Polish and playtest',
      objective: 'Run the full game and make sure movement, collecting, and challenge all work together',
      why: 'Testing helps you spot whether every part of the game loop is really happening in play mode',
      success: 'The Bunny moves, the Carrots react, and the world feels like a complete mini-game',
      steps: [
        'Press Play and confirm the Bunny really travels across the route when you use the controls',
        'Double-check that each Carrot still has the right event and at least two reaction blocks',
        'Keep the Bunny on its player-control event while you test the whole route from start to finish',
      ],
      stepXp: [10, 10, 10],
      stepChecks: [
        [{ type: 'assetMoved', asset: 'bunny', minDistance: 10 }],
        [{ type: 'eventIs', asset: 'carrot', event: 'bumps' }, { type: 'minBlockCount', asset: 'carrot', min: 2 }],
        [{ type: 'eventIs', asset: 'bunny', event: 'key is pressed' }],
      ],
      optionalSteps: [
        { description: 'Add one more Carrot after testing if the game ends too quickly', bonusXp: 5 },
      ],
    },
  ],
};

/** Space-flavoured dodging challenge adapted from unsupported shooter ideas. */
const SPACE_DODGER_ARCHETYPE = {
  summary: 'Pilot your Bunny ship through a drifting asteroid field of Rocks',
  eta: '20-30 minutes',
  infeasible: true,
  suggestion: 'Shooting and enemy combat are not supported yet, so this starter plan turns your idea into a space-themed dodging challenge built from movement and collision ideas.',
  entities: {
    assets: ['bunny', 'rock'],
    blocks: ['Change X by', 'Change Y by', 'Forever', 'Play sound'],
    events: ['When key is pressed', 'When game starts', 'When bumps'],
  },
  checkpoints: [
    'Build the asteroid field',
    'Pilot the Bunny ship',
    'Animate the hazards',
    'Make crashes noticeable',
    'Tune and test the route',
  ],
  stages: [
    {
      id: 'stage-1',
      label: 'Build the asteroid field',
      objective: 'Create a space route with a player ship and enough Rocks to dodge around',
      why: 'Strong level setup gives the player a real challenge before any scripting begins',
      success: 'Your canvas has a Bunny ship and a field of Rocks with a route through them',
      steps: [
        'Place a Bunny on the canvas so you have a ship to pilot',
        'Add at least 3 Rocks to build the main asteroid field',
        'Place at least one more Rock if the route still feels too open and empty',
      ],
      stepXp: [5, 10, 10],
      stepChecks: [
        [{ type: 'hasAsset', value: 'bunny' }],
        [{ type: 'assetCount', asset: 'rock', min: 3 }],
        [{ type: 'assetCount', asset: 'rock', min: 4 }],
      ],
      optionalSteps: [
        { description: 'Cluster two Rocks close together to create a riskier gap', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-2',
      label: 'Pilot the Bunny ship',
      objective: 'Give the player direct controls so the Bunny can dodge through the field',
      why: 'Input events let the player make decisions instead of watching passively',
      success: 'Pressing keys lets the Bunny move across the field in multiple directions',
      steps: [
        'Choose the event that should make the Bunny react to a key press',
        'Add a horizontal movement block so the Bunny ship can dodge left and right',
        'Add a vertical movement block so the Bunny ship can dodge up and down',
      ],
      stepXp: [10, 10, 10],
      stepChecks: [
        [{ type: 'eventIs', asset: 'bunny', event: 'key is pressed' }],
        [{ type: 'hasBlockOnAsset', asset: 'bunny', block: 'Change X by' }],
        [{ type: 'hasBlockOnAsset', asset: 'bunny', block: 'Change Y by' }],
      ],
      optionalSteps: [
        { description: 'Test a smaller movement value if the ship feels too hard to dodge with', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-3',
      label: 'Animate the hazards',
      objective: 'Give at least one Rock its own movement so the asteroid field feels alive',
      why: 'Separate scripts on hazards make the challenge feel active instead of static',
      success: 'At least one Rock moves on its own when the game starts',
      steps: [
        'Pick a Rock that should start moving as soon as play begins',
        'Add a loop and movement idea so that Rock keeps drifting through space',
        'Add a second movement direction or value tweak so the hazard path is not completely predictable',
      ],
      stepXp: [10, 10, 10],
      stepChecks: [
        [{ type: 'eventIs', asset: 'rock', event: 'game starts' }],
        [{ type: 'scriptOnAssetContains', asset: 'rock', blocks: ['Forever', 'Change Y by'] }],
        [{ type: 'hasBlockOnAsset', asset: 'rock', block: 'Change X by' }],
      ],
      optionalSteps: [
        { description: 'Try a slower Rock movement first, then speed it up after testing', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-4',
      label: 'Make crashes noticeable',
      objective: 'Add a collision response so hitting an asteroid feels like an actual game event',
      why: 'Collision reactions give the player feedback and raise the stakes of the challenge',
      success: 'When the Bunny hits a Rock, the Rock has its own response instead of staying inert',
      steps: [
        'Choose the event that should fire when the Bunny crashes into a Rock',
        'Add a visible reaction on the Rock so the crash is easy to notice',
        'Make sure the Bunny control script and the Rock reaction can both exist in the same game',
      ],
      stepXp: [10, 15, 10],
      stepChecks: [
        [{ type: 'eventIs', asset: 'rock', event: 'bumps' }],
        [{ type: 'hasBlockOnAsset', asset: 'rock', block: 'Play sound' }],
        [{ type: 'eventIs', asset: 'bunny', event: 'key is pressed' }, { type: 'eventIs', asset: 'rock', event: 'bumps' }],
      ],
      optionalSteps: [
        { description: 'Use a different movement block on the Rock response than on the Bunny ship', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-5',
      label: 'Tune and test the route',
      objective: 'Play the full challenge and adjust the movement values until the route feels intentional',
      why: 'Polish happens when you test the whole system together and tune the important numbers',
      success: 'The Bunny moves in play mode, the hazards react, and the path feels like a real dodging challenge',
      steps: [
        'Change the Bunny horizontal movement number from the default so dodging feels more deliberate',
        'Press Play and confirm the Bunny ship really moves during the challenge',
        'Change a Rock movement number from its default so the asteroid field feels less static',
      ],
      stepXp: [10, 10, 10],
      stepChecks: [
        [{ type: 'blockValueOnAsset', asset: 'bunny', block: 'Change X by', partIndex: 1, op: '!=', value: '6' }],
        [{ type: 'assetMoved', asset: 'bunny', minDistance: 5 }],
        [{ type: 'blockValueOnAsset', asset: 'rock', block: 'Change Y by', partIndex: 1, op: '!=', value: '6' }],
      ],
      optionalSteps: [
        { description: 'Move a Rock after testing if one gap feels impossible to fly through', bonusXp: 5 },
      ],
    },
  ],
};

/** Crossy Road style lane-dodging challenge. */
const CROSSY_ROAD_ARCHETYPE = {
  summary: 'Guide your Chicken across busy lanes while avoiding Cars and reaching the finish',
  eta: '20-25 minutes',
  infeasible: false,
  suggestion: null,
  entities: {
    assets: ['chicken', 'car', 'goal'],
    blocks: ['Move Forward', 'Forever', 'Say'],
    events: ['When key pressed', 'When game starts', 'When bumps'],
  },
  checkpoints: ['Set up your chicken', 'Add moving traffic', 'Add the finish'],
  stages: [
    {
      id: 'stage-1',
      label: 'Your character',
      objective: 'Place the Chicken and add simple keyboard controls',
      why: 'The player needs a character and input before the game can be played',
      success: 'Your Chicken is on the screen and responds to keyboard input',
      steps: [
        'Drag the Chicken onto the canvas and place it near the bottom of the screen',
        'Choose the event that should make the Chicken react when the player presses a key',
        'Add movement blocks so the Chicken can move when keys are pressed',
      ],
      stepXp: [5, 10, 15],
      stepChecks: [
        [{ type: 'hasAsset', value: 'chicken' }],
        [{ type: 'eventIs', asset: 'chicken', event: 'key pressed' }],
        [
          { type: 'eventIs', asset: 'chicken', event: 'key pressed' },
          { type: 'hasBlockOnAsset', asset: 'chicken', block: 'Move Forward' },
        ],
      ],
      optionalSteps: [
        { description: 'Add separate key scripts so the Chicken can move in more than one direction', bonusXp: 10 },
      ],
    },
    {
      id: 'stage-2',
      label: 'Moving obstacles',
      objective: 'Place Cars in lanes and make them keep moving',
      why: 'Moving obstacles create the main challenge in a Crossy Road style game',
      success: 'Several Cars move across the screen while the Chicken tries to cross',
      steps: [
        'Drag at least 3 Cars onto the canvas and spread them across different lanes',
        'Choose the event that should make each Car start moving as soon as the game begins',
        'Add a Forever loop with movement so the Cars keep driving across the screen',
      ],
      stepXp: [10, 10, 15],
      stepChecks: [
        [{ type: 'assetCount', asset: 'car', min: 3 }],
        [{ type: 'eventIs', asset: 'car', event: 'game starts' }],
        [{ type: 'scriptOnAssetContains', asset: 'car', blocks: ['Forever', 'Move Forward'] }],
      ],
      optionalSteps: [
        { description: 'Change the movement number so one lane feels faster than another', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-3',
      label: 'Winning',
      objective: 'Add a finish line and a reaction when the Chicken reaches it',
      why: 'A clear win condition makes the game feel complete',
      success: 'The game shows a win reaction when the Chicken reaches the finish',
      steps: [
        'Drag a Goal onto the canvas and place it at the top of the screen',
        'Choose the event that should run when the Chicken reaches the Goal',
        'When this happens, make the character say "You win!"',
      ],
      stepXp: [5, 10, 15],
      stepChecks: [
        [{ type: 'hasAsset', value: 'goal' }],
        [{ type: 'eventIs', asset: 'goal', event: 'bumps' }],
        [{ type: 'minBlockCount', asset: 'goal', min: 1 }],
      ],
      optionalSteps: [
        { description: 'Add a second Goal reaction like a sound effect', bonusXp: 5 },
      ],
    },
  ],
};

/** Navigate through Rocks to reach a Goal flag. */
const MAZE_ARCHETYPE = {
  summary: 'Guide your Bunny through a maze of Rocks to reach the Goal',
  eta: '25-35 minutes',
  infeasible: false,
  suggestion: null,
  entities: {
    assets: ['bunny', 'rock', 'goal'],
    blocks: ['Change X by', 'Change Y by', 'Say'],
    events: ['When key is pressed', 'When bumps'],
  },
  checkpoints: [
    'Design the maze',
    'Control the Bunny',
    'Set the finish line',
    'Add extra challenge',
    'Playtest the full course',
  ],
  stages: [
    {
      id: 'stage-1',
      label: 'Design your maze',
      objective: 'Place the player, the walls, and the finish so the challenge has a clear shape',
      why: 'Level design creates the path the player must solve before they ever run the game',
      success: 'Your canvas has a Bunny, several Rocks, and a Goal placed at the end of the maze',
      steps: [
        'Place a Bunny on the canvas so the player has a character to guide',
        'Add at least 3 Rocks to build the maze walls',
        'Place a Goal at the far end of the route so the player has somewhere to reach',
      ],
      stepXp: [5, 10, 10],
      stepChecks: [
        [{ type: 'hasAsset', value: 'bunny' }],
        [{ type: 'assetCount', asset: 'rock', min: 3 }],
        [{ type: 'hasAsset', value: 'goal' }],
      ],
      optionalSteps: [
        { description: 'Add one more Rock if the maze still feels too open', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-2',
      label: 'Control your character',
      objective: 'Give the Bunny responsive movement so the player can navigate the maze',
      why: 'Input scripts are what turn a level layout into a game the student can actually play',
      success: 'The Bunny responds to key presses and can move through the path in all directions',
      steps: [
        'Choose the event that should make the Bunny respond when a key is pressed',
        'Add a horizontal movement block so the Bunny can move left and right through the maze',
        'Add a vertical movement block so the Bunny can move up and down around the walls',
      ],
      stepXp: [10, 10, 10],
      stepChecks: [
        [{ type: 'eventIs', asset: 'bunny', event: 'key is pressed' }],
        [{ type: 'hasBlockOnAsset', asset: 'bunny', block: 'Change X by' }],
        [{ type: 'hasBlockOnAsset', asset: 'bunny', block: 'Change Y by' }],
      ],
      optionalSteps: [
        { description: 'Try a smaller movement value if the maze feels too slippery', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-3',
      label: 'Set the finish line',
      objective: 'Give the Goal a reaction so reaching the end feels rewarding',
      why: 'Win conditions are events too, and the Goal needs its own script to show success',
      success: 'The Goal reacts when the Bunny reaches it instead of acting like a silent marker',
      steps: [
        'Choose the event that should fire when the Bunny reaches the Goal',
        'Add a celebration reaction on the Goal so the finish feels obvious',
        'Test that the Goal script can trigger when the Bunny reaches the end of the maze',
      ],
      stepXp: [10, 15, 10],
      stepChecks: [
        [{ type: 'eventIs', asset: 'goal', event: 'bumps' }],
        [{ type: 'hasBlockOnAsset', asset: 'goal', block: 'Say' }],
        [{ type: 'eventIs', asset: 'goal', event: 'bumps' }, { type: 'hasBlockOnAsset', asset: 'goal', block: 'Say' }],
      ],
      optionalSteps: [
        { description: 'Change the Goal speech text so the celebration matches your theme', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-4',
      label: 'Add extra challenge',
      objective: 'Make the route trickier so reaching the Goal feels earned',
      why: 'Good games often improve after you tune the obstacles instead of stopping at the first version',
      success: 'The maze has a tighter path and at least one Rock that can react when bumped',
      steps: [
        'Add at least one more Rock so the route has another twist or dead end to avoid',
        'Choose a collision event for a Rock if you want the maze walls to respond when bumped',
        'Add a visible reaction on that Rock so hitting it feels noticeable during play',
      ],
      stepXp: [10, 10, 15],
      stepChecks: [
        [{ type: 'assetCount', asset: 'rock', min: 4 }],
        [{ type: 'eventIs', asset: 'rock', event: 'bumps' }],
        [{ type: 'minBlockCount', asset: 'rock', min: 1 }],
      ],
      optionalSteps: [
        { description: 'Use a different reaction on the Rock than on the Goal so each object feels distinct', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-5',
      label: 'Polish and conquer',
      objective: 'Play the full maze and tune the movement until reaching the Goal feels fair and satisfying',
      why: 'Playtesting helps the student balance the path, the controls, and the finish condition together',
      success: 'The Bunny can move through the maze, the Goal celebrates, and the challenge feels complete',
      steps: [
        'Change the Bunny horizontal movement number from the default so the controls match your maze size',
        'Press Play and confirm the Bunny really travels when you use the controls',
        'Change the Bunny vertical movement number from the default if the maze still feels too slippery',
      ],
      stepXp: [10, 10, 10],
      stepChecks: [
        [{ type: 'blockValueOnAsset', asset: 'bunny', block: 'Change X by', partIndex: 1, op: '!=', value: '6' }],
        [{ type: 'assetMoved', asset: 'bunny', minDistance: 5 }],
        [{ type: 'blockValueOnAsset', asset: 'bunny', block: 'Change Y by', partIndex: 1, op: '!=', value: '6' }],
      ],
      optionalSteps: [
        { description: 'Move the Goal after testing if the maze is too short or too easy', bonusXp: 5 },
      ],
    },
  ],
};

/** Free exploration - move around, discover things, and interact with them. */
const EXPLORER_ARCHETYPE = {
  summary: 'Guide your Bunny through a forest path to find every Carrot',
  eta: '20-30 minutes',
  infeasible: false,
  suggestion: null,
  entities: {
    assets: ['bunny', 'tree', 'carrot'],
    blocks: ['Change X by', 'Change Y by', 'Say', 'Play sound'],
    events: ['When key is pressed', 'When bumps'],
  },
  checkpoints: [
    'Build the world',
    'Get the Bunny exploring',
    'Make discoveries react',
    'Add forest surprises',
    'Tune and test the adventure',
  ],
  stages: [
    {
      id: 'stage-1',
      label: 'Build your world',
      objective: 'Place the explorer, the scenery, and the discoveries that make the world worth visiting',
      why: 'A world needs landmarks and rewards before the player has a reason to move around it',
      success: 'Your canvas has a Bunny, several Trees, and several Carrots to discover',
      steps: [
        'Place a Bunny on the canvas so you have an explorer to control',
        'Add at least 2 Trees to create the main forest landmarks',
        'Place at least 2 Carrots around the world so the Bunny has discoveries to reach',
      ],
      stepXp: [5, 10, 10],
      stepChecks: [
        [{ type: 'hasAsset', value: 'bunny' }],
        [{ type: 'assetCount', asset: 'tree', min: 2 }],
        [{ type: 'assetCount', asset: 'carrot', min: 2 }],
      ],
      optionalSteps: [
        { description: 'Add a third Tree if the world still feels too empty', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-2',
      label: 'Bring your explorer to life',
      objective: 'Create player controls so the Bunny can explore the forest path on purpose',
      why: 'Input events give the student agency instead of turning exploration into passive animation',
      success: 'Pressing keys lets the Bunny move around the forest to search for Carrots',
      steps: [
        'Choose the key event that should let the player guide the Bunny',
        'Add a horizontal movement block so the Bunny can move left and right through the forest',
        'Add a vertical movement block so the Bunny can move up and down to reach the hidden Carrots',
      ],
      stepXp: [10, 10, 10],
      stepChecks: [
        [{ type: 'eventIs', asset: 'bunny', event: 'key is pressed' }],
        [{ type: 'hasBlockOnAsset', asset: 'bunny', block: 'Change X by' }],
        [{ type: 'hasBlockOnAsset', asset: 'bunny', block: 'Change Y by' }],
      ],
      optionalSteps: [
        { description: 'Try a slower movement value if the Bunny rushes past the world too quickly', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-3',
      label: 'Make discoveries count',
      objective: 'Give the Carrots a reaction so the Bunny finding them feels meaningful',
      why: 'Objects need their own event scripts if the game is going to reward exploration',
      success: 'When the Bunny reaches a Carrot, the Carrot reacts instead of staying silent',
      steps: [
        'Choose the event that should fire when the Bunny reaches a Carrot',
        'Add a speech reaction on the Carrot so the discovery is obvious',
        'Add a sound so finding the Carrot feels like a reward',
      ],
      stepXp: [10, 15, 10],
      stepChecks: [
        [{ type: 'eventIs', asset: 'carrot', event: 'bumps' }],
        [{ type: 'hasBlockOnAsset', asset: 'carrot', block: 'Say' }],
        [{ type: 'hasBlockOnAsset', asset: 'carrot', block: 'Play sound' }],
      ],
      optionalSteps: [
        { description: 'Make the Carrot response different from the Bunny movement script', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-4',
      label: 'Add forest surprises',
      objective: 'Turn the Trees into landmarks and soft obstacles so finding every Carrot takes real movement choices',
      why: 'Pathing and secondary interactions make the forest feel like a game world instead of an empty backdrop',
      success: 'The forest has a clearer route, and at least one Tree reacts when the Bunny bumps it',
      steps: [
        'Add at least one more Tree so the Bunny has to move around the forest landmarks to reach every Carrot',
        'Choose the event that should make a Tree respond when the Bunny reaches it',
        'Add a visible reaction on the Tree so the forest has a second kind of surprise',
      ],
      stepXp: [10, 10, 15],
      stepChecks: [
        [{ type: 'assetCount', asset: 'tree', min: 3 }],
        [{ type: 'eventIs', asset: 'tree', event: 'bumps' }],
        [{ type: 'hasBlockOnAsset', asset: 'tree', block: 'Say' }],
      ],
      optionalSteps: [
        { description: 'Give the Tree a different reaction from the Carrot so discoveries feel varied', bonusXp: 5 },
      ],
    },
    {
      id: 'stage-5',
      label: 'Final touches',
      objective: 'Play the whole adventure and adjust the movement until exploring the world feels intentional',
      why: 'Testing the full exploration loop helps the student tune both the world and the motion that drives it',
      success: 'The Bunny travels through the world, discoveries react, and the adventure feels complete',
      steps: [
        'Change the Bunny horizontal movement number from the default so the exploration pace fits your forest route',
        'Change the Bunny vertical movement number from the default so moving through the Trees feels intentional',
        'Press Play and confirm the Bunny really moves through the forest while the discoveries still react',
      ],
      stepXp: [10, 10, 10],
      stepChecks: [
        [{ type: 'blockValueOnAsset', asset: 'bunny', block: 'Change X by', partIndex: 1, op: '!=', value: '6' }],
        [{ type: 'blockValueOnAsset', asset: 'bunny', block: 'Change Y by', partIndex: 1, op: '!=', value: '6' }],
        [{ type: 'assetMoved', asset: 'bunny', minDistance: 10 }, { type: 'eventIs', asset: 'carrot', event: 'bumps' }],
      ],
      optionalSteps: [
        { description: 'Add one more Carrot if the adventure still ends too quickly', bonusXp: 5 },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Archetype keyword mapping
// ---------------------------------------------------------------------------

const ARCHETYPES = [
  {
    keywords: ['collect', 'carrot', 'coin', 'gather', 'pick up', 'grab', 'bunny'],
    plan: COLLECTOR_ARCHETYPE,
    requiredAssets: ['bunny', 'carrot', 'rock'],
  },
  {
    keywords: ['space', 'ship', 'spaceship', 'shooter', 'asteroid', 'asteroids', 'dodge', 'survive', 'survival'],
    plan: SPACE_DODGER_ARCHETYPE,
    requiredAssets: ['bunny', 'rock'],
  },
  {
    keywords: ['crossy', 'road', 'traffic', 'lane', 'lanes', 'car', 'cars', 'chicken'],
    plan: CROSSY_ROAD_ARCHETYPE,
    requiredAssets: ['chicken', 'car'],
  },
  {
    keywords: ['maze', 'navigate', 'obstacle', 'avoid', 'rock', 'wall', 'path', 'goal'],
    plan: MAZE_ARCHETYPE,
    requiredAssets: ['bunny', 'rock', 'goal'],
  },
  {
    keywords: ['explore', 'world', 'walk', 'move', 'wander', 'roam', 'discover', 'forest', 'find'],
    plan: EXPLORER_ARCHETYPE,
    requiredAssets: ['bunny', 'tree', 'carrot'],
  },
];

function selectFallbackArchetype(normalised, unlockedIds) {
  let bestArchetype = null;
  let bestScore = 0;

  for (const archetype of ARCHETYPES) {
    const canUse = archetype.requiredAssets.every((id) => unlockedIds.has(id));
    if (!canUse) continue;

    const score = archetype.keywords.filter((kw) => normalised.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestArchetype = archetype;
    }
  }

  return bestArchetype ?? ARCHETYPES[0];
}

function inferFallbackMetadata(ideaText, selectedPlan) {
  const normalised = ideaText.toLowerCase();

  if (['shoot', 'shooter', 'laser', 'bullet', 'enemy', 'enemies'].some((kw) => normalised.includes(kw))) {
    return {
      infeasible: true,
      suggestion: selectedPlan === SPACE_DODGER_ARCHETYPE
        ? 'Shooting and enemy combat are not supported yet, so we adapted this into a space-themed dodging challenge using movement and obstacles.'
        : 'Combat and projectile mechanics are not supported yet, so we adapted your idea into a simpler movement-based challenge.',
    };
  }

  if (['jump', 'jumping', 'gravity', 'platformer'].some((kw) => normalised.includes(kw))) {
    return {
      infeasible: true,
      suggestion: 'Jumping and gravity are not supported yet, so we adapted your idea into a movement-and-navigation challenge instead.',
    };
  }

  if (['multiplayer', 'two player', '2 player', 'pvp'].some((kw) => normalised.includes(kw))) {
    return {
      infeasible: true,
      suggestion: 'Multiplayer is not supported yet, so we adapted your idea into a single-player starter plan.',
    };
  }

  return {
    infeasible: Boolean(selectedPlan?.infeasible),
    suggestion: selectedPlan?.suggestion ?? null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a hardcoded fallback plan appropriate for the student's idea and XP.
 *
 * Keyword-matches the idea to pick the closest archetype.
 * Falls back to the collector plan if nothing matches.
 * Filters asset references to only include assets the student has unlocked.
 *
 * @param {string} ideaText - The student's original idea (for keyword matching)
 * @param {number} xp       - Student's current XP (for asset filtering)
 * @returns {import('./planModels.js').Plan}
 */
export function getFallbackPlan(ideaText = '', xp = 0) {
  const normalised = ideaText.toLowerCase();
  const unlockedIds = new Set(getUnlockedAssets(xp).map((a) => a.id));
  const bestArchetype = selectFallbackArchetype(normalised, unlockedIds);

  // Filter the plan's entities to only include unlocked assets
  const rawPlan = bestArchetype.plan;
  const filteredAssets = rawPlan.entities.assets.filter((id) => unlockedIds.has(id));

  const adapted = {
    ...rawPlan,
    entities: {
      ...rawPlan.entities,
      assets: filteredAssets.length > 0 ? filteredAssets : ['bunny'],
    },
  };

  return createPlan(adapted);
}

export function getFallbackPlanResultMeta(ideaText = '', xp = 0) {
  const normalised = ideaText.toLowerCase();
  const unlockedIds = new Set(getUnlockedAssets(xp).map((a) => a.id));
  const bestArchetype = selectFallbackArchetype(normalised, unlockedIds);
  return inferFallbackMetadata(ideaText, bestArchetype.plan);
}
