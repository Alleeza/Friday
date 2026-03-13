/**
 * contextBuilder — serializes the user's current workspace state into a
 * readable text block that gets appended to each AI request.
 *
 * This is a pure function with no React dependencies — it receives plain
 * data and returns a string.
 */

/**
 * Converts a script block's parts array into a human-readable string.
 * @param {Array} parts
 * @returns {string}
 */
function serializeParts(parts) {
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => {
      if (typeof part === 'string') return part;
      if (!part) return '';
      return part.label ?? part.value ?? '';
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Recursively serializes a script block tree into indented pseudo-code.
 * @param {object} block - script block
 * @param {number} indent - current indentation level
 * @returns {string}
 */
function serializeBlock(block, indent = 0) {
  const pad = '  '.repeat(indent);
  const label = serializeParts(block.parts);

  if (block.type === 'loop') {
    const children = Array.isArray(block.children) ? block.children : [];
    const childLines = children.map((child) => serializeBlock(child, indent + 1)).join('\n');
    return `${pad}${label}\n${childLines || `${pad}  (empty loop)`}`;
  }

  return `${pad}${label}`;
}

/**
 * Serializes all blocks for a single instance into readable pseudo-code.
 * @param {Array} blocks - array of script blocks
 * @returns {string}
 */
function serializeScript(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return '  (no blocks yet)';
  return blocks.map((block) => serializeBlock(block, 1)).join('\n');
}

/**
 * buildContext — gathers workspace state into a structured string for the AI.
 *
 * @param {{
 *   sceneInstances: Array<{ key: string, emoji: string, label: string, x: number, y: number, scale: number, rotation: number }>,
 *   scriptsByInstanceKey: Record<string, Array>,
 *   availableAssets: Array<{ id: string, emoji: string, label: string, unlockXp: number }>,
 *   compileErrors: Record<string, string[]>,
 *   runtimeSnapshot: object | null,
 *   mode: 'edit' | 'play',
 * }} options
 * @returns {string}
 */
export function buildContext({
  sceneInstances = [],
  scriptsByInstanceKey = {},
  availableAssets = [],
  compileErrors = {},
  runtimeSnapshot = null,
  mode = 'edit',
}) {
  const lines = [];

  // --- Mode ---
  lines.push(`Mode: ${mode.toUpperCase()}`);
  lines.push('');

  // --- Canvas: placed objects ---
  if (sceneInstances.length === 0) {
    lines.push('Canvas: Empty — no objects placed yet.');
  } else {
    lines.push(`Canvas (${sceneInstances.length} object${sceneInstances.length !== 1 ? 's' : ''} placed):`);
    // Count duplicates for display labels
    const labelCounts = {};
    for (const inst of sceneInstances) {
      labelCounts[inst.label] = (labelCounts[inst.label] ?? 0) + 1;
    }
    const labelSeen = {};
    for (const inst of sceneInstances) {
      labelSeen[inst.label] = (labelSeen[inst.label] ?? 0) + 1;
      const displayLabel =
        labelCounts[inst.label] > 1 ? `${inst.label} ${labelSeen[inst.label]}` : inst.label;
      lines.push(`  - ${inst.emoji} ${displayLabel}`);
    }
  }
  lines.push('');

  // --- Scripts ---
  if (sceneInstances.length === 0) {
    lines.push('Scripts: None (no objects on canvas).');
  } else {
    lines.push('Scripts:');
    const labelSeen2 = {};
    const labelCounts2 = {};
    for (const inst of sceneInstances) {
      labelCounts2[inst.label] = (labelCounts2[inst.label] ?? 0) + 1;
    }
    for (const inst of sceneInstances) {
      labelSeen2[inst.label] = (labelSeen2[inst.label] ?? 0) + 1;
      const displayLabel =
        labelCounts2[inst.label] > 1 ? `${inst.label} ${labelSeen2[inst.label]}` : inst.label;
      const blocks = scriptsByInstanceKey[inst.key] ?? [];
      lines.push(`  [${inst.emoji} ${displayLabel}]`);
      lines.push(serializeScript(blocks));
    }
  }
  lines.push('');

  // --- Compile errors ---
  const errorEntries = Object.entries(compileErrors).filter(([, errs]) => errs?.length);
  if (errorEntries.length > 0) {
    lines.push('Compile Errors:');
    const labelSeen3 = {};
    const labelCounts3 = {};
    for (const inst of sceneInstances) {
      labelCounts3[inst.label] = (labelCounts3[inst.label] ?? 0) + 1;
    }
    for (const [instanceKey, errors] of errorEntries) {
      const inst = sceneInstances.find((i) => i.key === instanceKey);
      if (inst) {
        labelSeen3[inst.label] = (labelSeen3[inst.label] ?? 0) + 1;
        const displayLabel =
          labelCounts3[inst.label] > 1 ? `${inst.label} ${labelSeen3[inst.label]}` : inst.label;
        lines.push(`  ${inst.emoji} ${displayLabel}:`);
      } else {
        lines.push(`  (unknown object):`);
      }
      for (const err of errors) {
        lines.push(`    • ${err}`);
      }
    }
    lines.push('');
  }

  // --- Runtime state (play mode only) ---
  if (mode === 'play' && runtimeSnapshot) {
    const vars = runtimeSnapshot.variables ?? {};
    lines.push('Runtime State:');
    lines.push(`  Score: ${vars.score ?? 0}`);
    lines.push(`  Time: ${vars.time ?? 0}s`);
    lines.push(`  Is Alive: ${vars.isAlive ?? true}`);
    const logs = Array.isArray(runtimeSnapshot.logs) ? runtimeSnapshot.logs : [];
    if (logs.length > 0) {
      lines.push('  Recent logs:');
      // Show last 5 logs
      for (const log of logs.slice(-5)) {
        lines.push(`    > ${log}`);
      }
    }
    lines.push('');
  }

  // --- Available assets ---
  if (availableAssets.length > 0) {
    const placedIds = new Set(sceneInstances.map((i) => i.id));
    const unplaced = availableAssets.filter((a) => !placedIds.has(a.id));
    const placed = availableAssets.filter((a) => placedIds.has(a.id));
    if (placed.length > 0) lines.push(`Assets on canvas: ${placed.map((a) => `${a.emoji} ${a.label}`).join(', ')}`);
    if (unplaced.length > 0) lines.push(`Assets available to add: ${unplaced.map((a) => `${a.emoji} ${a.label}`).join(', ')}`);
  }

  return lines.join('\n');
}
