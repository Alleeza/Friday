/**
 * planningPrompt.js — Builds AI prompts for plan generation and refinement.
 *
 * These prompts are separate from the Questy chat tutor prompt (systemPrompt.js).
 * The planning prompt instructs the AI to act as a structured JSON plan architect,
 * not a conversational tutor.
 *
 * All functions are pure; no AI or React dependencies.
 */

function formatList(items, formatter) {
  return items.map((item) => formatter(item)).join('\n');
}

function formatAssetCatalog(assets) {
  return formatList(assets, (asset) => (
    `  - ${asset.emoji} ${asset.label} (id: "${asset.id}", unlock: ${asset.unlockXp} XP)\n` +
    `    Roles: ${asset.roles.join(', ')}\n` +
    `    Good for: ${asset.commonUses.join('; ')}\n` +
    `    Pairs well with: ${asset.commonPairings.length ? asset.commonPairings.join(', ') : 'none'}\n` +
    `    Constraints: ${asset.constraints.length ? asset.constraints.join('; ') : 'none'}\n` +
    `    Usually check with: ${asset.preferredChecks.join(', ')}`
  ));
}

function formatBlockCatalog(blocks) {
  const groups = blocks.reduce((acc, block) => {
    acc[block.plannerCategory] = acc[block.plannerCategory] || [];
    acc[block.plannerCategory].push(block);
    return acc;
  }, {});

  return Object.entries(groups)
    .map(([category, categoryBlocks]) => (
      `  ${category.toUpperCase()}:\n` +
      formatList(categoryBlocks, (block) => (
        `    - ${block.name} (${block.blockType})\n` +
        `      Purpose: ${block.purpose}\n` +
        `      Good for: ${block.commonUses.join('; ')}\n` +
        `      Editable parts: ${block.editableParts.length ? block.editableParts.map((part) => `${part.name} default=${part.defaultValue}`).join(', ') : 'none'}\n` +
        `      Preferred checks: ${block.preferredChecks.join(', ')}`
      ))
    ))
    .join('\n');
}

function formatEventCatalog(events) {
  return formatList(events, (event) => (
    `  - ${event.displayName} (builder value: "${event.value}")\n` +
    `    Fires when: ${event.summary}\n` +
    `    Good for: ${event.commonUses.join('; ')}\n` +
    `    Seed event: ${event.seedEvent ? 'yes' : 'no'}\n` +
    `    Preferred check: ${event.preferredCheck}`
  ));
}

function formatCheckabilityGuide(guides) {
  return formatList(guides, (guide) => `  - ${guide.type}: ${guide.useFor}`);
}

function formatGameplayRequirements(gameplayRequirements = {}) {
  const lines = [];

  if (gameplayRequirements.requiresPlayerAgency) {
    lines.push('This idea should be player-controlled. The main character should usually use "When key is pressed" as the core control event.');
  }

  if (gameplayRequirements.preferAxisMovement) {
    lines.push('Prefer simple WASD-style axis movement using "Change X by" and "Change Y by" for the player.');
  }

  if (gameplayRequirements.discourageRotationMovement) {
    lines.push('Avoid making rotation or steering the main player control. Do not default to "Turn degrees" unless the idea is specifically about piloting, spinning, drifting, or rotation.');
  }

  if (gameplayRequirements.forbidAutoplayCoreLoop) {
    lines.push('Do NOT make the core loop "press Play and watch the character wander." Avoid "When game starts" + "Forever" as the main player loop.');
  } else if (gameplayRequirements.autoplayRequested) {
    lines.push('Autoplay is allowed here because the student explicitly asked for an automatic/demo-style experience.');
  }

  if (gameplayRequirements.requiresInteractiveTarget) {
    lines.push('Include at least one interactive target object with a "When bumps" event and a visible reaction script.');
  }

  if (gameplayRequirements.requiresExplicitObjective) {
    lines.push('State a concrete objective with an actual finish condition, such as "find both carrots", "collect every coin", or "reach the goal".');
  }

  if (gameplayRequirements.preferObstacleOrPathing) {
    lines.push('Include a stage that adds route, obstacles, landmarks, or pathing so the objective takes effort and feels like a game.');
  }

  if (lines.length === 0) {
    lines.push('If you are unsure how the game should play, prefer player choice, interaction, and a clear goal over passive animation.');
  }

  return formatList(lines, (line) => `  - ${line}`);
}

