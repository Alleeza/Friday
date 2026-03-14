const EVENT_LABELS = new Set([
  'game starts',
  'sprite clicked',
  'object is tapped',
  'key is pressed',
  'timer reaches 0',
  'score reaches 10',
  'bumps',
  'is touching',
  'is not touching',
]);

function readTokenValue(token) {
  if (typeof token === 'string') return token;
  if (!token) return '';
  return token.label || token.value || '';
}

function readNumber(token, fallback = 0) {
  const parsed = Number.parseFloat(readTokenValue(token));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBlockLabel(block) {
  return (block.parts || [])
    .map((part) => readTokenValue(part))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSymbol(symbol) {
  return (symbol || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function compilePredicateFromParts(parts = []) {
  if (!parts.length) return null;
  const first = normalizeSymbol(readTokenValue(parts[0]));
  const second = normalizeSymbol(readTokenValue(parts[1]));
  const third = normalizeSymbol(readTokenValue(parts[2]));
  if (first === 'not') {
    return { kind: 'not', value: readTokenValue(parts[1]) };
  }
  if (first === 'flipped') {
    return { kind: 'flipped' };
  }

  if (second === 'bumps') {
    return { kind: 'collision', operator: 'bumps', left: readTokenValue(parts[0]), right: readTokenValue(parts[2]) };
  }
  if (second === 'is touching') {
    return { kind: 'collision', operator: 'touching', left: readTokenValue(parts[0]), right: readTokenValue(parts[2]) };
  }
  if (second === 'is not touching') {
    return { kind: 'collision', operator: 'notTouching', left: readTokenValue(parts[0]), right: readTokenValue(parts[2]) };
  }

  const comparisonMap = {
    '=': 'eq',
    '≠': 'neq',
    '<': 'lt',
    '>': 'gt',
    '≤': 'lte',
    '≥': 'gte',
    'matches': 'matches',
    'and': 'and',
    'or': 'or',
  };
  const operator = comparisonMap[second];
  if (!operator) return null;
  return {
    kind: operator === 'and' || operator === 'or' ? 'logic' : 'comparison',
    operator,
    left: readTokenValue(parts[0]),
    right: readTokenValue(parts[2]),
  };
}

function isReframedDesignBlock(label) {
  const lowered = label.toLowerCase();
  const keywords = [
    'is tapped',
    'is pressed',
    'touch ends',
    'i get a message',
    'message matches',
  ];
  return keywords.some((keyword) => lowered.includes(keyword));
}

function compileInstruction(block, errors, path) {
  const label = readBlockLabel(block);

  if (block.type === 'loop') {
    const loopLabel = readTokenValue(block.parts?.[0]).toLowerCase();
    const children = Array.isArray(block.children) ? block.children : [];
    const body = children
      .map((child, idx) => compileInstruction(child, errors, `${path}.${idx + 1}`))
      .filter(Boolean);

    if (!body.length) errors.push(`${path}: "${label}" has no blocks inside it.`);
    if (loopLabel === 'forever') return { type: 'forever', body };
    if (loopLabel === 'repeat') return { type: 'repeat', times: Math.max(0, Math.floor(readNumber(block.parts?.[1], 0))), body };
    if (loopLabel === 'while') return { type: 'while', condition: readTokenValue(block.parts?.[1]).toLowerCase(), body };
    errors.push(`${path}: Unsupported loop "${label}".`);
    return null;
  }

  const actionLabel = readTokenValue(block.parts?.[0]).toLowerCase();
  const predicate = compilePredicateFromParts(block.parts || []);
  if (predicate) return { type: 'waitUntil', condition: predicate };
  if (actionLabel === 'move forward') return { type: 'moveForward', amount: readNumber(block.parts?.[1], 0) };
  if (actionLabel === 'turn degrees') return { type: 'turn', degrees: readNumber(block.parts?.[1], 0) };
  if (actionLabel === 'set rotation style') return { type: 'setRotationStyle', style: readTokenValue(block.parts?.[1]).toLowerCase() || 'dont rotate' };
  if (actionLabel === 'flip') return { type: 'flip' };
  if (actionLabel === 'change x by') return { type: 'changeX', amount: readNumber(block.parts?.[1], 0) };
  if (actionLabel === 'change y by') return { type: 'changeY', amount: readNumber(block.parts?.[1], 0) };
  if (actionLabel === 'go to x') return { type: 'goTo', x: readNumber(block.parts?.[1], 0), y: readNumber(block.parts?.[3], 0) };
  if (actionLabel === 'point in direction') return { type: 'pointDirection', degrees: readNumber(block.parts?.[1], 0) };
  if (actionLabel === 'wait') return { type: 'wait', durationMs: Math.max(0, readNumber(block.parts?.[1], 0) * 1000) };
  if (actionLabel === 'switch costume to') return { type: 'switchCostume', costume: readTokenValue(block.parts?.[1]) || 'default' };
  if (actionLabel === 'next costume') return { type: 'nextCostume' };
  if (actionLabel === 'play sound') return { type: 'playSound', sound: readTokenValue(block.parts?.[1]) || 'sound' };
  if (actionLabel === 'say') return { type: 'say', text: readTokenValue(block.parts?.[1]) || 'Hi!' };
  if (actionLabel === 'change score by') return { type: 'changeScore', amount: readNumber(block.parts?.[1], 0) };
  if (actionLabel === 'set score to') return { type: 'setScore', value: readNumber(block.parts?.[1], 0) };
  if (actionLabel === 'change timer by') return { type: 'changeTime', amount: readNumber(block.parts?.[1], 0) };
  if (actionLabel === 'set timer to') return { type: 'setTime', value: readNumber(block.parts?.[1], 0) };
  if (actionLabel === 'set alive to') return { type: 'setAlive', value: readTokenValue(block.parts?.[1]).toLowerCase() === 'true' };
  if (isReframedDesignBlock(label.toLowerCase())) return { type: 'noop', label };

  errors.push(`${path}: Unsupported block "${label}".`);
  return null;
}

function compileScript(blocks) {
  const errors = [];
  const eventBlock = Array.isArray(blocks)
    ? blocks.find((block) => readTokenValue(block.parts?.[0]).toLowerCase() === 'when')
    : null;

  if (!eventBlock) {
    return { program: null, errors: ['Missing a "When ..." event block at the top of the script.'] };
  }

  const eventName = readTokenValue(eventBlock.parts?.[1]).toLowerCase();
  if (!EVENT_LABELS.has(eventName)) errors.push(`Unsupported event "${eventName || 'unknown'}".`);

  const instructions = (blocks || [])
    .filter((block) => block.id !== eventBlock.id)
    .map((block, idx) => compileInstruction(block, errors, `Block ${idx + 1}`))
    .filter(Boolean);

  if (!instructions.length) errors.push('Add at least one action or loop after the event block.');

  return {
    program: errors.length ? null : { events: { [eventName]: instructions } },
    errors,
  };
}

export function compileScriptsByInstance(scriptsByInstanceKey) {
  const programsByKey = {};
  const errorsByKey = {};

  Object.entries(scriptsByInstanceKey || {}).forEach(([instanceKey, blocks]) => {
    const { program, errors } = compileScript(blocks);
    if (errors.length) {
      errorsByKey[instanceKey] = errors;
      return;
    }
    programsByKey[instanceKey] = program;
  });

  return { programsByKey, errorsByKey };
}
