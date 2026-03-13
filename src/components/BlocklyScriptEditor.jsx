import { useEffect, useMemo, useRef, useState } from 'react';
import * as Blockly from 'blockly';

const EVENT_OPTIONS = ['game starts', 'sprite clicked', 'key pressed', 'timer reaches 0', 'score reaches 10'];
const ROTATION_OPTIONS = ['dont rotate', 'left-right', 'all around'];
const COSTUME_OPTIONS = ['bunny jump', 'tree glow', 'crab legs'];
const SOUND_OPTIONS = ['jump', 'coin', 'Human Beatbox1'];
const CONDITION_OPTIONS = ['score < 10', 'is alive', 'time > 0'];

const BLOCK_GROUPS = [
  {
    id: 'events',
    title: 'Events',
    color: '#d22d72',
    blocks: [
      { type: 'sandbox_event_when', label: 'when (gameStarts)' },
    ],
  },
  {
    id: 'movement',
    title: 'Movement',
    color: '#eb5425',
    blocks: [
      { type: 'sandbox_move_forward', label: 'sprite.move(12)' },
      { type: 'sandbox_turn', label: 'sprite.turn(15)' },
      { type: 'sandbox_set_rotation_style', label: "sprite.rotationStyle = 'dont rotate'" },
      { type: 'sandbox_change_x', label: 'sprite.x += 6' },
    ],
  },
  {
    id: 'looks',
    title: 'Looks & Sounds',
    color: '#67b51f',
    blocks: [
      { type: 'sandbox_switch_costume', label: "sprite.costume = 'bunny jump'" },
      { type: 'sandbox_next_costume', label: 'sprite.nextCostume()' },
      { type: 'sandbox_play_sound', label: "audio.play('jump')", accentColor: '#8f58e8' },
    ],
  },
  {
    id: 'control',
    title: 'Control',
    color: '#f2b705',
    blocks: [
      { type: 'sandbox_forever', label: 'while (true) { ... }' },
      { type: 'sandbox_while', label: 'while (condition) { ... }' },
      { type: 'sandbox_wait', label: 'await wait(1)' },
    ],
  },
];

function defineBlocks() {
  if (Blockly.Blocks.sandbox_event_when) return;

  Blockly.defineBlocksWithJsonArray([
    {
      type: 'sandbox_event_when',
      message0: 'when ( %1 )',
      args0: [{ type: 'field_dropdown', name: 'EVENT', options: EVENT_OPTIONS.map((value) => [value, value]) }],
      nextStatement: null,
      colour: '#d22d72',
    },
    {
      type: 'sandbox_move_forward',
      message0: 'sprite.move( %1 )',
      args0: [{ type: 'field_number', name: 'AMOUNT', value: 12, precision: 1 }],
      previousStatement: null,
      nextStatement: null,
      colour: '#eb5425',
    },
    {
      type: 'sandbox_turn',
      message0: 'sprite.turn( %1 )',
      args0: [{ type: 'field_number', name: 'DEGREES', value: 15, precision: 1 }],
      previousStatement: null,
      nextStatement: null,
      colour: '#eb5425',
    },
    {
      type: 'sandbox_set_rotation_style',
      message0: 'sprite.rotationStyle = %1',
      args0: [{ type: 'field_dropdown', name: 'STYLE', options: ROTATION_OPTIONS.map((value) => [value, value]) }],
      previousStatement: null,
      nextStatement: null,
      colour: '#eb5425',
    },
    {
      type: 'sandbox_change_x',
      message0: 'sprite.x += %1',
      args0: [{ type: 'field_number', name: 'AMOUNT', value: 6, precision: 1 }],
      previousStatement: null,
      nextStatement: null,
      colour: '#eb5425',
    },
    {
      type: 'sandbox_switch_costume',
      message0: 'sprite.costume = %1',
      args0: [{ type: 'field_dropdown', name: 'COSTUME', options: COSTUME_OPTIONS.map((value) => [value, value]) }],
      previousStatement: null,
      nextStatement: null,
      colour: '#67b51f',
    },
    {
      type: 'sandbox_next_costume',
      message0: 'sprite.nextCostume()',
      previousStatement: null,
      nextStatement: null,
      colour: '#67b51f',
    },
    {
      type: 'sandbox_play_sound',
      message0: 'audio.play( %1 )',
      args0: [{ type: 'field_dropdown', name: 'SOUND', options: SOUND_OPTIONS.map((value) => [value, value]) }],
      previousStatement: null,
      nextStatement: null,
      colour: '#8f58e8',
    },
    {
      type: 'sandbox_forever',
      message0: 'while (true)',
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'SUBSTACK' }],
      previousStatement: null,
      nextStatement: null,
      colour: '#f2b705',
    },
    {
      type: 'sandbox_while',
      message0: 'while ( %1 )',
      args0: [{ type: 'field_dropdown', name: 'CONDITION', options: CONDITION_OPTIONS.map((value) => [value, value]) }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'SUBSTACK' }],
      previousStatement: null,
      nextStatement: null,
      colour: '#f2b705',
    },
    {
      type: 'sandbox_wait',
      message0: 'await wait( %1 )',
      args0: [{ type: 'field_number', name: 'SECONDS', value: 1, min: 0, precision: 0.1 }],
      previousStatement: null,
      nextStatement: null,
      colour: '#f2b705',
    },
  ]);
}

