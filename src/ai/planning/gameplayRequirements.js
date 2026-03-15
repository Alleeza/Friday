function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function includesAny(normalizedText, keywords) {
  return keywords.some((keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`).test(normalizedText);
  });
}

const AUTOPLAY_REQUEST_KEYWORDS = Object.freeze([
  'automatic',
  'automatically',
  'autonomous',
  'idle',
  'demo',
  'screensaver',
  'screen saver',
  'attract mode',
  'plays itself',
  'watch itself',
  'self-running',
]);

const PLAYER_AGENCY_KEYWORDS = Object.freeze([
  'explore',
  'find',
  'collect',
  'reach',
  'discover',
  'gather',
  'grab',
  'get',
  'navigate',
  'maze',
  'avoid',
  'dodge',
  'survive',
  'pilot',
  'control',
  'forest',
]);

const INTERACTIVE_TARGET_KEYWORDS = Object.freeze([
  'find',
  'collect',
  'reach',
  'discover',
  'gather',
  'goal',
  'target',
  'finish',
  'carrot',
  'coin',
  'star',
  'gift',
]);

const PATHING_KEYWORDS = Object.freeze([
  'explore',
  'find',
  'collect',
  'reach',
  'discover',
  'navigate',
  'maze',
  'avoid',
  'dodge',
  'survive',
  'forest',
  'path',
  'route',
  'obstacle',
]);

const ROTATION_MOVEMENT_KEYWORDS = Object.freeze([
  'rotate',
  'rotation',
  'spin',
  'spinning',
  'orbit',
  'pilot',
  'drift',
  'steer',
  'steering',
  'ship',
  'spaceship',
  'rocket',
  'plane',
  'flying',
  'car',
  'driving',
  'vehicle',
]);

/**
 * @typedef {Object} GameplayRequirements
 * @property {boolean} requiresPlayerAgency
 * @property {boolean} forbidAutoplayCoreLoop
 * @property {boolean} requiresInteractiveTarget
 * @property {boolean} requiresExplicitObjective
 * @property {boolean} preferObstacleOrPathing
 * @property {boolean} preferAxisMovement
 * @property {boolean} discourageRotationMovement
 * @property {boolean} allowAutoplayOnlyIfExplicitlyRequested
 * @property {boolean} autoplayRequested
 * @property {string[]} matchedSignals
 * @property {string|null} difficultyLabel
 */

/**
 * Derives gameplay quality requirements from the student's idea.
 *
 * @param {string} ideaText
 * @param {{ label?: string }} [difficultyProfile]
 * @returns {GameplayRequirements}
 */
export function deriveGameplayRequirements(ideaText = '', difficultyProfile = {}) {
  const normalizedIdea = normalizeText(ideaText);
  const autoplayRequested = includesAny(normalizedIdea, AUTOPLAY_REQUEST_KEYWORDS);
  const requiresPlayerAgency = includesAny(normalizedIdea, PLAYER_AGENCY_KEYWORDS) && !autoplayRequested;
  const requiresInteractiveTarget = includesAny(normalizedIdea, INTERACTIVE_TARGET_KEYWORDS);
  const requiresExplicitObjective = requiresInteractiveTarget || requiresPlayerAgency;
  const preferObstacleOrPathing = includesAny(normalizedIdea, PATHING_KEYWORDS);
  const rotationThemeRequested = includesAny(normalizedIdea, ROTATION_MOVEMENT_KEYWORDS);
  const preferAxisMovement = requiresPlayerAgency && !rotationThemeRequested;
  const discourageRotationMovement = preferAxisMovement;

  const matchedSignals = [
    ...(autoplayRequested ? ['autoplay-requested'] : []),
    ...(requiresPlayerAgency ? ['player-agency'] : []),
    ...(requiresInteractiveTarget ? ['interactive-target'] : []),
    ...(requiresExplicitObjective ? ['explicit-objective'] : []),
    ...(preferObstacleOrPathing ? ['pathing-preferred'] : []),
    ...(preferAxisMovement ? ['axis-movement-preferred'] : []),
    ...(rotationThemeRequested ? ['rotation-theme-requested'] : []),
  ];

  return Object.freeze({
    requiresPlayerAgency,
    forbidAutoplayCoreLoop: requiresPlayerAgency && !autoplayRequested,
    requiresInteractiveTarget,
    requiresExplicitObjective,
    preferObstacleOrPathing,
    preferAxisMovement,
    discourageRotationMovement,
    allowAutoplayOnlyIfExplicitlyRequested: true,
    autoplayRequested,
    matchedSignals,
    difficultyLabel: difficultyProfile?.label ?? null,
  });
}
