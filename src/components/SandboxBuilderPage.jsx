import { useEffect, useMemo, useRef, useState } from 'react';
import AIChatPanel from './AIChatPanel';
import GamePreviewCanvas from './GamePreviewCanvas';
import LogicBlock from './LogicBlock';
import { compileScriptsByInstance } from '../utils/scriptCompiler';
import { createScriptRuntime } from '../utils/scriptRuntime';

const eventOptions = ['game starts', 'sprite clicked', 'key pressed', 'timer reaches 0', 'score reaches 10'];
const defaultEvent = eventOptions[0];

const palette = {
  Movement: [
    { id: 'move-forward', tone: 'movement', parts: ['Move Forward', { label: '12' }] },
    { id: 'turn', tone: 'movement', parts: ['Turn degrees', { label: '15' }] },
    { id: 'set-rotation', tone: 'movement', parts: ['Set rotation style', { type: 'dropdown', value: 'dont rotate', options: ['dont rotate', 'left-right', 'all around'] }] },
    { id: 'change-x', tone: 'movement', parts: ['Change X by', { label: '6' }] },
  ],
  'Looks & Sounds': [
    { id: 'switch-costume', tone: 'looks', parts: ['Switch costume to', { type: 'dropdown', value: 'bunny jump', options: ['bunny jump', 'tree glow', 'crab legs'] }] },
    { id: 'next-costume', tone: 'sound', parts: ['Next costume'] },
    { id: 'play-sound', tone: 'sound', parts: ['Play sound', { type: 'dropdown', value: 'jump', options: ['jump', 'coin', 'Human Beatbox1'] }, 'until done'] },
  ],
  Control: [
    { id: 'forever', tone: 'control', type: 'loop', parts: ['Forever'] },
    { id: 'while', tone: 'control', type: 'loop', parts: ['While', { type: 'dropdown', value: 'time > 0', options: ['score < 10', 'is alive', 'time > 0'] }] },
    { id: 'wait', tone: 'control', parts: ['Wait', { label: '1' }, 'seconds'] },
  ],
};

function createSeedScript(eventName = defaultEvent) {
  return [{ id: 'event-start', type: 'block', parts: ['When', eventName], tone: 'events' }];
}

function blockText(parts = []) {
  return parts.map((part) => typeof part === 'string' ? part : part.label || part.value || 'value').join(' ').replace(/\s+/g, ' ').trim();
}

function cloneScripts(scriptsByInstanceKey) {
  return JSON.parse(JSON.stringify(scriptsByInstanceKey));
}

function getInstanceDisplayLabel(instances, instanceKey) {
  const instance = instances.find((item) => item.key === instanceKey);
  if (!instance) return 'Select an object';
  const sameType = instances.filter((item) => item.id === instance.id);
  const index = sameType.findIndex((item) => item.key === instanceKey);
  return `${instance.label} ${index + 1}`;
}

function getRuntimeHint(selectedErrors, selectedLabel, selectedBlock, mode) {
  if (selectedErrors.length) return `Fix ${selectedLabel}'s compile issues, then press Play again.`;
  if (mode === 'play') return `Running ${selectedLabel}. Click the sprite or press a key to trigger more events.`;
  return `For "${selectedBlock}", think event -> loop -> action.`;
}