// ---------------------------------------------------------------------------
// JSON schema reference (used inside prompts)
// ---------------------------------------------------------------------------

const PLAN_SCHEMA = `{
  "summary": "One sentence describing the game",
  "eta": "Estimated time e.g. '20-30 minutes'",
  "infeasible": false,
  "suggestion": null,
  "entities": {
    "assets": ["asset-id-1", "asset-id-2"],
    "blocks": ["Change X by", "Change Y by"],
    "events": ["When key is pressed"]
  },
  "checkpoints": ["Milestone 1", "Milestone 2"],
  "stages": [
    {
      "id": "stage-1",
      "label": "Short stage title",
      "objective": "What the student achieves in this stage",
      "why": "The programming concept this teaches",
      "success": "How to know the stage is done",
      "steps": [
        "Hint about the first small action",
        "Hint about the next small action",
        "Hint about the final small action in this stage"
      ],
      "stepXp": [10, 10, 10],
      "stepChecks": [
        [{ "type": "hasAsset", "value": "bunny" }],
        [{ "type": "eventIs", "asset": "bunny", "event": "key is pressed" }],
        [{ "type": "hasBlockOnAsset", "asset": "bunny", "block": "Change X by" }]
      ],
      "optionalSteps": [
        { "description": "A stretch goal for advanced students", "bonusXp": 5 }
      ]
    }
  ]
}`;

// ---------------------------------------------------------------------------
// System prompt for initial plan generation
// ---------------------------------------------------------------------------

/**
 * Builds the system prompt for generating a new game plan.
 *
 * @param {{
 *   unlockedAssets: Array<{ id: string, label: string, emoji: string }>,
 *   difficultyProfile: import('./planRegistry.js').DifficultyProfile,
 *   plannerAssets: Array<import('./plannerCapabilityCatalog.js').PlannerAssetCapability>,
 *   plannerBlocks: Array<import('./plannerCapabilityCatalog.js').PlannerBlockCapability>,
 *   plannerEvents: Array<import('./plannerCapabilityCatalog.js').PlannerEventCapability>,
 *   plannerCheckabilityGuide: Array<import('./plannerCapabilityCatalog.js').PlannerCheckabilityGuide>,
 *   gameplayRequirements: import('./gameplayRequirements.js').GameplayRequirements,
 * }} options
 * @returns {string}
 */
