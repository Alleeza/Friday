const MAX_STEPS_PER_TICK = 24;
const STAGE_BOUNDS = {
  minX: 48,
  maxX: 1180,
  minY: 96,
  maxY: 560,
};

function clampPosition(asset) {
  asset.x = Math.max(STAGE_BOUNDS.minX, Math.min(STAGE_BOUNDS.maxX, asset.x));
  asset.y = Math.max(STAGE_BOUNDS.minY, Math.min(STAGE_BOUNDS.maxY, asset.y));
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
    rotationStyle: 'all around',
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

function readComparableValue(raw, variables) {
  const token = String(raw ?? '').trim();
  const lowered = token.toLowerCase();
  if (lowered === 'score') return variables.score || 0;
  if (lowered === 'time') return variables.time || 0;
  if (lowered === 'alive' || lowered === 'is alive') return Boolean(variables.isAlive);
  if (lowered === 'true') return true
  if (lowered === 'false') return false
  const numeric = Number.parseFloat(token);
  return Number.isFinite(numeric) ? numeric : token;
}

function resolveAssetKey(ref, asset, state) {
  if (!ref) return null;
  if (ref === 'Self') return asset?.key || null;
  if (state.assetsByKey[ref]) return ref;
  const lowered = String(ref).toLowerCase();
  const matched = Object.values(state.assetsByKey).find((candidate) => {
    const label = `${candidate.emoji} ${candidate.label}`.toLowerCase();
    return label === lowered || candidate.label.toLowerCase() === lowered;
  });
  return matched?.key || null;
}

function areAssetsTouching(leftAsset, rightAsset) {
  if (!leftAsset || !rightAsset || leftAsset.key === rightAsset.key) return false;
  const leftRadius = 34 * (leftAsset.scale || 1);
  const rightRadius = 34 * (rightAsset.scale || 1);
  const dx = leftAsset.x - rightAsset.x;
  const dy = leftAsset.y - rightAsset.y;
  return Math.hypot(dx, dy) <= leftRadius + rightRadius;
}

function evaluatePredicate(predicate, asset, state) {
  if (!predicate) return false;
  switch (predicate.kind) {
    case 'collision': {
      const leftKey = resolveAssetKey(predicate.left, asset, state);
      const rightKey = resolveAssetKey(predicate.right, asset, state);
      const leftAsset = leftKey ? state.assetsByKey[leftKey] : null;
      const rightAsset = rightKey ? state.assetsByKey[rightKey] : null;
      const touching = areAssetsTouching(leftAsset, rightAsset);
      if (predicate.operator === 'bumps' || predicate.operator === 'touching') return touching;
      if (predicate.operator === 'notTouching') return !touching;
      return false;
    }
    case 'comparison': {
      const left = readComparableValue(predicate.left, state.variables);
      const right = readComparableValue(predicate.right, state.variables);
      switch (predicate.operator) {
        case 'eq': return left === right;
        case 'neq': return left !== right;
        case 'lt': return Number(left) < Number(right);
        case 'gt': return Number(left) > Number(right);
        case 'lte': return Number(left) <= Number(right);
        case 'gte': return Number(left) >= Number(right);
        case 'matches': return String(left) === String(right);
        default: return false;
      }
    }
    case 'logic': {
      const left = readComparableValue(predicate.left, state.variables);
      const right = readComparableValue(predicate.right, state.variables);
      if (predicate.operator === 'and') return Boolean(left) && Boolean(right);
      if (predicate.operator === 'or') return Boolean(left) || Boolean(right);
      return false;
    }
    case 'not':
      return !Boolean(readComparableValue(predicate.value, state.variables));
    case 'flipped':
      return (asset?.facing || 1) < 0;
    default:
      return false;
  }
}

function evaluateCondition(condition, asset, state) {
  if (typeof condition === 'string') {
    switch (condition.toLowerCase()) {
      case 'score < 10':
        return (state.variables.score || 0) < 10;
      case 'score >= 10':
        return (state.variables.score || 0) >= 10;
      case 'is alive':
        return Boolean(state.variables.isAlive);
      case 'time > 0':
        return (state.variables.time || 0) > 0;
      case 'time <= 0':
        return (state.variables.time || 0) <= 0;
      default:
        return false;
    }
  }
  return evaluatePredicate(condition, asset, state);
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
    touchingByKey: Object.fromEntries((instances || []).map((instance) => [instance.key, false])),
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
    if (!asset) return;
    switch (instruction.type) {
      case 'moveForward': {
        const directionMultiplier = asset.rotationStyle === 'left-right' ? (asset.facing || 1) : 1;
        const amount = instruction.amount * directionMultiplier;
        const radians = (asset.rotation * Math.PI) / 180;
        asset.x += Math.cos(radians) * amount;
        asset.y += Math.sin(radians) * amount;
        asset.facing = amount >= 0 ? 1 : -1;
        clampPosition(asset);
        break;
      }
      case 'turn':
        asset.rotation += instruction.degrees;
        break;
      case 'setRotationStyle':
        asset.rotationStyle = instruction.style;
        break;
      case 'flip':
        asset.rotationStyle = 'left-right';
        asset.facing = (asset.facing || 1) * -1;
        break;
      case 'changeX':
        asset.x += instruction.amount;
        asset.facing = instruction.amount >= 0 ? 1 : -1;
        clampPosition(asset);
        break;
      case 'changeY':
        asset.y += instruction.amount;
        clampPosition(asset);
        break;
      case 'goTo':
        asset.x = instruction.x;
        asset.y = instruction.y;
        clampPosition(asset);
        break;
      case 'pointDirection':
        asset.rotation = instruction.degrees;
        break;
      case 'switchCostume':
        asset.costume = instruction.costume;
        break;
      case 'nextCostume':
        asset.costumeIndex += 1;
        asset.costume = `variant ${asset.costumeIndex + 1}`;
        break;
      case 'playSound':
        asset.lastSound = instruction.sound;
        log(`${asset.label} plays ${instruction.sound}`);
        break;
      case 'say':
        log(`${asset.label} says "${instruction.text}"`);
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
      if (task.waitRemainingMs > 0) return true;
    }

    let remainingBudget = MAX_STEPS_PER_TICK;
    while (remainingBudget > 0 && task.frames.length) {
      const frame = task.frames[task.frames.length - 1];
      if (frame.index >= frame.instructions.length) {
        if (frame.loopType === 'forever') {
          frame.index = 0;
          continue;
        }
        if (frame.loopType === 'while' && evaluateCondition(frame.condition, asset, state)) {
          frame.index = 0;
          continue;
        }
        if (frame.loopType === 'repeat' && frame.remaining > 1) {
          frame.remaining -= 1;
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
        if (!evaluateCondition(instruction.condition, asset, state)) {
          frame.index -= 1;
          return true;
        }
        continue;
      }
      if (instruction.type === 'forever') {
        task.frames.push({ instructions: instruction.body, index: 0, loopType: 'forever' });
        continue;
      }
      if (instruction.type === 'repeat') {
        if ((instruction.times || 0) <= 0) continue;
        task.frames.push({ instructions: instruction.body, index: 0, loopType: 'repeat', remaining: instruction.times });
        continue;
      }
      if (instruction.type === 'while') {
        if (!evaluateCondition(instruction.condition, asset, state)) continue;
        task.frames.push({ instructions: instruction.body, index: 0, loopType: 'while', condition: instruction.condition });
        continue;
      }
      applyAction(instruction, asset);
      return true;
    }

    return task.frames.length > 0 || task.waitRemainingMs > 0;
  };

  return {
    dispatch(eventType, payload = {}) {
      if ((eventType === 'sprite clicked' || eventType === 'object is tapped' || eventType === 'bumps' || eventType === 'is touching' || eventType === 'is not touching') && payload.instanceKey) {
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
      Object.keys(state.assetsByKey).forEach((instanceKey) => {
        const asset = state.assetsByKey[instanceKey];
        const isTouchingAny = Object.values(state.assetsByKey).some((otherAsset) => areAssetsTouching(asset, otherAsset));
        const wasTouching = Boolean(state.touchingByKey[instanceKey]);
        if (isTouchingAny && !wasTouching) {
          this.dispatch('bumps', { instanceKey });
          this.dispatch('is touching', { instanceKey });
        }
        if (!isTouchingAny && wasTouching) {
          this.dispatch('is not touching', { instanceKey });
        }
        state.touchingByKey[instanceKey] = isTouchingAny;
      });
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
