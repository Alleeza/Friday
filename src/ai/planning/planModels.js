/**
 * planModels.js — Data structures for game plans.
 *
 * Factory functions fill in defaults and freeze the result so downstream
 * code always gets a complete, predictable shape — even if the AI omits fields.
 *
 * All functions are pure; no AI or React dependencies.
 */

/**
 * @typedef {Object} OptionalStep
 * @property {string} description - Stretch goal description
 * @property {number} bonusXp     - XP awarded for completing it
 */

/**
 * @typedef {Object} Stage
 * @property {string}         id            - e.g. "stage-1"
 * @property {string}         label         - Short title, e.g. "Place your characters"
 * @property {string}         objective     - What the student achieves in this stage
 * @property {string}         why           - How this connects to a programming concept
 * @property {string}         success       - How to know the stage is complete
 * @property {string[]}       steps         - Ordered hints (not exact instructions)
 * @property {number[]}       stepXp        - XP per step; length must match steps
 * @property {OptionalStep[]} optionalSteps - Stretch goals
 */

/**
 * @typedef {Object} Entities
 * @property {string[]} assets - Asset IDs used, e.g. ['bunny', 'carrot']
 * @property {string[]} blocks - Block names used, e.g. ['Move Forward', 'Forever']
 * @property {string[]} events - Event names used, e.g. ['When game starts']
 */

/**
 * @typedef {Object} Plan
 * @property {string}   summary     - One-sentence description of the game
 * @property {string}   eta         - Estimated completion time, e.g. "15–20 minutes"
 * @property {Entities} entities    - All assets/blocks/events the plan references
 * @property {string[]} checkpoints - High-level milestones (one per stage group)
 * @property {Stage[]}  stages      - Ordered implementation stages
 */

/**
 * @typedef {Object} PlanResult
 * @property {boolean}     ok          - True if a usable plan was produced
 * @property {Plan|null}   plan        - The generated plan (null on hard error)
 * @property {boolean}     infeasible  - True if the original idea was not buildable
 * @property {string|null} suggestion  - Alternative idea when infeasible
 * @property {string|null} error       - Error message (network, validation, etc.)
 * @property {boolean}     usedFallback - True if a hardcoded fallback was returned
 */

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/**
 * Creates a fully-populated OptionalStep, filling in defaults.
 * @param {Partial<OptionalStep>} raw
 * @returns {OptionalStep}
 */
export function createOptionalStep(raw = {}) {
  return Object.freeze({
    description: String(raw.description ?? 'Try something extra!'),
    bonusXp: Math.max(0, Number.isFinite(Number(raw.bonusXp)) ? Number(raw.bonusXp) : 5),
  });
}

/**
 * Creates a fully-populated Stage, filling in defaults for missing fields.
 * @param {Partial<Stage>} raw
 * @param {number} index - Used to generate a default id
 * @returns {Stage}
 */
export function createStage(raw = {}, index = 0) {
  const steps = Array.isArray(raw.steps) && raw.steps.length
    ? raw.steps.map(String)
    : ['Start working on this stage'];

  // stepXp must have the same length as steps
  let stepXp = Array.isArray(raw.stepXp) ? raw.stepXp.map(Number) : [];
  if (stepXp.length !== steps.length) {
    stepXp = steps.map(() => 10);
  }
  stepXp = stepXp.map((v) => Math.max(0, Number.isFinite(v) ? v : 10));

  const optionalSteps = Array.isArray(raw.optionalSteps)
    ? raw.optionalSteps.map(createOptionalStep)
    : [];

  return Object.freeze({
    id: String(raw.id ?? `stage-${index + 1}`),
    label: String(raw.label ?? `Stage ${index + 1}`),
    objective: String(raw.objective ?? 'Complete this stage'),
    why: String(raw.why ?? 'This helps you learn a new programming idea'),
    success: String(raw.success ?? 'Your game does something new!'),
    steps,
    stepXp,
    optionalSteps,
  });
}

/**
 * Creates a fully-populated Plan, filling in defaults for missing fields.
 * @param {Partial<Plan>} raw
 * @returns {Plan}
 */
export function createPlan(raw = {}) {
  const stages = Array.isArray(raw.stages) && raw.stages.length
    ? raw.stages.map((s, i) => createStage(s, i))
    : [createStage({}, 0)];

  const entities = raw.entities && typeof raw.entities === 'object'
    ? {
        assets: Array.isArray(raw.entities.assets) ? raw.entities.assets.map(String) : [],
        blocks: Array.isArray(raw.entities.blocks) ? raw.entities.blocks.map(String) : [],
        events: Array.isArray(raw.entities.events) ? raw.entities.events.map(String) : [],
      }
    : { assets: [], blocks: [], events: [] };

  const checkpoints = Array.isArray(raw.checkpoints) && raw.checkpoints.length
    ? raw.checkpoints.map(String)
    : stages.map((s) => s.label);

  return Object.freeze({
    summary: String(raw.summary ?? 'A fun game to build'),
    eta: String(raw.eta ?? '15–20 minutes'),
    entities: Object.freeze(entities),
    checkpoints,
    stages,
  });
}

/**
 * Creates an empty PlanResult representing a hard error (no plan produced).
 * @param {string} errorMessage
 * @returns {PlanResult}
 */
export function createErrorResult(errorMessage) {
  return Object.freeze({
    ok: false,
    plan: null,
    infeasible: false,
    suggestion: null,
    error: String(errorMessage),
    usedFallback: false,
  });
}

/**
 * Creates a successful PlanResult.
 * @param {Plan} plan
 * @param {{ infeasible?: boolean, suggestion?: string, usedFallback?: boolean }} opts
 * @returns {PlanResult}
 */
export function createSuccessResult(plan, { infeasible = false, suggestion = null, usedFallback = false } = {}) {
  return Object.freeze({
    ok: true,
    plan,
    infeasible,
    suggestion: suggestion ? String(suggestion) : null,
    error: null,
    usedFallback,
  });
}
