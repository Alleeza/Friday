const MAX_STEPS_PER_TICK = 24;

function evaluateCondition(condition, variables) {
  switch ((condition || '').toLowerCase()) {
    case 'score < 10':
      return (variables.score || 0) < 10;
    case 'score >= 10':
      return (variables.score || 0) >= 10;
    case 'is alive':
      return Boolean(variables.isAlive);
    case 'time > 0':
      return (variables.time || 0) > 0;
    case 'time <= 0':
      return (variables.time || 0) <= 0;
    default:
      return false;
  }
}

function normalizeValue(value) {
  return String(value ?? '').trim().toLowerCase();
}

function parseMaybeNumber(value) {
  const parsed = Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveOperand(raw, asset, state) {
  const normalized = normalizeValue(raw);
  if (normalized === 'score') return state.variables.score;
  if (normalized === 'time' || normalized === 'timer') return state.variables.time;
  if (normalized === 'is alive' || normalized === 'alive') return state.variables.isAlive;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  if (normalized === 'flipped') return asset?.facing === -1;
  const numeric = parseMaybeNumber(raw);
  if (numeric !== null) return numeric;
  return String(raw ?? '');
}

function resolveAssetReference(raw, currentAsset, state) {
  const ref = normalizeValue(raw);
  if (!ref || ref === 'self' || ref === 'this object' || ref === 'object') return currentAsset || null;
  const assets = Object.values(state.assetsByKey);
  return assets.find((item) => {
    const label = normalizeValue(item.label);
    const id = normalizeValue(item.id);
    const key = normalizeValue(item.key);
    return ref === label || ref === id || ref === key || ref.startsWith(`${label} `);
  }) || null;
}

function areTouching(left, right) {
  if (!left || !right) return false;
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const distance = Math.hypot(dx, dy);
  const leftRadius = 90 * (left.scale || 1);
  const rightRadius = 90 * (right.scale || 1);
  return distance <= leftRadius + rightRadius;
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = normalizeValue(value);
  return normalized === 'true' || normalized === 'yes' || normalized === '1';
}

function evaluatePredicate(condition, asset, state) {
  if (!condition) return true;

  if (condition.kind === 'collision') {
    const left = resolveAssetReference(condition.left, asset, state);
    const right = resolveAssetReference(condition.right, asset, state);
    const touching = areTouching(left, right);
    if (condition.operator === 'touching' || condition.operator === 'bumps') return touching;
    if (condition.operator === 'notTouching') return !touching;
    return false;
  }

  if (condition.kind === 'not') {
    return !toBoolean(resolveOperand(condition.value, asset, state));
  }

  if (condition.kind === 'flipped') {
    return asset?.facing === -1;
  }

  if (condition.kind === 'logic') {
    const left = toBoolean(resolveOperand(condition.left, asset, state));
    const right = toBoolean(resolveOperand(condition.right, asset, state));
    if (condition.operator === 'and') return left && right;
    if (condition.operator === 'or') return left || right;
    return false;
  }

  if (condition.kind === 'comparison') {
    const leftRaw = resolveOperand(condition.left, asset, state);
    const rightRaw = resolveOperand(condition.right, asset, state);
    const leftNum = parseMaybeNumber(leftRaw);
    const rightNum = parseMaybeNumber(rightRaw);
    const left = leftNum !== null && rightNum !== null ? leftNum : normalizeValue(leftRaw);
    const right = leftNum !== null && rightNum !== null ? rightNum : normalizeValue(rightRaw);

    switch (condition.operator) {
      case 'eq':
        return left === right;
      case 'neq':
        return left !== right;
      case 'lt':
        return left < right;
      case 'gt':
        return left > right;
      case 'lte':
        return left <= right;
      case 'gte':
        return left >= right;
      case 'matches':
        return normalizeValue(leftRaw) === normalizeValue(rightRaw);
      default:
        return false;
    }
  }

  return false;
}

function createAssetState(instance) {
  return {
    key: instance.key,
    id: instance.id,
    label: instance.label,
    emoji: instance.emoji,
    x: instance.x,
    y: instance.y,
    scale: instance.scale || 1,
    rotation: instance.rotation || 0,
    rotationStyle: 'dont rotate',
    costume: 'default',
    costumeIndex: 0,
    lastSound: null,
    facing: 1,
  };
}

function cloneSnapshot(state) {
  return {
    assetsByKey: Object.fromEntries(
      Object.entries(state.assetsByKey).map(([key, value]) => [key, { ...value }]),
    ),
    logs: state.logs.slice(-20),
    variables: { ...state.variables },
  };
}

export function createScriptRuntime({ instances, programsByKey }) {
  const state = {
    assetsByKey: Object.fromEntries((instances || []).map((instance) => [instance.key, createAssetState(instance)])),
    taskQueuesByKey: Object.fromEntries((instances || []).map((instance) => [instance.key, []])),
    programsByKey: programsByKey || {},
    variables: { score: 0, time: 30, isAlive: true },
    logs: [],
    timerEventSent: false,
    scoreEventSent: false,
    touchingEventSent: false,
  };

  const log = (message) => {
    state.logs.push(message);
    if (state.logs.length > 40) state.logs.shift();
  };

  const enqueueInstructions = (instanceKey, eventType, instructions) => {
    if (!instructions?.length || !state.taskQueuesByKey[instanceKey]) return;
    state.taskQueuesByKey[instanceKey].push({ eventType, waitRemainingMs: 0, frames: [{ instructions, index: 0 }] });
  };

  const applyAction = (instruction, asset) => {
    switch (instruction.type) {
      case 'moveForward': {
        if (!asset) break;
        const radians = (asset.rotation * Math.PI) / 180;
        asset.x += Math.cos(radians) * instruction.amount;
        asset.y += Math.sin(radians) * instruction.amount;
        asset.facing = instruction.amount >= 0 ? 1 : -1;
        break;
      }
      case 'pointDirection':
        if (asset) asset.rotation = instruction.degrees;
        break;
      case 'turn':
        if (asset) asset.rotation += instruction.degrees;
        break;
      case 'setRotationStyle':
        if (asset) asset.rotationStyle = instruction.style;
        break;
      case 'changeX':
        if (asset) {
          asset.x += instruction.amount;
          asset.facing = instruction.amount >= 0 ? 1 : -1;
        }
        break;
      case 'changeY':
        if (asset) asset.y += instruction.amount;
        break;
      case 'goTo':
        if (asset) {
          asset.x = instruction.x;
          asset.y = instruction.y;
        }
        break;
      case 'switchCostume':
        if (asset) asset.costume = instruction.costume;
        break;
      case 'nextCostume':
        if (asset) {
          asset.costumeIndex += 1;
          asset.costume = `variant ${asset.costumeIndex + 1}`;
        }
        break;
      case 'playSound':
        if (asset) {
          asset.lastSound = instruction.sound;
          log(`${asset.label} plays ${instruction.sound}`);
        }
        break;
      case 'say':
        if (asset) log(`${asset.label} says "${instruction.text}"`);
        break;
      case 'changeScore':
        state.variables.score += instruction.amount;
        break;
      case 'setScore':
        state.variables.score = instruction.value;
        break;
      case 'changeTime':
        state.variables.time = Math.max(0, state.variables.time + instruction.amount);
        break;
      case 'setTime':
        state.variables.time = Math.max(0, instruction.value);
        break;
      case 'setAlive':
        state.variables.isAlive = Boolean(instruction.value);
        break;
      case 'noop':
        break;
      default:
        break;
    }
  };

  const stepTask = (task, asset, deltaMs) => {
    if (task.waitRemainingMs > 0) {
      task.waitRemainingMs = Math.max(0, task.waitRemainingMs - deltaMs);
      return task.waitRemainingMs > 0 || task.frames.length > 0;
    }

    let remainingBudget = MAX_STEPS_PER_TICK;
    while (remainingBudget > 0 && task.frames.length) {
      const frame = task.frames[task.frames.length - 1];
      if (frame.index >= frame.instructions.length) {
        if (frame.loopType === 'forever') {
          frame.index = 0;
          continue;
        }
        if (frame.loopType === 'while' && evaluateCondition(frame.condition, state.variables)) {
          frame.index = 0;
          continue;
        }
        if (frame.loopType === 'repeat' && frame.repeatRemaining > 1) {
          frame.repeatRemaining -= 1;
          frame.index = 0;
          continue;
        }
        task.frames.pop();
        continue;
      }

      const instruction = frame.instructions[frame.index];
      frame.index += 1;
      remainingBudget -= 1;

      if (instruction.type === 'wait') {
        task.waitRemainingMs = instruction.durationMs;
        return true;
      }
      if (instruction.type === 'waitUntil') {
        if (evaluatePredicate(instruction.condition, asset, state)) continue;
        frame.index -= 1;
        return true;
      }
      if (instruction.type === 'forever') {
        task.frames.push({ instructions: instruction.body, index: 0, loopType: 'forever' });
        continue;
      }
      if (instruction.type === 'while') {
        if (!evaluateCondition(instruction.condition, state.variables)) continue;
        task.frames.push({ instructions: instruction.body, index: 0, loopType: 'while', condition: instruction.condition });
        continue;
      }
      if (instruction.type === 'repeat') {
        const times = Math.max(0, Math.floor(instruction.times || 0));
        if (!times || !instruction.body?.length) continue;
        task.frames.push({ instructions: instruction.body, index: 0, loopType: 'repeat', repeatRemaining: times });
        continue;
      }
      applyAction(instruction, asset);
    }

    return task.frames.length > 0 || task.waitRemainingMs > 0;
  };

  return {
    dispatch(eventType, payload = {}) {
      if ((eventType === 'sprite clicked' || eventType === 'object is tapped') && payload.instanceKey) {
        const instructions = state.programsByKey[payload.instanceKey]?.events?.[eventType];
        enqueueInstructions(payload.instanceKey, eventType, instructions);
        return;
      }
      Object.entries(state.programsByKey).forEach(([instanceKey, program]) => {
        enqueueInstructions(instanceKey, eventType, program?.events?.[eventType]);
      });
    },
    tick(deltaMs) {
      state.variables.time = Math.max(0, state.variables.time - deltaMs / 1000);
      if (!state.timerEventSent && state.variables.time <= 0) {
        state.timerEventSent = true;
        this.dispatch('timer reaches 0');
      }
      if (!state.scoreEventSent && state.variables.score >= 10) {
        state.scoreEventSent = true;
        this.dispatch('score reaches 10');
      }
      if (state.variables.score < 10) state.scoreEventSent = false;
      const assets = Object.values(state.assetsByKey);
      let touchingDetected = false;
      for (let i = 0; i < assets.length && !touchingDetected; i += 1) {
        for (let j = i + 1; j < assets.length; j += 1) {
          if (areTouching(assets[i], assets[j])) {
            touchingDetected = true;
            break;
          }
        }
      }
      if (touchingDetected && !state.touchingEventSent) {
        state.touchingEventSent = true;
        this.dispatch('is touching');
        this.dispatch('bumps');
      }
      if (!touchingDetected && state.touchingEventSent) {
        state.touchingEventSent = false;
        this.dispatch('is not touching (pro)');
      }
      Object.entries(state.taskQueuesByKey).forEach(([instanceKey, tasks]) => {
        const asset = state.assetsByKey[instanceKey];
        state.taskQueuesByKey[instanceKey] = tasks.filter((task) => stepTask(task, asset, deltaMs));
      });
    },
    getSnapshot() {
      return cloneSnapshot(state);
    },
  };
}