function blockChainToState(blocks) {
  if (!blocks.length) return null;
  return blocks.reduceRight((next, block, index) => {
    const state = blockToState(block);
    if (index === 0) {
      state.x = 24;
      state.y = 24;
    }
    if (next) state.next = { block: next };
    return state;
  }, null);
}

function blockToState(block) {
  const label = block?.parts?.[0];
  const value = block?.parts?.[1];

  if (block.type === 'loop') {
    const loopLabel = String(label || '').toLowerCase();
    const state = { type: loopLabel === 'while' ? 'sandbox_while' : 'sandbox_forever', id: block.id };
    if (loopLabel === 'while') {
      state.fields = { CONDITION: typeof value === 'string' ? value : value?.value || CONDITION_OPTIONS[0] };
    }
    if (block.children?.length) {
      state.inputs = { SUBSTACK: { block: blockChainToState(block.children) } };
    }
    return state;
  }

  if (String(label || '').toLowerCase() === 'when') {
    return { type: 'sandbox_event_when', id: block.id, fields: { EVENT: typeof value === 'string' ? value : EVENT_OPTIONS[0] } };
  }

  const tokenValue = typeof value === 'string' ? value : value?.value || value?.label;
  const tokenNumber = Number.parseFloat(tokenValue);

  switch (String(label || '').toLowerCase()) {
    case 'move forward':
      return { type: 'sandbox_move_forward', id: block.id, fields: { AMOUNT: Number.isFinite(tokenNumber) ? tokenNumber : 12 } };
    case 'turn degrees':
      return { type: 'sandbox_turn', id: block.id, fields: { DEGREES: Number.isFinite(tokenNumber) ? tokenNumber : 15 } };
    case 'set rotation style':
      return { type: 'sandbox_set_rotation_style', id: block.id, fields: { STYLE: tokenValue || ROTATION_OPTIONS[0] } };
    case 'change x by':
      return { type: 'sandbox_change_x', id: block.id, fields: { AMOUNT: Number.isFinite(tokenNumber) ? tokenNumber : 6 } };
    case 'switch costume to':
      return { type: 'sandbox_switch_costume', id: block.id, fields: { COSTUME: tokenValue || COSTUME_OPTIONS[0] } };
    case 'next costume':
      return { type: 'sandbox_next_costume', id: block.id };
    case 'play sound':
      return { type: 'sandbox_play_sound', id: block.id, fields: { SOUND: tokenValue || SOUND_OPTIONS[0] } };
    case 'wait':
      return { type: 'sandbox_wait', id: block.id, fields: { SECONDS: Number.isFinite(tokenNumber) ? tokenNumber : 1 } };
    default:
      return { type: 'sandbox_wait', id: block.id, fields: { SECONDS: 1 } };
  }
}

function workspaceStateFromScript(scriptBlocks) {
  const chain = blockChainToState(scriptBlocks || []);
  return { blocks: { languageVersion: 0, blocks: chain ? [chain] : [] } };
}

function readNumberField(block, fieldName, fallback) {
  const parsed = Number.parseFloat(block.getFieldValue(fieldName));
  return Number.isFinite(parsed) ? String(parsed) : String(fallback);
}

function statementToChildren(block, inputName = 'SUBSTACK') {
  const firstChild = block.getInputTargetBlock(inputName);
  return stackToScript(firstChild);
}

