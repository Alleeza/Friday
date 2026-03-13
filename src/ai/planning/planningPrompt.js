/**
 * planningPrompt.js — Builds AI prompts for plan generation and refinement.
 *
 * These prompts are separate from the Questy chat tutor prompt (systemPrompt.js).
 * The planning prompt instructs the AI to act as a structured JSON plan architect,
 * not a conversational tutor.
 *
 * All functions are pure; no AI or React dependencies.
 */

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
 *   allowedBlockNames: string[],
 *   availableEvents: string[],
 * }} options
 * @returns {string}
 */
export function buildPlanningSystemPrompt({
  unlockedAssets,
  difficultyProfile,
  allowedBlockNames,
  availableEvents,
}) {
  const assetList = unlockedAssets
    .map((a) => `  - ${a.emoji} ${a.label} (id: "${a.id}")`)
    .join('\n');

  const blockList = allowedBlockNames.map((b) => `  - ${b}`).join('\n');
  const eventList = availableEvents.map((e) => `  - ${e}`).join('\n');

  return `You are a game plan architect for CodeQuest — a block-based game building platform for kids aged 8–14.

Your job is to take a student's game idea and produce a structured, stage-by-stage JSON plan that is ONLY built from the available platform capabilities listed below.

## Output Format
Return ONLY valid JSON. No markdown code fences. No explanation text before or after. No comments inside the JSON. The JSON must exactly match this schema:

${PLAN_SCHEMA}

## STRICT CONSTRAINTS — You MUST follow these exactly

### Available Assets (ONLY use these — use the exact id strings)
${assetList}

### Available Blocks (ONLY reference these block names)
${blockList}

### Available Events (ONLY use these exact event names)
${eventList}

### Scope Rules (student is at "${difficultyProfile.label}" level)
- Maximum ${difficultyProfile.maxStages} stage(s) total
- Maximum ${difficultyProfile.maxAssets} distinct asset type(s) per plan
- Do NOT suggest blocks from categories not in the allowed list above

## Pedagogical Rules
- Steps must be HINTS that guide the student's thinking, NOT exact instructions
  - BAD:  "Add a Forever loop, then put Move Forward 12 inside it"
  - GOOD: "Think about how to make your character keep moving — which loop type runs forever?"
- Each step should be ONE small action
- The "why" field must connect to a real programming concept (e.g. loops, events, variables)
- The "success" field must be observable: something the student can see or test
- Keep stage labels short and encouraging (e.g. "Bring your world to life")
- stepXp values: simple steps = 5–10 XP, challenge steps = 15–25 XP

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
- "Collect health packs" → "Collect coins to increase your score"`;
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