export default function SandboxBuilderPage() {
  const runtimeRef = useRef(null);
  const rafRef = useRef(null);
  const lastTickRef = useRef(0);
  const [sceneInstances, setSceneInstances] = useState([]);
  const [selectedInstanceKey, setSelectedInstanceKey] = useState(null);
  const [scriptsByInstanceKey, setScriptsByInstanceKey] = useState({});
  const [selectedBlock, setSelectedBlock] = useState(`When ${defaultEvent}`);
  const [selectedCategory, setSelectedCategory] = useState('Movement');
  const [dragOverLoopId, setDragOverLoopId] = useState(null);
  const [dragOverTopBlockId, setDragOverTopBlockId] = useState(null);
  const [dragOverChildKey, setDragOverChildKey] = useState(null);
  const [draggingScriptBlock, setDraggingScriptBlock] = useState(null);
  const [trashActive, setTrashActive] = useState(false);
  const [historyStack, setHistoryStack] = useState([]);
  const [compileErrorsByInstance, setCompileErrorsByInstance] = useState({});
  const [runtimeSnapshot, setRuntimeSnapshot] = useState(null);
  const [mode, setMode] = useState('edit');
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Build one object at a time. Each placed object gets its own script.' },
    { role: 'ai', text: 'Press Play to compile every script and make the sandbox follow the code.' },
  ]);

  useEffect(() => {
    const instanceKeys = new Set(sceneInstances.map((instance) => instance.key));
    setScriptsByInstanceKey((prev) => {
      const next = {};
      sceneInstances.forEach((instance) => {
        next[instance.key] = prev[instance.key] ? prev[instance.key] : createSeedScript();
      });
      return next;
    });
    setCompileErrorsByInstance((prev) => {
      const next = {};
      Object.entries(prev).forEach(([key, errors]) => {
        if (instanceKeys.has(key)) next[key] = errors;
      });
      return next;
    });
    setSelectedInstanceKey((current) => current && instanceKeys.has(current) ? current : sceneInstances[0]?.key || null);
  }, [sceneInstances]);

  useEffect(() => {
    if (mode !== 'play') return undefined;
    const onKeyDown = () => {
      runtimeRef.current?.dispatch('key pressed');
      if (runtimeRef.current) setRuntimeSnapshot(runtimeRef.current.getSnapshot());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const paletteBlocks = useMemo(() => palette[selectedCategory] || [], [selectedCategory]);
  const selectedScriptBlocks = scriptsByInstanceKey[selectedInstanceKey] || [];
  const selectedErrors = compileErrorsByInstance[selectedInstanceKey] || [];
  const selectedLabel = getInstanceDisplayLabel(sceneInstances, selectedInstanceKey);
  const runtimeLogs = runtimeSnapshot?.logs || [];

  const pushHistorySnapshot = () => {
    setHistoryStack((prev) => [...prev.slice(-29), { scriptsByInstanceKey: cloneScripts(scriptsByInstanceKey), selectedBlock }]);
  };

  const updateSelectedScript = (updater) => {
    if (!selectedInstanceKey) return;
    setScriptsByInstanceKey((prev) => ({ ...prev, [selectedInstanceKey]: updater(prev[selectedInstanceKey] || createSeedScript()) }));
  };

  const makeBlockFromTemplate = (template) => template.type === 'loop'
    ? { id: `${template.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: 'loop', parts: template.parts, tone: template.tone, children: [] }
    : { id: `${template.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: 'block', parts: template.parts, tone: template.tone };

  const pushAiMessage = (text) => setMessages((prev) => [...prev, { role: 'ai', text }]);

  const addTopLevel = (template) => {
    if (!selectedInstanceKey || mode === 'play') return;
    pushHistorySnapshot();
    const instance = makeBlockFromTemplate(template);
    const text = blockText(template.parts);
    updateSelectedScript((blocks) => [...blocks, instance]);
    setSelectedBlock(text);
    setCompileErrorsByInstance((prev) => ({ ...prev, [selectedInstanceKey]: [] }));
    pushAiMessage(`Added "${text}" to ${selectedLabel}.`);
  };

  const addInsideLoop = (loopId, template) => {
    if (!selectedInstanceKey || mode === 'play' || template.type === 'loop') return;
    pushHistorySnapshot();
    const instance = makeBlockFromTemplate(template);
    const text = blockText(template.parts);
    updateSelectedScript((blocks) => blocks.map((block) => block.id !== loopId || block.type !== 'loop' ? block : { ...block, children: [...block.children, instance] }));
    setSelectedBlock(text);
    setCompileErrorsByInstance((prev) => ({ ...prev, [selectedInstanceKey]: [] }));
    pushAiMessage(`Dropped "${text}" inside the loop for ${selectedLabel}.`);
  };

  const handleDragStart = (e, template) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ kind: 'palette-template', template }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const parseDragTemplate = (e) => {
    try {
      const parsed = JSON.parse(e.dataTransfer.getData('application/json'));
      return parsed?.kind === 'palette-template' ? parsed.template : null;
    } catch {
      return null;
    }
  };

  const parseScriptDragPayload = (e) => {
    try {
      const parsed = JSON.parse(e.dataTransfer.getData('application/json'));
      return parsed?.kind === 'script-block' ? parsed : null;
    } catch {
      return null;
    }
  };

  const updateTopLevelPart = (blockId, partIdx, nextValue) => {
    updateSelectedScript((blocks) => blocks.map((block) => {
      if (block.id !== blockId) return block;
      return { ...block, parts: block.parts.map((part, idx) => idx !== partIdx || typeof part === 'string' ? part : part.type === 'dropdown' ? { ...part, value: nextValue } : { ...part, label: nextValue }) };
    }));
  };

  const updateNestedPart = (loopId, childId, partIdx, nextValue) => {
    updateSelectedScript((blocks) => blocks.map((block) => {
      if (block.id !== loopId || block.type !== 'loop') return block;
      return { ...block, children: block.children.map((child) => child.id !== childId ? child : { ...child, parts: child.parts.map((part, idx) => idx !== partIdx || typeof part === 'string' ? part : part.type === 'dropdown' ? { ...part, value: nextValue } : { ...part, label: nextValue }) }) };
    }));
  };

  const handleEventChange = (nextEvent) => {
    if (!selectedInstanceKey || mode === 'play') return;
    pushHistorySnapshot();
    updateSelectedScript((blocks) => blocks.map((block) => block.id === 'event-start' ? { ...block, parts: ['When', nextEvent] } : block));
    setSelectedBlock(`When ${nextEvent}`);
  };

  const removeTopLevelBlock = (blockId) => {
    pushHistorySnapshot();
    updateSelectedScript((blocks) => blocks.filter((block) => block.id !== blockId));
  };

  const removeNestedBlock = (loopId, childId) => {
    pushHistorySnapshot();
    updateSelectedScript((blocks) => blocks.map((block) => block.id !== loopId || block.type !== 'loop' ? block : { ...block, children: block.children.filter((child) => child.id !== childId) }));
  };

  const handleUndo = () => {
    setHistoryStack((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const last = next.pop();
      setScriptsByInstanceKey(last.scriptsByInstanceKey);
      setSelectedBlock(last.selectedBlock);
      pushAiMessage('Undid the last script edit.');
      return next;
    });
  };

  const handleScriptBlockDragStart = (e, payload) => {
    setDraggingScriptBlock(payload);
    setTrashActive(false);
    e.dataTransfer.setData('application/json', JSON.stringify({ kind: 'script-block', ...payload }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleScriptBlockDragEnd = () => {
    setDraggingScriptBlock(null);
    setTrashActive(false);
    setDragOverTopBlockId(null);
    setDragOverChildKey(null);
  };

  const moveTopLevelBlockBefore = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    pushHistorySnapshot();
    updateSelectedScript((blocks) => {
      const fromIdx = blocks.findIndex((block) => block.id === sourceId);
      const toIdx = blocks.findIndex((block) => block.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return blocks;
      const next = [...blocks];
      const [moved] = next.splice(fromIdx, 1);
      const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
      next.splice(insertIdx, 0, moved);
      return next;
    });
  };

  const moveNestedBlockBefore = (sourceLoopId, sourceChildId, targetLoopId, targetChildId) => {
    if (!sourceChildId || !targetChildId) return;
    pushHistorySnapshot();
    updateSelectedScript((blocks) => {
      let movedChild = null;
      const withoutSource = blocks.map((block) => {
        if (block.type !== 'loop' || block.id !== sourceLoopId) return block;
        return { ...block, children: block.children.filter((child) => {
          if (child.id === sourceChildId) {
            movedChild = child;
            return false;
          }
          return true;
        }) };
      });
      if (!movedChild) return blocks;
      return withoutSource.map((block) => {
        if (block.type !== 'loop' || block.id !== targetLoopId) return block;
        const toIdx = block.children.findIndex((child) => child.id === targetChildId);
        if (toIdx === -1) return block;
        const nextChildren = [...block.children];
        nextChildren.splice(toIdx, 0, movedChild);
        return { ...block, children: nextChildren };
      });
    });
  };

  const removeDraggedScriptBlock = (payload) => {
    if (!payload) return;
    if (payload.scope === 'top') removeTopLevelBlock(payload.id);
    if (payload.scope === 'child') removeNestedBlock(payload.loopId, payload.id);
  };

  const handleTrashDrop = (e) => {
    e.preventDefault();
    setTrashActive(false);
    try {
      const raw = e.dataTransfer.getData('application/json');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.kind === 'script-block') removeDraggedScriptBlock(parsed);
      else if (draggingScriptBlock) removeDraggedScriptBlock(draggingScriptBlock);
    } catch {
      if (draggingScriptBlock) removeDraggedScriptBlock(draggingScriptBlock);
    } finally {
      setDraggingScriptBlock(null);
    }
  };

  const stopRuntime = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    runtimeRef.current = null;
    lastTickRef.current = 0;
    setMode('edit');
    setRuntimeSnapshot(null);
    pushAiMessage('Stopped play mode. Edit the scripts and run again.');
  };

  const startRuntime = () => {
    const { programsByKey, errorsByKey } = compileScriptsByInstance(scriptsByInstanceKey);
    setCompileErrorsByInstance(errorsByKey);
    if (Object.keys(errorsByKey).length) {
      const firstKey = Object.keys(errorsByKey)[0];
      setSelectedInstanceKey(firstKey);
      pushAiMessage(`Play blocked. ${getInstanceDisplayLabel(sceneInstances, firstKey)} has compile errors.`);
      return;
    }
    const runtime = createScriptRuntime({ instances: sceneInstances, programsByKey });
    runtime.dispatch('game starts');
    runtimeRef.current = runtime;
    setRuntimeSnapshot(runtime.getSnapshot());
    setMode('play');
    pushAiMessage("Play started. The sandbox is now following each object's script.");
    const loop = (timestamp) => {
      if (!runtimeRef.current) return;
      const delta = lastTickRef.current ? Math.min(timestamp - lastTickRef.current, 50) : 16;
      lastTickRef.current = timestamp;
      runtimeRef.current.tick(delta);
      setRuntimeSnapshot(runtimeRef.current.getSnapshot());
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const sendChat = (text, canned) => {
    setMessages((prev) => [...prev, { role: 'you', text }]);
    const reply = canned || getRuntimeHint(selectedErrors, selectedLabel, selectedBlock, mode);
    setMessages((prev) => [...prev, { role: 'ai', text: reply }]);
  };

  return (
    <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4 lg:px-6">
      <section className="quest-card flex items-center justify-between gap-4 rounded-[34px] border-[#d6eec2] bg-[#f7fff1] p-6 shadow-[0_18px_40px_rgba(15,23,42,0.09)]">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-quest-muted">Friday Sandbox</p>
          <h1 className="font-display text-4xl text-slate-800">Instance-Based Sandbox Builder</h1>
          <p className="mt-2 max-w-3xl text-base font-semibold text-slate-600">Each placed object has its own script. Press Play to compile all scripts and drive the sandbox from runtime state.</p>
        </div>
        <div className="rounded-3xl border border-[#d3dae3] bg-white px-5 py-3 text-right shadow-soft">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Mode</p>
          <p className={`text-2xl font-display ${mode === 'play' ? 'text-[#1cb0f6]' : 'text-[#58cc02]'}`}>{mode === 'play' ? 'Play' : 'Edit'}</p>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-12">
        <div className="h-[640px] lg:col-span-9"><GamePreviewCanvas mode={mode} runtimeSnapshot={runtimeSnapshot} onSceneChange={({ instances, selectedInstanceKey: nextKey }) => { setSceneInstances(instances); if (nextKey) setSelectedInstanceKey(nextKey); }} onPlay={startRuntime} onStop={stopRuntime} onSpriteClick={(instanceKey) => { runtimeRef.current?.dispatch('sprite clicked', { instanceKey }); if (runtimeRef.current) setRuntimeSnapshot(runtimeRef.current.getSnapshot()); }} /></div>
        <div className="h-[640px] lg:col-span-3"><AIChatPanel messages={messages} onSend={sendChat} /></div>
      </section>
      <section className="grid gap-4 lg:grid-cols-12">
        <div className="studio-panel rounded-[34px] border-[#ddd6c8] bg-[#f2f1eb] lg:col-span-3">
          <div className="mb-3 flex items-center justify-between"><p className="text-sm font-extrabold uppercase tracking-wide text-slate-600">Scene Objects</p></div>
          <div className="space-y-2">{sceneInstances.length ? sceneInstances.map((instance) => <button key={instance.key} onClick={() => { if (mode === 'play') return; setSelectedInstanceKey(instance.key); setMessages((prev) => [...prev, { role: 'ai', text: `Selected ${getInstanceDisplayLabel(sceneInstances, instance.key)}. Script edits only affect this object.` }]); }} className={`w-full rounded-[22px] border-2 px-5 py-4 text-left text-base font-bold leading-none shadow-[inset_0_-2px_0_rgba(15,23,42,0.06)] transition ${selectedInstanceKey === instance.key ? 'border-[#13a4ff] bg-[#dff2ff] text-[#0d76ab]' : 'border-[#d7d8dc] bg-white text-slate-700 hover:border-[#cfd3da]'}`}>{instance.emoji} {getInstanceDisplayLabel(sceneInstances, instance.key)}</button>) : <p className="rounded-2xl bg-white px-4 py-4 text-sm font-bold text-slate-500">Drop objects into the sandbox to create script targets.</p>}</div>
        </div>
        <div className="studio-panel lg:col-span-3">
          <div className="mb-3"><label htmlFor="block-category" className="mb-1 block text-sm font-extrabold uppercase tracking-wide text-slate-600">Block Category</label><select id="block-category" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full rounded-xl border border-duo-line bg-white px-3 py-2 text-sm font-bold text-slate-700">{Object.keys(palette).map((category) => <option key={category} value={category}>{category.toUpperCase()}</option>)}</select></div>
          <div className="space-y-2">{paletteBlocks.map((block) => <LogicBlock key={block.id} parts={block.parts} tone={block.tone} compact draggable={mode !== 'play'} onDragStart={(e) => handleDragStart(e, block)} onClick={() => addTopLevel(block)} />)}</div>
          <div className="mt-4 rounded-3xl border border-[#d6dbe2] bg-white p-4"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Status</p><p className="mt-2 text-lg font-display text-slate-800">{selectedLabel}</p><p className={`mt-1 text-sm font-bold ${selectedErrors.length ? 'text-rose-500' : mode === 'play' ? 'text-[#1cb0f6]' : 'text-[#58cc02]'}`}>{selectedErrors.length ? 'Compile error' : mode === 'play' ? 'Running' : 'Ready'}</p>{selectedErrors.length ? <ul className="mt-3 space-y-1 text-sm font-semibold text-rose-600">{selectedErrors.map((error) => <li key={error}>{error}</li>)}</ul> : <p className="mt-3 text-sm font-semibold text-slate-500">{mode === 'play' ? 'Editing is locked while runtime is active.' : 'Change blocks here, then press Play to compile every object.'}</p>}</div>
        </div>
        <div className="studio-panel lg:col-span-6" onDragOver={(e) => mode !== 'play' && e.preventDefault()} onDrop={(e) => { if (mode === 'play') return; const template = parseDragTemplate(e); if (template) addTopLevel(template); }}>
          <div className="mb-3 flex items-center gap-3 rounded-[28px] border-2 border-[#d8dde4] bg-white p-3 shadow-[0_4px_0_rgba(148,163,184,0.16)]"><span className="rounded-2xl border border-[#d3dae3] bg-[#eaf0f6] px-4 py-1.5 text-lg font-extrabold text-[#334155] shadow-[inset_0_-2px_0_rgba(148,163,184,0.18)]">{selectedInstanceKey ? selectedLabel : 'Choose an object'}</span><span className="text-xl font-extrabold text-slate-700">When</span><select value={selectedScriptBlocks.find((block) => block.id === 'event-start')?.parts?.[1] || defaultEvent} onChange={(e) => handleEventChange(e.target.value)} disabled={!selectedInstanceKey || mode === 'play'} className="rounded-full border-2 border-[#b72d63] bg-[#d22d72] pl-3 pr-5 py-1.5 text-base font-extrabold leading-none text-white shadow-[0_3px_0_rgba(135,27,72,0.45)] outline-none disabled:opacity-40">{eventOptions.map((eventName) => <option key={eventName} value={eventName} className="bg-white text-slate-800">{eventName}</option>)}</select><button type="button" onClick={handleUndo} disabled={!historyStack.length || mode === 'play'} aria-label="Undo" className="ml-auto rounded-2xl border border-[#d3d9e1] bg-[#f8fafc] px-4 py-1.5 text-base font-extrabold text-[#94a3b8] shadow-[inset_0_-2px_0_rgba(148,163,184,0.18)] disabled:cursor-not-allowed disabled:opacity-40">↶</button></div>
          <div className="min-h-[360px] rounded-3xl border border-duo-line bg-white p-4">{!selectedInstanceKey ? <div className="rounded-3xl border-2 border-dashed border-[#d8dde4] bg-[#f8fafc] px-5 py-12 text-center text-sm font-bold text-slate-500">Select or place an object to start scripting.</div> : <div className="space-y-3">{selectedScriptBlocks.map((block) => block.type === 'loop' ? <div key={block.id} className={`rounded-[20px] border-b-4 border-[#d39704] bg-[#f2b705] p-3 text-white transition ${dragOverTopBlockId === block.id ? 'ring-2 ring-sky-300' : ''}`} onDragOver={(e) => { if (mode === 'play') return; const parsed = parseScriptDragPayload(e); if (!parsed || parsed.scope !== 'top') return; e.preventDefault(); setDragOverTopBlockId(block.id); }} onDragLeave={() => dragOverTopBlockId === block.id && setDragOverTopBlockId(null)} onDrop={(e) => { if (mode === 'play') return; const parsed = parseScriptDragPayload(e); if (!parsed || parsed.scope !== 'top') return; e.preventDefault(); moveTopLevelBlockBefore(parsed.id, block.id); setDragOverTopBlockId(null); }}><LogicBlock parts={block.parts} tone="control" compact editable={mode !== 'play'} onPartChange={(idx, value) => updateTopLevelPart(block.id, idx, value)} selected={selectedBlock === blockText(block.parts)} onClick={() => setSelectedBlock(blockText(block.parts))} draggable={mode !== 'play'} onDragStart={(e) => handleScriptBlockDragStart(e, { kind: 'script-block', scope: 'top', id: block.id })} onDragEnd={handleScriptBlockDragEnd} /><div className={`mt-2 rounded-2xl border-2 border-dashed p-3 transition-all ${dragOverLoopId === block.id ? 'border-white bg-white/40 min-h-28' : 'border-white/65 bg-white/22 min-h-16'}`} onDragOver={(e) => { if (mode === 'play') return; e.preventDefault(); e.stopPropagation(); if (dragOverLoopId !== block.id) setDragOverLoopId(block.id); }} onDragLeave={() => setDragOverLoopId((current) => current === block.id ? null : current)} onDrop={(e) => { if (mode === 'play') return; e.preventDefault(); e.stopPropagation(); const template = parseDragTemplate(e); if (template) addInsideLoop(block.id, template); setDragOverLoopId(null); }}><div className="space-y-2">{block.children.map((child) => <div key={child.id} className={`rounded-[20px] transition ${dragOverChildKey === `${block.id}:${child.id}` ? 'ring-2 ring-white/80' : ''}`} onDragOver={(e) => { if (mode === 'play') return; const parsed = parseScriptDragPayload(e); if (!parsed || parsed.scope !== 'child') return; e.preventDefault(); e.stopPropagation(); setDragOverChildKey(`${block.id}:${child.id}`); }} onDragLeave={() => dragOverChildKey === `${block.id}:${child.id}` && setDragOverChildKey(null)} onDrop={(e) => { if (mode === 'play') return; const parsed = parseScriptDragPayload(e); if (!parsed || parsed.scope !== 'child') return; e.preventDefault(); e.stopPropagation(); moveNestedBlockBefore(parsed.loopId, parsed.id, block.id, child.id); setDragOverChildKey(null); }}><LogicBlock parts={child.parts} tone={child.tone} compact editable={mode !== 'play'} onPartChange={(idx, value) => updateNestedPart(block.id, child.id, idx, value)} selected={selectedBlock === blockText(child.parts)} onClick={() => setSelectedBlock(blockText(child.parts))} draggable={mode !== 'play'} onDragStart={(e) => handleScriptBlockDragStart(e, { kind: 'script-block', scope: 'child', loopId: block.id, id: child.id })} onDragEnd={handleScriptBlockDragEnd} /></div>)}</div></div></div> : <div key={block.id} className={`rounded-[20px] transition ${dragOverTopBlockId === block.id ? 'ring-2 ring-sky-300' : ''}`} onDragOver={(e) => { if (mode === 'play') return; const parsed = parseScriptDragPayload(e); if (!parsed || parsed.scope !== 'top' || block.id === 'event-start') return; e.preventDefault(); setDragOverTopBlockId(block.id); }} onDragLeave={() => dragOverTopBlockId === block.id && setDragOverTopBlockId(null)} onDrop={(e) => { if (mode === 'play') return; const parsed = parseScriptDragPayload(e); if (!parsed || parsed.scope !== 'top' || block.id === 'event-start') return; e.preventDefault(); moveTopLevelBlockBefore(parsed.id, block.id); setDragOverTopBlockId(null); }}><LogicBlock parts={block.parts} tone={block.tone} compact editable={mode !== 'play'} onPartChange={(idx, value) => updateTopLevelPart(block.id, idx, value)} selected={selectedBlock === blockText(block.parts)} onClick={() => setSelectedBlock(blockText(block.parts))} draggable={mode !== 'play' && block.id !== 'event-start'} onDragStart={block.id === 'event-start' ? undefined : (e) => handleScriptBlockDragStart(e, { kind: 'script-block', scope: 'top', id: block.id })} onDragEnd={block.id === 'event-start' ? undefined : handleScriptBlockDragEnd} /></div>)}</div>}</div>
          <div className="mt-4 rounded-3xl border border-[#d6dbe2] bg-white p-4"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Runtime Log</p><div className="mt-3 max-h-32 space-y-2 overflow-y-auto text-sm font-semibold text-slate-600">{runtimeLogs.length ? runtimeLogs.map((log, idx) => <p key={`${log}-${idx}`}>{log}</p>) : <p>No runtime events yet. Press Play and interact with the sandbox.</p>}</div></div>
        </div>
      </section>
      {draggingScriptBlock && mode !== 'play' ? <div className={`fixed bottom-6 right-6 z-50 rounded-2xl border-2 px-4 py-3 text-sm font-extrabold shadow-lg transition ${trashActive ? 'border-rose-700 bg-rose-600 text-white scale-105' : 'border-rose-400 bg-rose-500 text-white'}`} onDragOver={(e) => { e.preventDefault(); if (!trashActive) setTrashActive(true); }} onDragLeave={() => setTrashActive(false)} onDrop={handleTrashDrop}>Drop to delete</div> : null}
    </main>
  );
}