function singleBlockToScript(block) {
  switch (block.type) {
    case 'sandbox_event_when':
      return { id: block.id, type: 'block', parts: ['When', block.getFieldValue('EVENT')], tone: 'events' };
    case 'sandbox_move_forward':
      return { id: block.id, type: 'block', parts: ['Move Forward', { label: readNumberField(block, 'AMOUNT', 12) }], tone: 'movement' };
    case 'sandbox_turn':
      return { id: block.id, type: 'block', parts: ['Turn degrees', { label: readNumberField(block, 'DEGREES', 15) }], tone: 'movement' };
    case 'sandbox_set_rotation_style':
      return { id: block.id, type: 'block', parts: ['Set rotation style', { type: 'dropdown', value: block.getFieldValue('STYLE'), options: ROTATION_OPTIONS }], tone: 'movement' };
    case 'sandbox_change_x':
      return { id: block.id, type: 'block', parts: ['Change X by', { label: readNumberField(block, 'AMOUNT', 6) }], tone: 'movement' };
    case 'sandbox_switch_costume':
      return { id: block.id, type: 'block', parts: ['Switch costume to', { type: 'dropdown', value: block.getFieldValue('COSTUME'), options: COSTUME_OPTIONS }], tone: 'looks' };
    case 'sandbox_next_costume':
      return { id: block.id, type: 'block', parts: ['Next costume'], tone: 'sound' };
    case 'sandbox_play_sound':
      return { id: block.id, type: 'block', parts: ['Play sound', { type: 'dropdown', value: block.getFieldValue('SOUND'), options: SOUND_OPTIONS }, 'until done'], tone: 'sound' };
    case 'sandbox_forever':
      return { id: block.id, type: 'loop', parts: ['Forever'], tone: 'control', children: statementToChildren(block) };
    case 'sandbox_while':
      return { id: block.id, type: 'loop', parts: ['While', { type: 'dropdown', value: block.getFieldValue('CONDITION'), options: CONDITION_OPTIONS }], tone: 'control', children: statementToChildren(block) };
    case 'sandbox_wait':
      return { id: block.id, type: 'block', parts: ['Wait', { label: readNumberField(block, 'SECONDS', 1) }, 'seconds'], tone: 'control' };
    default:
      return null;
  }
}

function stackToScript(firstBlock) {
  const blocks = [];
  let current = firstBlock;
  while (current) {
    const parsed = singleBlockToScript(current);
    if (parsed) blocks.push(parsed);
    current = current.getNextBlock();
  }
  return blocks;
}

function workspaceToScript(workspace) {
  return workspace
    .getTopBlocks(true)
    .sort((left, right) => left.getRelativeToSurfaceXY().y - right.getRelativeToSurfaceXY().y)
    .flatMap((block) => stackToScript(block));
}

function scriptSignature(scriptBlocks) {
  return JSON.stringify(scriptBlocks || []);
}

function makeBlock(workspace, blockType) {
  const block = workspace.newBlock(blockType);
  block.initSvg();
  block.render();
  return block;
}

function createBlockAt(workspace, blockType, x, y) {
  const block = makeBlock(workspace, blockType);
  block.moveBy(x, y);
  return block;
}

