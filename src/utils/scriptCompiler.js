const EVENT_LABELS = new Set([
  'game starts',
  'sprite clicked',
  'key pressed',
  'timer reaches 0',
  'score reaches 10',
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
    if (loopLabel === 'while') return { type: 'while', condition: readTokenValue(block.parts?.[1]).toLowerCase(), body };
    errors.push(`${path}: Unsupported loop "${label}".`);
    return null;
  }

  const actionLabel = readTokenValue(block.parts?.[0]).toLowerCase();
  if (actionLabel === 'move forward') return { type: 'moveForward', amount: readNumber(block.parts?.[1], 0) };
  if (actionLabel === 'turn degrees') return { type: 'turn', degrees: readNumber(block.parts?.[1], 0) };
  if (actionLabel === 'set rotation style') return { type: 'setRotationStyle', style: readTokenValue(block.parts?.[1]).toLowerCase() || 'dont rotate' };
  if (actionLabel === 'change x by') return { type: 'changeX', amount: readNumber(block.parts?.[1], 0) };
  if (actionLabel === 'wait') return { type: 'wait', durationMs: Math.max(0, readNumber(block.parts?.[1], 0) * 1000) };
  if (actionLabel === 'switch costume to') return { type: 'switchCostume', costume: readTokenValue(block.parts?.[1]) || 'default' };
  if (actionLabel === 'next costume') return { type: 'nextCostume' };
  if (actionLabel === 'play sound') return { type: 'playSound', sound: readTokenValue(block.parts?.[1]) || 'sound' };

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
