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

// ---------------------------------------------------------------------------
// JSON schema reference (used inside prompts)
// ---------------------------------------------------------------------------

const PLAN_SCHEMA = `{
  "summary": "One sentence describing the game",
  "eta": "Estimated time e.g. '15–20 minutes'",
  "infeasible": false,
  "suggestion": null,
  "entities": {
    "assets": ["asset-id-1", "asset-id-2"],
    "blocks": ["Move Forward", "Forever"],
    "events": ["When game starts"]
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
        "Hint about the next small action"
      ],
      "stepXp": [10, 10],
      "stepChecks": [
        [{ "type": "hasAsset", "value": "bunny" }],
        [{ "type": "eventIs", "asset": "bunny", "event": "game starts" }],
        [{ "type": "scriptOnAssetContains", "asset": "bunny", "blocks": ["Forever", "Move Forward"] }]
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
}) {
  const assetList = formatAssetCatalog(plannerAssets);
  const blockList = formatBlockCatalog(plannerBlocks);
  const eventList = formatEventCatalog(plannerEvents);
  const checkabilityList = formatCheckabilityGuide(plannerCheckabilityGuide);
  const unlockedAssetLabels = unlockedAssets.map((asset) => asset.label).join(', ');

  return `You are a game plan architect for CodeQuest — a block-based game building platform for kids aged 8–14.

Your job is to take a student's game idea and produce a structured, stage-by-stage JSON plan that is ONLY built from the available platform capabilities listed below.

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
- Maximum ${difficultyProfile.maxStages} stage(s) total
- Maximum ${difficultyProfile.maxAssets} distinct asset type(s) per plan
- Student currently has these unlocked assets: ${unlockedAssetLabels || 'none'}
- Do NOT suggest blocks from categories not listed above

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
- stepXp values: simple steps = 5–10 XP, challenge steps = 15–25 XP

## Builder Reality You Must Respect
- Every placed object starts with a seed event block set to "When game starts"
- Event choice is meaningful and should usually be checked with {"type":"eventIs", ...}
- Default movement values matter: Move Forward defaults to 12, Turn degrees defaults to 15, Wait defaults to 1, Repeat defaults to 5
- If a step is visible in the canvas, script, or runtime, prefer a programmatic stepCheck over []
- Do NOT use non-programmatic or subjective checks of any kind
- Do not write steps that imply mechanics the checker cannot infer, such as "make it feel exciting" or "leave enough space"

## Infeasibility Protocol
If the student's idea requires capabilities that do NOT exist in the available blocks (e.g. shooting, gravity, jumping, health bars, multiplayer):
1. Set "infeasible": true at the top level
2. Set "suggestion": a brief, friendly explanation of what CAN be done instead
3. Still generate a COMPLETE plan for the adapted, feasible version of the idea

## Examples of Infeasible Ideas
- Shooting, lasers, bullets → infeasible (no projectile blocks)
- Jumping / gravity / platformer → infeasible (no physics blocks)
- Multiple players → infeasible (no multiplayer support)
- Health/damage system → infeasible (no collision detection or variables for HP)
- Enemy AI that chases player → infeasible (no pathfinding or AI blocks)

## Adaptation Principle
When an idea is partially infeasible, keep the theme but replace impossible mechanics:
- "Shoot enemies" → "Move towards enemies and try to reach the goal before they block you"
- "Jump over obstacles" → "Navigate around obstacles using left/right movement"
- "Collect health packs" → "Collect coins to increase your score"

## stepChecks — Machine-Readable Completion Rules
For each step, provide a parallel "stepChecks" array (same length as "steps"). Each entry is an array of check objects that must ALL be true for that step to auto-complete. Use [] for steps that cannot be auto-checked.

### Programmatic checks (prefer these when possible):
- {"type":"hasAsset","value":"<asset-id>"}  — asset is placed on canvas
- {"type":"assetCount","asset":"<asset-id>","min":2}  — at least N copies of that asset are on the canvas
- {"type":"eventIs","asset":"<asset-id>","event":"<event-name>"}  — asset's main event block is set to this event
- {"type":"hasBlockOnAsset","asset":"<asset-id>","block":"<block-name>"}  — asset's script contains this block
- {"type":"scriptOnAssetContains","asset":"<asset-id>","blocks":["Block A","Block B"]}  — asset's script contains ALL listed blocks
- {"type":"minBlockCount","asset":"<asset-id>","min":<number>}  — asset's script has at least N non-event blocks
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
- Good: "Choose which event should start the Bunny moving" with [{"type":"eventIs","asset":"bunny","event":"game starts"}]
- Good: "What loop keeps the Bunny moving the whole time?" with [{"type":"scriptOnAssetContains","asset":"bunny","blocks":["Forever","Move Forward"]}]
- Good: "Change the movement number so it feels faster or slower" with [{"type":"blockValueOnAsset","asset":"bunny","block":"Move Forward","partIndex":1,"op":"!=","value":"12"}]
- Good: "Place at least 3 Rocks on the canvas to build your obstacle field" with [{"type":"assetCount","asset":"rock","min":3}]

## Brittle Patterns To Avoid
- Avoid steps that mention an observable event choice but use []
- Avoid using event names as if they were regular action blocks in hasBlockOnAsset
- Avoid subjective steps like "leave enough space", "make it look right", or "tune it until it feels good"
- Avoid plans that require a specific mechanic when a broader observable behavior would be more robust
- Avoid telling the student to add unsupported systems like enemies with health, jumping, inventory, or locks`;
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
 *   allowedBlockNames: string[],
 *   availableEvents: string[],
 * }} constraints
 * @returns {string}
 */
export function buildRefinementSystemPrompt(constraints) {
  const base = buildPlanningSystemPrompt(constraints);
  return `${base}

## Refinement Mode
You will receive the CURRENT plan as JSON and a REFINEMENT REQUEST from the student or teacher.
Produce a MODIFIED version of the plan that addresses the request while keeping all the constraints above.
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