export function buildPlanningSystemPrompt({
  unlockedAssets,
  difficultyProfile,
  plannerAssets,
  plannerBlocks,
  plannerEvents,
  plannerCheckabilityGuide,
  gameplayRequirements,
}) {
  const assetList = formatAssetCatalog(plannerAssets);
  const blockList = formatBlockCatalog(plannerBlocks);
  const eventList = formatEventCatalog(plannerEvents);
  const checkabilityList = formatCheckabilityGuide(plannerCheckabilityGuide);
  const gameplayGuidance = formatGameplayRequirements(gameplayRequirements);
  const unlockedAssetLabels = unlockedAssets.map((asset) => asset.label).join(', ');

  return `You are a game plan architect for CodeQuest — a block-based game building platform for kids aged 8-14.

Your job is to take a student's game idea and produce a structured, stage-by-stage JSON plan that is ONLY built from the available platform capabilities listed below.

## Plan Completeness
Every plan must walk the student through the full game creation lifecycle:
- World Setup — place all characters, scenery, obstacles, goals, and collectibles needed for the game world
- Character Behavior — choose events, loops, and movement so the main character actually does something in play mode
- Interactions — make other objects react through bumps or other supported events so the world is not inert
- Game Mechanics — add a clear rule such as collecting, reaching a target, surviving hazards, scoring, timers, or another concrete win/loss condition that fits the available blocks
- Polish & Testing — customize values, add small touches that are actually buildable, and verify the game works in play mode

A plan with only 2-3 stages is NEVER sufficient for a complete game plan in CodeQuest.
If the student's idea seems simple, expand it into a fuller tutorial arc with setup, behavior, interaction, challenge, and playtesting rather than stopping early.

## Gameplay Requirements For This Idea
${gameplayGuidance}

## Output Format
Return ONLY valid JSON. No markdown code fences. No explanation text before or after. No comments inside the JSON. The JSON must exactly match this schema:

${PLAN_SCHEMA}

## STRICT CONSTRAINTS — You MUST follow these exactly

### Available Assets (ONLY use these exact ids)
${assetList}

### Available Blocks (ONLY reference these block names and behaviors)
${blockList}

### Available Events (ONLY use these exact event names)
${eventList}

### Checkability Guide
${checkabilityList}

### Scope Rules (student is at "${difficultyProfile.label}" level)
- Minimum ${difficultyProfile.minStages} stages required, maximum ${difficultyProfile.maxStages} allowed
- Each stage must have at least ${difficultyProfile.minStepsPerStage} steps (aim for 3-5 per stage)
- Maximum ${difficultyProfile.maxAssets} distinct asset type(s) per plan
- Student currently has these unlocked assets: ${unlockedAssetLabels || 'none'}
- Do NOT suggest blocks from categories not listed above
- Do NOT collapse the full game lifecycle into one or two oversized stages

### ETA Guidance
- Plans with 4-5 stages should usually estimate 20-30 minutes
- Plans with 6-8 stages should usually estimate 30-45 minutes
- Match the ETA to the actual amount of work in the plan

## Gameplay Quality Rules
- For ideas about exploring, finding, collecting, reaching, dodging, or navigating, default to player-controlled play unless the student explicitly asks for automatic behavior
- For those ideas, the main character should usually use "When key is pressed" as the core control event
- For most player-controlled games, prefer WASD-style movement built from "Change X by" and "Change Y by"
- Do NOT make "Turn degrees" or steering the default player control scheme unless the theme clearly needs piloting, spinning, drifting, or rotation
- A plan is INVALID if the core loop is "press Play and watch the Bunny wander" unless the student explicitly asked for an automatic, idle, demo, or screensaver experience
- State the objective concretely: "find both carrots", "collect every coin", "reach the goal", or "survive until the timer ends"
- If the idea mentions finding, collecting, or reaching an object, that object MUST react with "When bumps" and at least one action block

## Pedagogical Rules
- Steps must be HINTS that guide the student's thinking, NOT exact instructions
  - BAD:  "Add a Forever loop, then put Move Forward 12 inside it"
  - GOOD: "Think about how to make your character keep moving — which loop type runs forever?"
- Each step should be ONE small action
- Every required step must map to a concrete, observable workspace change that can be measured with a programmatic stepCheck
- Avoid vague wording about spacing, feel, excitement, or quality unless you can rewrite it into something the checker can verify directly
- The "why" field must connect to a real programming concept (e.g. loops, events, variables)
- The "success" field must be observable: something the student can see or test
- Keep stage labels short and encouraging (e.g. "Bring your world to life")
- Make the stage order feel like a real tutorial: build the world, create behavior, add interaction, add a clear challenge or game rule, then polish and test
- stepXp values: simple steps = 5-10 XP, challenge steps = 15-25 XP

## Builder Reality You Must Respect
- Every placed object starts with a seed event block set to "When game starts"
- Event choice is meaningful and should usually be checked with {"type":"eventIs", ...}
- Default movement values matter: Change X by defaults to 6, Change Y by defaults to 6, Move Forward defaults to 12, Turn degrees defaults to 15, Wait defaults to 1, Repeat defaults to 5
- If a step is visible in the canvas, script, or runtime, prefer a programmatic stepCheck over []
- Use score/timer mechanics only if the listed available blocks actually support them
- Do NOT use non-programmatic or subjective checks of any kind
- Do not write steps that imply mechanics the checker cannot infer, such as "make it feel exciting" or "leave enough space"

## Infeasibility Protocol
If the student's idea requires capabilities that do NOT exist in the available blocks (e.g. shooting, gravity, jumping, health bars, multiplayer):
1. Set "infeasible": true at the top level
2. Set "suggestion": a brief, friendly explanation of what CAN be done instead
3. Still generate a COMPLETE plan for the adapted, feasible version of the idea

## Examples of Infeasible Ideas
- Shooting, lasers, bullets -> infeasible (no projectile blocks)
- Jumping / gravity / platformer -> infeasible (no physics blocks)
- Multiple players -> infeasible (no multiplayer support)
- Health/damage system -> infeasible (no supported health system)
- Enemy AI that chases player -> infeasible (no pathfinding or AI blocks)

## Adaptation Principle
When an idea is partially infeasible, keep the theme but replace impossible mechanics:
- "Shoot enemies" -> "Move towards enemies and try to reach the goal before they block you"
- "Jump over obstacles" -> "Navigate around obstacles using left/right movement"
- "Collect health packs" -> "Collect reward objects that change the score or trigger a reaction"

## stepChecks — Machine-Readable Completion Rules
For each step, provide a parallel "stepChecks" array (same length as "steps"). Each entry is an array of check objects that must ALL be true for that step to auto-complete. Use [] for steps that cannot be auto-checked.

### Programmatic checks (prefer these when possible):
- {"type":"hasAsset","value":"<asset-id>"}  — asset is placed on canvas
- {"type":"assetCount","asset":"<asset-id>","min":2}  — at least N copies of that asset are on the canvas
- {"type":"eventIs","asset":"<asset-id>","event":"<event-name>"}  — asset's main event block is set to this event
- {"type":"hasBlockOnAsset","asset":"<asset-id>","block":"<block-name>"}  — asset's script contains this block
- {"type":"scriptOnAssetContains","asset":"<asset-id>","blocks":["Block A","Block B"]}  — asset's script contains ALL listed blocks
- {"type":"minBlockCount","asset":"<asset-id>","min":2}  — asset's script has at least N non-event blocks
- {"type":"blockValueOnAsset","asset":"<asset-id>","block":"<block-name>","partIndex":1,"op":"!=","value":"12"}  — a matching block has a specific configured value
- {"type":"assetMoved","asset":"<asset-id>","minDistance":10}  — in play mode, the asset has moved from its starting position

### Rules:
- Always scope checks to a specific asset using "asset" or "value" fields — never check globally
- The default seed script auto-adds "When game starts" to every placed object — do NOT use hasBlockOnAsset with a bare event block; use "eventIs" instead when the chosen event is itself meaningful to the step
- Prefer programmatic checks over [] whenever the student's work is already visible in the canvas, script, or runtime state
- Use [] only for genuinely internal reflection steps that leave no observable trace in the workspace
- Never use any subjective or non-programmatic checker
- "stepChecks" length MUST equal "steps" length

## Good Step Patterns
- Good: "Choose which event should let the player move the Bunny" with [{"type":"eventIs","asset":"bunny","event":"key is pressed"}]
- Good: "Add a horizontal movement block so one key can move the Bunny left or right" with [{"type":"hasBlockOnAsset","asset":"bunny","block":"Change X by"}]
- Good: "Add a vertical movement block so another key can move the Bunny up or down" with [{"type":"hasBlockOnAsset","asset":"bunny","block":"Change Y by"}]
- Good: "Pick which event should make a Rock start moving on its own" with [{"type":"eventIs","asset":"rock","event":"game starts"}]
- Good: "Change the horizontal movement number so it feels faster or slower" with [{"type":"blockValueOnAsset","asset":"bunny","block":"Change X by","partIndex":1,"op":"!=","value":"6"}]
- Good: "Place at least 3 Rocks on the canvas to build your obstacle field" with [{"type":"assetCount","asset":"rock","min":3}]
- Good: "What event should make the Carrot react when the Bunny arrives?" with [{"type":"eventIs","asset":"carrot","event":"bumps"}]
- Good: "Add an action so the Carrot celebrates when it is bumped" with [{"type":"hasBlockOnAsset","asset":"carrot","block":"Say"}]

## Example: Thorough 5-stage plan for "bunny explores forest and finds carrots"
Stage 1 — "Build your forest world"
  Steps:
  - "Place a Bunny on the canvas so your explorer has a starting point"
  - "Add at least 2 Trees to make the world feel like a forest"
  - "Place at least 2 Carrots around the map so there is something to discover"
  stepChecks:
  - [{"type":"hasAsset","value":"bunny"}]
  - [{"type":"assetCount","asset":"tree","min":2}]
  - [{"type":"assetCount","asset":"carrot","min":2}]
Stage 2 — "Bring your bunny explorer to life"
  Steps:
  - "Choose the key event that should let the player guide the Bunny"
  - "Add a horizontal movement block so the Bunny can move left and right through the forest"
  - "Add a vertical movement block so the Bunny can move up and down to reach the Carrots"
  stepChecks:
  - [{"type":"eventIs","asset":"bunny","event":"key is pressed"}]
  - [{"type":"hasBlockOnAsset","asset":"bunny","block":"Change X by"}]
  - [{"type":"hasBlockOnAsset","asset":"bunny","block":"Change Y by"}]
Stage 3 — "Make carrots react when found"
  Steps:
  - "Choose the event that should fire when the Bunny reaches a Carrot"
  - "Add a visible reaction so the Carrot celebrates when it is found"
  - "Run the game and check that the Carrot script can actually trigger"
  stepChecks:
  - [{"type":"eventIs","asset":"carrot","event":"bumps"}]
  - [{"type":"hasBlockOnAsset","asset":"carrot","block":"Say"}]
  - [{"type":"eventIs","asset":"carrot","event":"bumps"},{"type":"hasBlockOnAsset","asset":"carrot","block":"Say"}]
Stage 4 — "Add a forest path"
  Steps:
  - "Add at least 1 more Tree so the Bunny has to move around landmarks to reach both Carrots"
  - "Change the Bunny horizontal movement number from the default so the controls fit your forest route"
  - "Change the Bunny vertical movement number from the default so moving through the Trees feels intentional"
  stepChecks:
  - [{"type":"assetCount","asset":"tree","min":3}]
  - [{"type":"blockValueOnAsset","asset":"bunny","block":"Change X by","partIndex":1,"op":"!=","value":"6"}]
  - [{"type":"blockValueOnAsset","asset":"bunny","block":"Change Y by","partIndex":1,"op":"!=","value":"6"}]
Stage 5 — "Polish and playtest"
  Steps:
  - "Add a sound so finding a Carrot feels more rewarding"
  - "Press Play and confirm the Bunny really moves when you use the controls"
  - "Double-check that every Carrot still reacts when the Bunny finds it"
  stepChecks:
  - [{"type":"hasBlockOnAsset","asset":"carrot","block":"Play sound"}]
  - [{"type":"assetMoved","asset":"bunny","minDistance":10}]
  - [{"type":"eventIs","asset":"carrot","event":"bumps"},{"type":"minBlockCount","asset":"carrot","min":2}]

## Game Design Patterns — CRITICAL
A plan must result in a PLAYABLE GAME, not just objects sitting on a canvas. Every plan should include at least one interaction loop and one clear challenge, goal, or rule. Use these patterns:

### Collection pattern (for "collect", "find", "gather", "get" ideas):
- The PLAYER should usually move via player control, such as a key event on the main character
- For most beginner-friendly collection games, use axis movement like "Change X by" and "Change Y by" instead of steering
- Each COLLECTIBLE has a "bumps" event with a visible reaction script
- That reaction can use movement, looks, sound, or score-related blocks depending on what is listed in the available blocks
- Without a reaction on the collectible, there is no game — just a character moving past inert objects

### Exploration pattern (for "explore", "discover", "wander" ideas):
- The PLAYER should usually move via key presses so the student is actively exploring the world
- Prefer axis movement like "Change X by" and "Change Y by" unless the idea clearly needs steering or piloting
- The plan should include a clear discovery objective, such as finding every target object
- SCENERY or landmarks should help shape a route, obstacle field, or path through the world
- Include at least one object with a "bumps" event and a visible reaction so exploration has a payoff

### Navigation/maze pattern (for "maze", "navigate", "reach", "path" ideas):
- The PLAYER moves via key presses
- The player usually moves with horizontal and vertical controls, not rotation
- OBSTACLES are placed to create a path
- A GOAL object or final target reacts when reached

### Dodge/survival pattern (for "dodge", "avoid", "survive" ideas):
- The PLAYER moves via key presses
- The player usually dodges with axis movement so left/right/up/down inputs feel direct
- HAZARDS move automatically or create a narrow route
- Collision between player and hazard should trigger a visible consequence that fits the available blocks

### KEY RULE:
If the student's idea mentions collecting, finding, or reaching objects, those objects MUST have a "bumps" event with at least one reaction block. A plan where collectibles have empty scripts is ALWAYS wrong.
If the student's idea does NOT explicitly ask for autoplay, a plan where the main character only wanders automatically is ALWAYS wrong.

## Brittle Patterns To Avoid
- Avoid steps that mention an observable event choice but use []
- Avoid using event names as if they were regular action blocks in hasBlockOnAsset
- Avoid subjective steps like "leave enough space", "make it look right", or "tune it until it feels good"
- Avoid plans that turn player-facing ideas into passive autoplay toys
- Avoid making the player steer or rotate unless the theme clearly calls for it
- Avoid plans that require a specific mechanic when a broader observable behavior would be more robust
- Avoid telling the student to add unsupported systems like enemies with health, jumping, inventory, or locks
- Avoid plans where collectible or goal objects have no script — every interactive object needs at least a bumps event and one action block
- Avoid plans where only the player has a script — if the idea mentions other objects, they should DO something`;
}

