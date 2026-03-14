const MAX_STEPS_PER_TICK = 24;
const DEFAULT_STAGE_SIZE = {
  width: 1280,
  height: 720,
};

function normalizeStageSize(stageSize) {
  const width = Number(stageSize?.width);
  const height = Number(stageSize?.height);
  return {
    width: Number.isFinite(width) && width > 0 ? width : DEFAULT_STAGE_SIZE.width,
    height: Number.isFinite(height) && height > 0 ? height : DEFAULT_STAGE_SIZE.height,
  };
}

function clampPosition(asset, stageSize) {
  const { width, height } = normalizeStageSize(stageSize);
  const frameHalf = 90 * (asset?.scale || 1);
  asset.x = Math.max(frameHalf, Math.min(Math.max(frameHalf, width - frameHalf), asset.x));
  asset.y = Math.max(frameHalf, Math.min(Math.max(frameHalf, height - frameHalf), asset.y));
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
    lastSpeed: 0,
    invisibility: 0,
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

function resolveOperandValue(raw, asset, state) {
  if (raw && typeof raw === 'object' && raw.kind === 'assetProp') {
    const key = resolveAssetKey(raw.assetRef, asset, state);
    const target = key ? state.assetsByKey[key] : null;
    const prop = String(raw.property || '').toLowerCase();
    if (!target) return 0;
    switch (prop) {
      case 'x position':
        return target.x || 0;
      case 'y position':
        return target.y || 0;
      case 'rotation':
        return target.rotation || 0;
      case 'size as a %':
        return Math.round((target.scale || 1) * 100);
      case 'invisibility as a %':
        return target.invisibility || 0;
      case 'speed':
        return target.lastSpeed || 0;
      case 'width':
        return Math.round(68 * (target.scale || 1));
      case 'height':
        return Math.round(68 * (target.scale || 1));
      default:
        return 0;
    }
  }
  return readComparableValue(raw, state.variables);
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
      const left = resolveOperandValue(predicate.left, asset, state);
      const right = resolveOperandValue(predicate.right, asset, state);
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
      const left = resolveOperandValue(predicate.left, asset, state);
      const right = resolveOperandValue(predicate.right, asset, state);
      if (predicate.operator === 'and') return Boolean(left) && Boolean(right);
      if (predicate.operator === 'or') return Boolean(left) || Boolean(right);
      return false;
    }
    case 'not':
      return !Boolean(resolveOperandValue(predicate.value, asset, state));
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

function normalizeRuntimeKey(rawKey) {
  const next = String(rawKey || '').toLowerCase();
  if (next === ' ') return 'space';
  if (next === 'spacebar') return 'space';
  return next;
}

export function createScriptRuntime({ instances, programsByKey, stageSize }) {
  const state = {
    assetsByKey: Object.fromEntries((instances || []).map((instance) => [instance.key, createAssetState(instance)])),
    taskQueuesByKey: Object.fromEntries((instances || []).map((instance) => [instance.key, []])),
    programsByKey: programsByKey || {},
    stageSize: normalizeStageSize(stageSize),
    variables: { score: 0, time: 30, isAlive: true },
    logs: [],
    timerEventSent: false,
    scoreEventSent: false,
    touchingByKey: Object.fromEntries((instances || []).map((instance) => [instance.key, { touching: false, otherKey: null }])),
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
        asset.lastSpeed = Math.abs(amount);
        clampPosition(asset, state.stageSize);
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
        asset.lastSpeed = Math.abs(instruction.amount);
        clampPosition(asset, state.stageSize);
        break;
      case 'changeY':
        asset.y += instruction.amount;
        asset.lastSpeed = Math.abs(instruction.amount);
        clampPosition(asset, state.stageSize);
        break;
      case 'goTo':
        asset.lastSpeed = Math.hypot((instruction.x || 0) - asset.x, (instruction.y || 0) - asset.y);
        asset.x = instruction.x;
        asset.y = instruction.y;
        clampPosition(asset, state.stageSize);
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
      if ((eventType === 'object is tapped' || eventType === 'bumps') && payload.instanceKey) {
        const program = state.programsByKey[payload.instanceKey];
        enqueueInstructions(payload.instanceKey, eventType, program?.events?.[eventType]);
        if (payload.otherInstanceKey) {
          const filteredEventType = `${eventType}|${payload.otherInstanceKey}`;
          enqueueInstructions(payload.instanceKey, filteredEventType, program?.events?.[filteredEventType]);
        }
        return;
      }
      Object.entries(state.programsByKey).forEach(([instanceKey, program]) => {
        enqueueInstructions(instanceKey, eventType, program?.events?.[eventType]);
        if (eventType === 'key is pressed' && payload.key) {
          const normalizedKey = normalizeRuntimeKey(payload.key);
          enqueueInstructions(instanceKey, `${eventType}|${normalizedKey}`, program?.events?.[`${eventType}|${normalizedKey}`]);
        }
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
        const touchingAssets = Object.values(state.assetsByKey).filter((otherAsset) => areAssetsTouching(asset, otherAsset));
        const isTouchingAny = touchingAssets.length > 0;
        const previousTouchState = state.touchingByKey[instanceKey] || { touching: false, otherKey: null };
        const wasTouching = Boolean(previousTouchState.touching);
        const otherInstanceKey = touchingAssets[0]?.key || null;
        if (isTouchingAny && !wasTouching) {
          this.dispatch('bumps', { instanceKey, otherInstanceKey });
        }
        state.touchingByKey[instanceKey] = { touching: isTouchingAny, otherKey: otherInstanceKey };
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