export default function BlocklyScriptEditor({ selectedInstanceKey, selectedLabel, scriptBlocks, mode, onScriptChange }) {
  const hostRef = useRef(null);
  const workspaceRef = useRef(null);
  const isSyncingRef = useRef(false);
  const appliedSignatureRef = useRef('');
  const dragTypeRef = useRef(null);
  const dropCountRef = useRef(0);
  const [activeGroupId, setActiveGroupId] = useState(BLOCK_GROUPS[0].id);
  const [dragActive, setDragActive] = useState(false);

  const activeGroup = useMemo(
    () => BLOCK_GROUPS.find((group) => group.id === activeGroupId) || BLOCK_GROUPS[0],
    [activeGroupId],
  );

  const workspaceOptions = useMemo(() => ({
    trashcan: true,
    scrollbars: true,
    renderer: 'zelos',
    sounds: false,
    zoom: {
      controls: true,
      wheel: true,
      startScale: 0.92,
      maxScale: 1.4,
      minScale: 0.55,
      scaleSpeed: 1.15,
    },
    move: {
      drag: true,
      wheel: true,
    },
    readOnly: mode === 'play' || !selectedInstanceKey,
  }), [mode, selectedInstanceKey]);

  useEffect(() => {
    defineBlocks();
  }, []);

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const workspace = Blockly.inject(hostRef.current, workspaceOptions);
    workspaceRef.current = workspace;

    const resizeObserver = new ResizeObserver(() => {
      Blockly.svgResize(workspace);
    });
    resizeObserver.observe(hostRef.current);

    const listener = (event) => {
      if (isSyncingRef.current || event.isUiEvent) return;
      const nextScript = workspaceToScript(workspace);
      appliedSignatureRef.current = scriptSignature(nextScript);
      onScriptChange(nextScript);
    };

    workspace.addChangeListener(listener);
    Blockly.svgResize(workspace);

    return () => {
      resizeObserver.disconnect();
      workspace.removeChangeListener(listener);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [onScriptChange, workspaceOptions]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    const nextSignature = scriptSignature(scriptBlocks);
    if (appliedSignatureRef.current === nextSignature) return;

    isSyncingRef.current = true;
    workspace.clear();
    Blockly.serialization.workspaces.load(workspaceStateFromScript(scriptBlocks), workspace);
    appliedSignatureRef.current = nextSignature;
    isSyncingRef.current = false;
    Blockly.svgResize(workspace);
  }, [scriptBlocks]);

  const handlePaletteDragStart = (blockType) => {
    dragTypeRef.current = blockType;
  };

  const handlePaletteDragEnd = () => {
    dragTypeRef.current = null;
    setDragActive(false);
  };

  const handleScriptDrop = (event) => {
    event.preventDefault();
    setDragActive(false);

    const workspace = workspaceRef.current;
    const blockType = dragTypeRef.current;
    if (!workspace || !blockType || mode === 'play' || !selectedInstanceKey) return;

    const bounds = hostRef.current?.getBoundingClientRect();
    const relativeX = bounds ? Math.max(24, event.clientX - bounds.left - 40) : 24;
    const relativeY = bounds ? Math.max(24, event.clientY - bounds.top - 24) : 24;
    const stagger = dropCountRef.current * 18;
    dropCountRef.current += 1;
    createBlockAt(workspace, blockType, relativeX + stagger, relativeY + stagger);
    dragTypeRef.current = null;
  };

  return (
    <div className="grid min-h-[560px] gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="studio-panel rounded-[28px] border-[#ddd6c8] bg-[#f2f1eb]">
        <div className="mb-3">
          <label htmlFor="block-category" className="mb-1 block text-sm font-extrabold uppercase tracking-wide text-slate-600">Block Category</label>
          <select
            id="block-category"
            value={activeGroupId}
            onChange={(event) => setActiveGroupId(event.target.value)}
            className="w-full rounded-xl border border-duo-line bg-white px-3 py-2 text-sm font-bold text-slate-700"
          >
            {BLOCK_GROUPS.map((group) => (
              <option key={group.id} value={group.id}>{group.title.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {activeGroup.blocks.map((block) => (
            <div
              key={block.type}
              draggable={mode !== 'play' && Boolean(selectedInstanceKey)}
              onDragStart={() => handlePaletteDragStart(block.type)}
              onDragEnd={handlePaletteDragEnd}
              className={`rounded-[18px] border-b-4 px-4 py-3 text-sm font-extrabold text-white shadow-[0_4px_0_rgba(0,0,0,0.14)] ${mode === 'play' || !selectedInstanceKey ? 'cursor-not-allowed opacity-45' : 'cursor-grab active:cursor-grabbing'}`}
              style={{ backgroundColor: block.accentColor || activeGroup.color, borderColor: 'rgba(0,0,0,0.18)' }}
            >
              {block.label}
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-[560px] overflow-hidden rounded-[28px] border border-[#d7dcc4] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        <div
          className={`relative h-full min-h-[560px] bg-[#f8faf5] ${dragActive ? 'ring-4 ring-sky-200 ring-inset' : ''}`}
          onDragOver={(event) => {
            if (mode === 'play' || !selectedInstanceKey || !dragTypeRef.current) return;
            event.preventDefault();
            if (!dragActive) setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleScriptDrop}
        >
          {!selectedInstanceKey ? (
            <div className="absolute inset-0 z-10 grid place-items-center px-6 text-center text-sm font-bold text-slate-500">
              Select or place an asset to start scripting.
            </div>
          ) : null}
          <div ref={hostRef} className={`h-full w-full ${!selectedInstanceKey ? 'opacity-25' : ''}`} />
        </div>
      </div>
    </div>
  );
}
