const MAX_STEPS_PER_TICK = 24;

function evaluateCondition(condition, variables) {
  switch ((condition || '').toLowerCase()) {
    case 'score < 10':
      return (variables.score || 0) < 10;
    case 'is alive':
      return Boolean(variables.isAlive);
    case 'time > 0':
      return (variables.time || 0) > 0;
    default:
      return false;
  }
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
        const radians = (asset.rotation * Math.PI) / 180;
        asset.x += Math.cos(radians) * instruction.amount;
        asset.y += Math.sin(radians) * instruction.amount;
        asset.facing = instruction.amount >= 0 ? 1 : -1;
        break;
      }
      case 'turn':
        asset.rotation += instruction.degrees;
        break;
      case 'setRotationStyle':
        asset.rotationStyle = instruction.style;
        break;
      case 'changeX':
        asset.x += instruction.amount;
        asset.facing = instruction.amount >= 0 ? 1 : -1;
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
      if (instruction.type === 'forever') {
        task.frames.push({ instructions: instruction.body, index: 0, loopType: 'forever' });
        continue;
      }
      if (instruction.type === 'while') {
        if (!evaluateCondition(instruction.condition, state.variables)) continue;
        task.frames.push({ instructions: instruction.body, index: 0, loopType: 'while', condition: instruction.condition });
        continue;
      }
      applyAction(instruction, asset);
    }

    return task.frames.length > 0 || task.waitRemainingMs > 0;
  };

  return {
    dispatch(eventType, payload = {}) {
      if (eventType === 'sprite clicked' && payload.instanceKey) {
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