// ---------------------------------------------------------------------------
// Refinement prompts
// ---------------------------------------------------------------------------

/**
 * Builds a system prompt for refining an existing plan.
 * Reuses the same constraints but focuses the AI on modification.
 *
 * @param {{
 *   unlockedAssets: Array<{ id: string, label: string, emoji: string }>,
 *   difficultyProfile: import('./planRegistry.js').DifficultyProfile,
 *   plannerAssets: Array<import('./plannerCapabilityCatalog.js').PlannerAssetCapability>,
 *   plannerBlocks: Array<import('./plannerCapabilityCatalog.js').PlannerBlockCapability>,
 *   plannerEvents: Array<import('./plannerCapabilityCatalog.js').PlannerEventCapability>,
 *   plannerCheckabilityGuide: Array<import('./plannerCapabilityCatalog.js').PlannerCheckabilityGuide>,
 *   gameplayRequirements: import('./gameplayRequirements.js').GameplayRequirements,
 * }} constraints
 * @returns {string}
 */
export function buildRefinementSystemPrompt(constraints) {
  const base = buildPlanningSystemPrompt(constraints);
  return `${base}

## Refinement Mode
You will receive the CURRENT plan as JSON and a REFINEMENT REQUEST from the student or teacher.
Produce a MODIFIED version of the plan that addresses the request while keeping all the constraints above.
Keep the plan thorough — do not shrink it below the required stage and step minimums.
Return ONLY the complete updated JSON plan — no explanation, no commentary.`;
}

/**
 * Builds the user-turn message for a refinement request.
 * This goes in the "user" role of the conversation history.
 *
 * @param {import('./planModels.js').Plan} currentPlan
 * @param {string} refinementRequest
 * @returns {string}
 */
export function buildRefinementUserMessage(currentPlan, refinementRequest) {
  return `CURRENT PLAN:
${JSON.stringify(currentPlan, null, 2)}

REFINEMENT REQUEST:
${refinementRequest}

Please produce the updated plan as JSON.`;
}

/**
 * Builds a retry user message when semantic validation failed.
 * @param {string} originalIdea
 * @param {string[]} issues
 * @returns {string}
 */
export function buildSemanticRetryMessage(originalIdea, issues) {
  return `Your previous plan had semantic planning problems. The steps or checks do not line up well with the actual builder capabilities:
${issues.map((issue) => `  - ${issue}`).join('\n')}

Please regenerate the plan for:
"${originalIdea}"

Keep the plan buildable, observable, measurable, and limited to supported programmatic step checks.`;
}

/**
 * Builds a retry user message when gameplay quality validation failed.
 * @param {string} originalIdea
 * @param {string[]} issues
 * @returns {string}
 */
export function buildGameplayRetryMessage(originalIdea, issues) {
  return `Your previous plan is technically structured, but it still does not produce a good playable game:
${issues.map((issue) => `  - ${issue}`).join('\n')}

Please regenerate the plan for:
"${originalIdea}"

Fix every gameplay issue above. This must be a player-controlled game unless the idea explicitly asked for autoplay. The plan needs a clear objective, interactive target reactions, and a meaningful challenge.`;
}

// ---------------------------------------------------------------------------
// Retry prompts (when validation fails)
// ---------------------------------------------------------------------------

/**
 * Builds a retry user message when structural validation failed.
 * @param {string} originalIdea
 * @param {string[]} structureErrors
 * @returns {string}
 */
export function buildStructureRetryMessage(originalIdea, structureErrors) {
  return `Your previous response had these structural problems:
${structureErrors.map((e) => `  - ${e}`).join('\n')}

Please generate a valid plan for this idea, fixing all the issues above:
"${originalIdea}"`;
}

/**
 * Builds a retry user message when feasibility validation failed.
 * @param {string} originalIdea
 * @param {string[]} violations
 * @returns {string}
 */
export function buildFeasibilityRetryMessage(originalIdea, violations) {
  return `Your previous plan had these feasibility problems — it referenced things that don't exist on this platform:
${violations.map((v) => `  - ${v}`).join('\n')}

Please regenerate the plan for:
"${originalIdea}"

Fix every problem listed above. Only use the assets, blocks, and events listed in your constraints.`;
}
