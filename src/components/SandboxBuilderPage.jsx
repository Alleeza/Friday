import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Pencil, Trash2, X } from 'lucide-react';
import AIChatPanel from './AIChatPanel';
import GamePreviewCanvas from './GamePreviewCanvas';
import LogicBlock from './LogicBlock';
import { compileScriptsByInstance } from '../utils/scriptCompiler';
import { createScriptRuntime } from '../utils/scriptRuntime';
import { BLOCK_PALETTE, DEFAULT_EVENT, EVENT_OPTIONS } from '../data/builderCapabilities.js';
import { sandboxAssets } from '../data/sandboxAssets';
import { createDefaultAIService } from '../ai/createDefaultAIService.js';
import {
  getDefaultModelForProvider,
  getDefaultProviderName,
} from '../ai/providerCatalog.js';
import { useAIChat } from '../hooks/useAIChat';
import { StageProgressSection } from './ProjectRoadmapPage';
function createSeedScript(eventName = DEFAULT_EVENT) {
  return [{ id: 'event-start', type: 'block', parts: ['When', eventName], tone: 'events' }];
}

function cloneValue(value, fallback) {
  if (value == null) return fallback;
  return JSON.parse(JSON.stringify(value));
}

function blockText(parts = []) {
  return parts.map((part) => {
    if (typeof part === 'string') return part;
    if (part.type === 'asset') {
      const matched = (part.options || []).find((option) => option.value === part.value);
      return matched?.label || part.value || 'object';
    }
    return part.label || part.value || 'value';
  }).join(' ').replace(/\s+/g, ' ').trim();
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

export default function SandboxBuilderPage({ initialSetupData = null, projectPlan = null }) {
  const runtimeRef = useRef(null);
  const rafRef = useRef(null);
  const lastTickRef = useRef(0);
  const lastSnapshotPublishRef = useRef(0);
  const quickEditorRef = useRef(null);
  const initialSceneInstances = useMemo(
    () => cloneValue(initialSetupData?.initialScene, []),
    [initialSetupData]
  );
  const [sceneInstances, setSceneInstances] = useState(() => initialSceneInstances);
  const [focusedInstanceKey, setFocusedInstanceKey] = useState(null);
  const [editorInstanceKey, setEditorInstanceKey] = useState(null);
  const [editorStage, setEditorStage] = useState('event');
  const [scriptsByInstanceKey, setScriptsByInstanceKey] = useState(() => cloneValue(initialSetupData?.initialScripts, {}));
  const [selectedBlock, setSelectedBlock] = useState(`When ${DEFAULT_EVENT}`);
  const [selectedCategory, setSelectedCategory] = useState('Movement');
  const [dragOverLoopId, setDragOverLoopId] = useState(null);
  const [dragOverTopBlockId, setDragOverTopBlockId] = useState(null);
  const [dragOverChildKey, setDragOverChildKey] = useState(null);
  const [draggingScriptBlock, setDraggingScriptBlock] = useState(null);
  const [draggingPaletteBlock, setDraggingPaletteBlock] = useState(false);
  const [trashActive, setTrashActive] = useState(false);
  const [historyStack, setHistoryStack] = useState([]);
  const [compileErrorsByInstance, setCompileErrorsByInstance] = useState({});
  const [runtimeSnapshot, setRuntimeSnapshot] = useState(null);
  const [mode, setMode] = useState('edit');
  const selectedProvider = getDefaultProviderName();
  const selectedModel = getDefaultModelForProvider(selectedProvider);

  const aiService = useMemo(
    () => createDefaultAIService({ providerName: selectedProvider, model: selectedModel }),
    [selectedModel, selectedProvider]
  );

  const { messages, sendMessage, addNotification, isStreaming, abortResponse } = useAIChat({
    aiService,
    contextData: {
      sceneInstances,
      scriptsByInstanceKey,
      availableAssets: sandboxAssets,
      compileErrors: compileErrorsByInstance,
      runtimeSnapshot,
      mode,
    },
  });

  const dispatchRuntimeEvent = (eventType, payload = {}) => {
    runtimeRef.current?.dispatch(eventType, payload);
    if (runtimeRef.current) setRuntimeSnapshot(runtimeRef.current.getSnapshot());
  };

  useEffect(() => {
    if (messages.length) return;
    addNotification('Build one object at a time. Each placed object gets its own script.');
    addNotification('Press Play to compile every script and make the sandbox follow the code.');
  }, [addNotification, messages.length]);

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
    setFocusedInstanceKey((current) => current && instanceKeys.has(current) ? current : null);
    setEditorInstanceKey((current) => current && instanceKeys.has(current) ? current : null);
  }, [sceneInstances]);

  useEffect(() => {
    if (mode !== 'play') return undefined;
    const onKeyDown = () => {
      runtimeRef.current?.dispatch('key is pressed');
      if (runtimeRef.current) setRuntimeSnapshot(runtimeRef.current.getSnapshot());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);
  useEffect(() => {
    if (mode === 'play') return undefined;
    const clearDragUi = () => {
      setDraggingScriptBlock(null);
      setDraggingPaletteBlock(false);
      setTrashActive(false);
      setDragOverTopBlockId(null);
      setDragOverChildKey(null);
      setDragOverLoopId(null);
    };
    window.addEventListener('dragend', clearDragUi);
    window.addEventListener('drop', clearDragUi);
    return () => {
      window.removeEventListener('dragend', clearDragUi);
      window.removeEventListener('drop', clearDragUi);
    };
  }, [mode]);
  const paletteBlocks = useMemo(() => BLOCK_PALETTE[selectedCategory] || [], [selectedCategory]);
  const selectedScriptBlocks = scriptsByInstanceKey[editorInstanceKey] || [];
  const selectedErrors = compileErrorsByInstance[editorInstanceKey] || [];
  const selectedLabel = getInstanceDisplayLabel(sceneInstances, editorInstanceKey);
  const selectedInstance = sceneInstances.find((instance) => instance.key === editorInstanceKey) || null;
  const selectedEvent = selectedScriptBlocks.find((block) => block.id === 'event-start')?.parts?.[1] || DEFAULT_EVENT;
  const isOverValidScriptDropTarget = Boolean(dragOverTopBlockId || dragOverLoopId || dragOverChildKey);
  const assetOptions = useMemo(() => {
    const dynamic = sceneInstances.map((instance) => ({
      value: instance.key,
      label: `${instance.emoji} ${getInstanceDisplayLabel(sceneInstances, instance.key)}`,
    }));
    return [{ value: 'Self', label: '🙂 Self' }, ...dynamic];
  }, [sceneInstances]);

  const hydratePart = (part) => {
    if (typeof part === 'string') return part;
    if (part.type !== 'asset') return part;
    const fallback = assetOptions[0]?.value || 'Self';
    const nextValue = assetOptions.some((option) => option.value === part.value) ? part.value : fallback;
    return { ...part, value: nextValue, options: assetOptions };
  };

  const hydrateParts = (parts = []) => parts.map((part) => hydratePart(part));
  const selectInstance = (instanceKey, openEditor = false) => {
    setFocusedInstanceKey(instanceKey || null);
    if (mode === 'play') return;
    if (openEditor) {
      setEditorInstanceKey(instanceKey || null);
      setEditorStage('event');
    } else if (!instanceKey) {
      setEditorInstanceKey(null);
      setEditorStage('event');
    }
  };

  const closeEditor = () => {
    setFocusedInstanceKey(null);
    setEditorInstanceKey(null);
    setEditorStage('event');
  };

  useEffect(() => {
    if (!editorInstanceKey) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeEditor();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editorInstanceKey]);

  useEffect(() => {
    if (!editorInstanceKey || editorStage !== 'event' || mode === 'play') return undefined;
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (quickEditorRef.current?.contains(target)) return;
      if (target.closest('[data-sandbox-canvas-root="true"]')) return;
      closeEditor();
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [editorInstanceKey, editorStage, mode]);

  const pushHistorySnapshot = () => {
    setHistoryStack((prev) => [...prev.slice(-29), { scriptsByInstanceKey: cloneScripts(scriptsByInstanceKey), selectedBlock }]);
  };

  const updateSelectedScript = (updater) => {
    if (!editorInstanceKey) return;
    setScriptsByInstanceKey((prev) => ({ ...prev, [editorInstanceKey]: updater(prev[editorInstanceKey] || createSeedScript()) }));
  };

  const makeBlockFromTemplate = (template) => template.type === 'loop'
    ? { id: `${template.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: 'loop', parts: hydrateParts(template.parts), tone: template.tone, children: [] }
    : { id: `${template.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: 'block', parts: hydrateParts(template.parts), tone: template.tone };

  const pushAiMessage = addNotification;

  const addTopLevel = (template) => {
    if (!editorInstanceKey || mode === 'play') return;
    pushHistorySnapshot();
    const instance = makeBlockFromTemplate(template);
    const text = blockText(template.parts);
    updateSelectedScript((blocks) => [...blocks, instance]);
    setSelectedBlock(text);
    setCompileErrorsByInstance((prev) => ({ ...prev, [editorInstanceKey]: [] }));
    pushAiMessage(`Added "${text}" to ${selectedLabel}.`);
  };

  const addInsideLoop = (loopId, template) => {
    if (!editorInstanceKey || mode === 'play' || template.type === 'loop') return;
    pushHistorySnapshot();
    const instance = makeBlockFromTemplate(template);
    const text = blockText(template.parts);
    updateSelectedScript((blocks) => blocks.map((block) => block.id !== loopId || block.type !== 'loop' ? block : { ...block, children: [...block.children, instance] }));
    setSelectedBlock(text);
    setCompileErrorsByInstance((prev) => ({ ...prev, [editorInstanceKey]: [] }));
    pushAiMessage(`Dropped "${text}" inside the loop for ${selectedLabel}.`);
  };

  const handleDragStart = (e, template) => {
    flushSync(() => {
      setDraggingPaletteBlock(true);
      setTrashActive(false);
    });
    const payload = JSON.stringify({ kind: 'palette-template', template });
    e.dataTransfer.setData('application/json', payload);
    e.dataTransfer.setData('text/plain', payload);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handlePaletteDragEnd = () => {
    setDraggingPaletteBlock(false);
    setTrashActive(false);
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
      return { ...block, parts: block.parts.map((part, idx) => idx !== partIdx || typeof part === 'string' ? part : part.type === 'dropdown' || part.type === 'asset' ? { ...part, value: nextValue } : { ...part, label: nextValue }) };
    }));
  };

  const updateNestedPart = (loopId, childId, partIdx, nextValue) => {
    updateSelectedScript((blocks) => blocks.map((block) => {
      if (block.id !== loopId || block.type !== 'loop') return block;
      return { ...block, children: block.children.map((child) => child.id !== childId ? child : { ...child, parts: child.parts.map((part, idx) => idx !== partIdx || typeof part === 'string' ? part : part.type === 'dropdown' || part.type === 'asset' ? { ...part, value: nextValue } : { ...part, label: nextValue }) }) };
    }));
  };

  const handleEventChange = (nextEvent) => {
    if (!editorInstanceKey || mode === 'play') return;
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
    flushSync(() => {
      setDraggingScriptBlock(payload);
      setTrashActive(false);
    });
    const dragPayload = JSON.stringify({ kind: 'script-block', ...payload });
    e.dataTransfer.setData('application/json', dragPayload);
    e.dataTransfer.setData('text/plain', dragPayload);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleScriptBlockDragEnd = () => {
    setDraggingScriptBlock(null);
    setDraggingPaletteBlock(false);
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

  const extractDraggedBlock = (blocks, payload) => {
    if (!payload) return { nextBlocks: blocks, movedBlock: null };
    if (payload.scope === 'top') {
      const fromIdx = blocks.findIndex((block) => block.id === payload.id);
      if (fromIdx === -1) return { nextBlocks: blocks, movedBlock: null };
      const nextBlocks = [...blocks];
      const [movedBlock] = nextBlocks.splice(fromIdx, 1);
      return { nextBlocks, movedBlock };
    }
    if (payload.scope === 'child') {
      let movedBlock = null;
      const nextBlocks = blocks.map((block) => {
        if (block.type !== 'loop' || block.id !== payload.loopId) return block;
        return {
          ...block,
          children: block.children.filter((child) => {
            if (child.id === payload.id) {
              movedBlock = child;
              return false;
            }
            return true;
          }),
        };
      });
      return { nextBlocks, movedBlock };
    }
    return { nextBlocks: blocks, movedBlock: null };
  };

  const insertDraggedTopLevelAt = (payload, targetIndex = null) => {
    if (!payload) return;
    pushHistorySnapshot();
    updateSelectedScript((blocks) => {
      const { nextBlocks, movedBlock } = extractDraggedBlock(blocks, payload);
      if (!movedBlock) return blocks;
      const insertIndex = targetIndex == null ? nextBlocks.length : Math.max(0, Math.min(targetIndex, nextBlocks.length));
      const updated = [...nextBlocks];
      updated.splice(insertIndex, 0, movedBlock);
      return updated;
    });
  };

  const insertDraggedChildAt = (payload, targetLoopId, targetIndex = null) => {
    if (!payload || !targetLoopId) return;
    pushHistorySnapshot();
    updateSelectedScript((blocks) => {
      const { nextBlocks, movedBlock } = extractDraggedBlock(blocks, payload);
      if (!movedBlock) return blocks;
      return nextBlocks.map((block) => {
        if (block.type !== 'loop' || block.id !== targetLoopId) return block;
        const insertIndex = targetIndex == null ? block.children.length : Math.max(0, Math.min(targetIndex, block.children.length));
        const nextChildren = [...block.children];
        nextChildren.splice(insertIndex, 0, movedBlock);
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
      setDraggingPaletteBlock(false);
    }
  };

  const stopRuntime = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    runtimeRef.current = null;
    lastTickRef.current = 0;
    lastSnapshotPublishRef.current = 0;
    setMode('edit');
    setRuntimeSnapshot(null);
    pushAiMessage('Stopped play mode. Edit the scripts and run again.');
  };

  const startRuntime = () => {
    if (!sceneInstances.length) {
      pushAiMessage('Place at least one object in the sandbox before pressing Play.');
      return;
    }

    const { programsByKey, errorsByKey } = compileScriptsByInstance(scriptsByInstanceKey);
    setCompileErrorsByInstance(errorsByKey);
    if (Object.keys(errorsByKey).length) {
      const firstKey = Object.keys(errorsByKey)[0];
      setFocusedInstanceKey(firstKey);
      setEditorInstanceKey(firstKey);
      setEditorStage('expanded');
      pushAiMessage(`Play blocked. ${getInstanceDisplayLabel(sceneInstances, firstKey)} has compile errors.`);
      return;
    }
    const runtime = createScriptRuntime({ instances: sceneInstances, programsByKey });
    runtime.dispatch('game starts');
    runtimeRef.current = runtime;
    setRuntimeSnapshot(runtime.getSnapshot());
    setMode('play');
    lastSnapshotPublishRef.current = 0;
    pushAiMessage("Play started. Your objects are running their scripts now.");
    const loop = (timestamp) => {
      if (!runtimeRef.current) return;
      const delta = lastTickRef.current ? Math.min(timestamp - lastTickRef.current, 50) : 16;
      lastTickRef.current = timestamp;
      runtimeRef.current.tick(delta);
      if (!lastSnapshotPublishRef.current || timestamp - lastSnapshotPublishRef.current >= 80) {
        lastSnapshotPublishRef.current = timestamp;
        setRuntimeSnapshot(runtimeRef.current.getSnapshot());
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const quickEditorPosition = selectedInstance
    ? (() => {
        const x = selectedInstance.x || 0;
        const y = selectedInstance.y || 0;
        const preferredLeft = x > 860 ? x - 375 : x + 130;
        return {
          left: `${Math.min(Math.max(preferredLeft, 24), 980)}px`,
          top: `${Math.min(Math.max(y + 8, 88), 540)}px`,
        };
      })()
    : null;

  const renderScriptBlock = (block) => {
    if (block.type === 'loop') {
      return (
        <div
          key={block.id}
          className={`rounded-[22px] border-b-4 border-[#d39704] bg-[#f2b705] p-3 text-white transition ${dragOverTopBlockId === block.id ? 'ring-2 ring-sky-300' : ''}`}
          onDragOver={(e) => {
            if (mode === 'play') return;
            const parsed = parseScriptDragPayload(e);
            if (!parsed) return;
            e.preventDefault();
            if (trashActive) setTrashActive(false);
            setDragOverTopBlockId(block.id);
          }}
          onDragLeave={() => dragOverTopBlockId === block.id && setDragOverTopBlockId(null)}
          onDrop={(e) => {
            if (mode === 'play') return;
            const parsed = parseScriptDragPayload(e);
            if (!parsed) return;
            e.preventDefault();
            const targetIndex = selectedScriptBlocks.findIndex((candidate) => candidate.id === block.id);
            if (targetIndex !== -1) insertDraggedTopLevelAt(parsed, targetIndex);
            setDragOverTopBlockId(null);
          }}
        >
          <LogicBlock
            parts={hydrateParts(block.parts)}
            tone="control"
            compact
            assetOptions={assetOptions}
            editable={mode !== 'play'}
            onPartChange={(idx, value) => updateTopLevelPart(block.id, idx, value)}
            selected={selectedBlock === blockText(block.parts)}
            onClick={() => setSelectedBlock(blockText(block.parts))}
            draggable={mode !== 'play'}
            onDragStart={(e) => handleScriptBlockDragStart(e, { kind: 'script-block', scope: 'top', id: block.id })}
            onDragEnd={handleScriptBlockDragEnd}
          />
          <div
            className={`mt-1 rounded-[20px] border-2 border-dashed px-3 py-1 transition-all ${dragOverLoopId === block.id ? 'min-h-16 border-white bg-white/30' : 'min-h-8 border-white/55 bg-white/10'}`}
            onDragOver={(e) => {
              if (mode === 'play') return;
              e.preventDefault();
              e.stopPropagation();
              if (trashActive) setTrashActive(false);
              if (dragOverLoopId !== block.id) setDragOverLoopId(block.id);
            }}
            onDragLeave={() => setDragOverLoopId((current) => (current === block.id ? null : current))}
            onDrop={(e) => {
              if (mode === 'play') return;
              e.preventDefault();
              e.stopPropagation();
              const template = parseDragTemplate(e);
              if (template) addInsideLoop(block.id, template);
              const parsed = parseScriptDragPayload(e);
              if (parsed) insertDraggedChildAt(parsed, block.id);
              setDragOverLoopId(null);
            }}
          >
            <div className="space-y-0.5">
              {block.children.map((child, childIdx) => (
                <div key={child.id} className="space-y-0.5">
                  <div
                    className={`h-3 rounded-full border-2 border-dashed transition ${dragOverChildKey === `${block.id}:${child.id}:before` ? 'border-white bg-white/30' : 'border-transparent'}`}
                    onDragOver={(e) => {
                      if (mode === 'play') return;
                      const parsed = parseScriptDragPayload(e);
                      if (!parsed) return;
                      e.preventDefault();
                      e.stopPropagation();
                      if (trashActive) setTrashActive(false);
                      setDragOverChildKey(`${block.id}:${child.id}:before`);
                    }}
                    onDragLeave={() => dragOverChildKey === `${block.id}:${child.id}:before` && setDragOverChildKey(null)}
                    onDrop={(e) => {
                      if (mode === 'play') return;
                      const parsed = parseScriptDragPayload(e);
                      if (!parsed) return;
                      e.preventDefault();
                      e.stopPropagation();
                      insertDraggedChildAt(parsed, block.id, childIdx);
                      setDragOverChildKey(null);
                    }}
                  />
                  <div
                    className={`rounded-[20px] transition ${dragOverChildKey === `${block.id}:${child.id}` ? 'ring-2 ring-white/80' : ''}`}
                    onDragOver={(e) => {
                      if (mode === 'play') return;
                      const parsed = parseScriptDragPayload(e);
                      if (!parsed || parsed.scope !== 'child') return;
                      e.preventDefault();
                      e.stopPropagation();
                      if (trashActive) setTrashActive(false);
                      setDragOverChildKey(`${block.id}:${child.id}`);
                    }}
                    onDragLeave={() => dragOverChildKey === `${block.id}:${child.id}` && setDragOverChildKey(null)}
                    onDrop={(e) => {
                      if (mode === 'play') return;
                      const parsed = parseScriptDragPayload(e);
                      if (!parsed || parsed.scope !== 'child') return;
                      e.preventDefault();
                      e.stopPropagation();
                      moveNestedBlockBefore(parsed.loopId, parsed.id, block.id, child.id);
                      setDragOverChildKey(null);
                    }}
                  >
                    <LogicBlock
                      parts={hydrateParts(child.parts)}
                      tone={child.tone}
                      compact
                      assetOptions={assetOptions}
                      editable={mode !== 'play'}
                      onPartChange={(idx, value) => updateNestedPart(block.id, child.id, idx, value)}
                      selected={selectedBlock === blockText(child.parts)}
                      onClick={() => setSelectedBlock(blockText(child.parts))}
                      draggable={mode !== 'play'}
                      onDragStart={(e) => handleScriptBlockDragStart(e, { kind: 'script-block', scope: 'child', loopId: block.id, id: child.id })}
                      onDragEnd={handleScriptBlockDragEnd}
                    />
                  </div>
                </div>
              ))}
              <div
                className={`h-3 rounded-full border-2 border-dashed transition ${dragOverChildKey === `${block.id}:end` ? 'border-white bg-white/30' : 'border-transparent'}`}
                onDragOver={(e) => {
                  if (mode === 'play') return;
                  const parsed = parseScriptDragPayload(e);
                  if (!parsed) return;
                  e.preventDefault();
                  e.stopPropagation();
                  if (trashActive) setTrashActive(false);
                  setDragOverChildKey(`${block.id}:end`);
                }}
                onDragLeave={() => dragOverChildKey === `${block.id}:end` && setDragOverChildKey(null)}
                onDrop={(e) => {
                  if (mode === 'play') return;
                  const parsed = parseScriptDragPayload(e);
                  if (!parsed) return;
                  e.preventDefault();
                  e.stopPropagation();
                  insertDraggedChildAt(parsed, block.id);
                  setDragOverChildKey(null);
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={block.id}
        className={`rounded-[20px] transition ${dragOverTopBlockId === block.id ? 'ring-2 ring-sky-300' : ''}`}
        onDragOver={(e) => {
          if (mode === 'play') return;
          const parsed = parseScriptDragPayload(e);
          if (!parsed || block.id === 'event-start') return;
          e.preventDefault();
          if (trashActive) setTrashActive(false);
          setDragOverTopBlockId(block.id);
        }}
        onDragLeave={() => dragOverTopBlockId === block.id && setDragOverTopBlockId(null)}
        onDrop={(e) => {
          if (mode === 'play') return;
          const parsed = parseScriptDragPayload(e);
          if (!parsed || block.id === 'event-start') return;
          e.preventDefault();
          const targetIndex = selectedScriptBlocks.findIndex((candidate) => candidate.id === block.id);
          if (targetIndex !== -1) insertDraggedTopLevelAt(parsed, targetIndex);
          setDragOverTopBlockId(null);
        }}
      >
        <LogicBlock
          parts={hydrateParts(block.parts)}
          tone={block.tone}
          compact
          className="min-h-[64px]"
          assetOptions={assetOptions}
          editable={mode !== 'play'}
          onPartChange={(idx, value) => updateTopLevelPart(block.id, idx, value)}
          selected={block.id !== 'event-start' && selectedBlock === blockText(block.parts)}
          onClick={() => setSelectedBlock(blockText(block.parts))}
          draggable={mode !== 'play' && block.id !== 'event-start'}
          onDragStart={block.id === 'event-start' ? undefined : (e) => handleScriptBlockDragStart(e, { kind: 'script-block', scope: 'top', id: block.id })}
          onDragEnd={block.id === 'event-start' ? undefined : handleScriptBlockDragEnd}
        />
      </div>
    );
  };

  return (
    <main className="w-full space-y-4 px-4 py-4 lg:px-6">
      {projectPlan ? (
        <StageProgressSection
          setupData={initialSetupData}
          plan={projectPlan}
          workspaceState={{ sceneInstances, scriptsByInstanceKey, runtimeSnapshot }}
          provider={aiService?.provider ?? null}
        />
      ) : null}
      <section>
        <div className="relative h-[640px] w-full">
          <GamePreviewCanvas
            mode={mode}
            runtimeSnapshot={runtimeSnapshot}
            selectedInstanceKey={editorStage === 'expanded' ? null : focusedInstanceKey}
            initialPlacedAssets={initialSceneInstances}
            onSceneChange={({ instances, selectedInstanceKey: nextKey }) => {
              setSceneInstances(instances);
              if (nextKey) setFocusedInstanceKey(nextKey);
              if (editorInstanceKey && !instances.some((instance) => instance.key === editorInstanceKey)) {
                setEditorInstanceKey(null);
              }
            }}
            onSelectedInstanceChange={(nextKey) => selectInstance(nextKey, Boolean(nextKey) && mode !== 'play')}
            onPlay={startRuntime}
            onStop={stopRuntime}
            suppressSelectionChrome={editorStage === 'expanded'}
            onSpriteClick={(instanceKey) => {
              runtimeRef.current?.dispatch('sprite clicked', { instanceKey });
              runtimeRef.current?.dispatch('object is tapped', { instanceKey });
              if (runtimeRef.current) setRuntimeSnapshot(runtimeRef.current.getSnapshot());
            }}
          />

          {editorInstanceKey && mode !== 'play' && editorStage === 'event' && quickEditorPosition ? (
            <div
              ref={quickEditorRef}
              className="absolute z-30 inline-flex max-w-[360px] items-center gap-2 rounded-[22px] border-b-4 border-[#b72d63] bg-[#d22d72] pl-4 pr-4 py-2.5 text-white shadow-[0_8px_18px_rgba(183,45,99,0.26)]"
              style={quickEditorPosition}
            >
              <span className="text-[20px] font-black leading-none tracking-[-0.01em]">When</span>
              <select
                value={selectedEvent}
                onChange={(e) => handleEventChange(e.target.value)}
                className="min-w-0 max-w-[190px] rounded-full border-2 border-white/80 bg-white px-4 py-1.5 text-[16px] font-extrabold text-slate-800 outline-none"
              >
                {EVENT_OPTIONS.map((eventName) => (
                  <option key={eventName} value={eventName}>
                    {eventName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setEditorStage('expanded')}
                className="grid h-10 w-10 place-items-center rounded-[18px] bg-white/22 shadow-[inset_0_-2px_0_rgba(255,255,255,0.08)]"
                aria-label="Open block editor"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#d22d72]">
                  <Pencil size={18} strokeWidth={3} />
                </span>
              </button>
            </div>
          ) : null}

          {editorInstanceKey && mode !== 'play' && editorStage === 'expanded' ? (
            <div className="pointer-events-none absolute inset-0 z-30 p-6">
              <div className="pointer-events-auto absolute inset-x-6 top-5 bottom-6 flex flex-col gap-4">
                <div className="flex items-center gap-4 rounded-[30px] border border-[#e5e7eb] bg-white px-5 py-4 shadow-[0_24px_55px_rgba(15,23,42,0.14)]">
                  <div className="flex h-14 items-center gap-3 rounded-[16px] border border-[#d3dae3] bg-[#eef3f8] px-4">
                    <div className="text-[24px] leading-none">{selectedInstance?.emoji}</div>
                    <div className="text-[20px] font-extrabold leading-none text-slate-700">
                      {selectedLabel}
                    </div>
                  </div>
                  <div className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-[24px] border border-[#e5e7eb] bg-[#fffef9] px-4 shadow-[inset_0_-2px_0_rgba(148,163,184,0.12)]">
                    <span className="text-[20px] font-black leading-none tracking-[-0.01em] text-slate-800">When</span>
                    <select
                      value={selectedEvent}
                      onChange={(e) => handleEventChange(e.target.value)}
                      disabled={!editorInstanceKey || mode === 'play'}
                      className="h-9 rounded-full border-2 border-[#b72d63] bg-[#d22d72] pl-4 pr-5 text-[17px] font-extrabold text-white shadow-[0_4px_0_rgba(135,27,72,0.45)] outline-none disabled:opacity-40"
                    >
                      {EVENT_OPTIONS.map((eventName) => (
                        <option key={eventName} value={eventName} className="bg-white text-slate-800">
                          {eventName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <button
                      type="button"
                      onClick={closeEditor}
                      className="grid h-11 w-11 place-items-center rounded-full bg-[#8f98a3] text-white shadow-[0_6px_0_rgba(71,85,105,0.22)]"
                      aria-label="Close editor"
                    >
                      <X size={22} />
                    </button>
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={!historyStack.length || mode === 'play'}
                      className="grid h-11 w-11 place-items-center rounded-full bg-[#8f98a3] text-white shadow-[0_6px_0_rgba(71,85,105,0.22)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="text-[22px] font-black leading-none">↶</span>
                    </button>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="flex min-h-0 flex-col rounded-[30px] border border-[#e5e7eb] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                    <div className="mb-4 px-1">
                      <label htmlFor="block-category" className="mb-3 block text-[12px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Block Categories</label>
                      <select
                        id="block-category"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full rounded-[18px] border border-[#d3dae3] bg-white px-4 py-3 text-[15px] font-extrabold uppercase tracking-[0.04em] text-slate-700 shadow-[inset_0_-2px_0_rgba(148,163,184,0.12)] outline-none"
                      >
                        {Object.keys(BLOCK_PALETTE).map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                      {paletteBlocks.map((block) => (
                        <LogicBlock
                          key={block.id}
                          parts={hydrateParts(block.parts)}
                          tone={block.tone}
                          compact
                          assetOptions={assetOptions}
                          draggable={mode !== 'play'}
                          onDragStart={(e) => handleDragStart(e, block)}
                          onDragEnd={handlePaletteDragEnd}
                          onClick={() => addTopLevel(block)}
                        />
                      ))}
                    </div>
                    {selectedErrors.length ? (
                      <div className="mt-4 rounded-[24px] border border-[#ffd2d7] bg-[#fff1f3] p-4">
                        <p className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-rose-500">Compile Errors</p>
                        <ul className="mt-2 space-y-1 text-[14px] font-bold leading-6 text-rose-600">
                          {selectedErrors.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex min-h-0 flex-col rounded-[30px] border border-[#e5e7eb] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                    <div
                      className={`relative flex min-h-0 flex-1 flex-col rounded-[32px] bg-white transition ${['script-canvas', 'script-end', 'script-body'].includes(dragOverTopBlockId) ? 'bg-slate-50 ring-2 ring-sky-200/80' : ''}`}
                      onDragOver={(e) => {
                        if (mode === 'play') return;
                        const template = parseDragTemplate(e);
                        const parsed = parseScriptDragPayload(e);
                        if (!template && !parsed) return;
                        e.preventDefault();
                        if (trashActive) setTrashActive(false);
                        if (parsed) setDragOverTopBlockId('script-canvas');
                      }}
                      onDragLeave={() => dragOverTopBlockId === 'script-canvas' && setDragOverTopBlockId(null)}
                      onDrop={(e) => {
                        if (mode === 'play') return;
                        const template = parseDragTemplate(e);
                        const parsed = parseScriptDragPayload(e);
                        if (template) addTopLevel(template);
                        else if (parsed) insertDraggedTopLevelAt(parsed);
                        setDragOverTopBlockId(null);
                      }}
                    >
                      <div className="mb-4 px-1">
                        <p className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Script</p>
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col space-y-2 overflow-hidden">
                        {selectedScriptBlocks.filter((block) => block.id === 'event-start').map((block) => (
                          <div key={block.id}>{renderScriptBlock(block)}</div>
                        ))}
                        <div
                          className={`flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[26px] border-2 border-dashed border-sky-100 p-2 transition ${dragOverTopBlockId === 'script-end' ? 'bg-sky-100/70' : 'bg-slate-50/65'}`}
                          onDragOver={(e) => {
                            if (mode === 'play') return;
                            const parsed = parseScriptDragPayload(e);
                            if (!parsed) return;
                            e.preventDefault();
                            if (trashActive) setTrashActive(false);
                            setDragOverTopBlockId('script-end');
                          }}
                          onDragLeave={() => dragOverTopBlockId === 'script-end' && setDragOverTopBlockId(null)}
                          onDrop={(e) => {
                            if (mode === 'play') return;
                            const parsed = parseScriptDragPayload(e);
                            if (!parsed) return;
                            e.preventDefault();
                            insertDraggedTopLevelAt(parsed);
                            setDragOverTopBlockId(null);
                          }}
                        >
                          {selectedScriptBlocks.filter((block) => block.id !== 'event-start').length ? (
                            <div className="min-h-0 space-y-1">
                              {selectedScriptBlocks.filter((block) => block.id !== 'event-start').map((block, index, blocks) => (
                                <div key={block.id} className="space-y-0">
                                  {renderScriptBlock(block)}
                                  <div
                                    className={`h-1.5 rounded-full border-2 border-dashed transition ${
                                      dragOverTopBlockId === `${block.id}:after`
                                        ? 'border-sky-300 bg-sky-100/80'
                                        : 'border-transparent'
                                    }`}
                                    onDragOver={(e) => {
                                      if (mode === 'play') return;
                                      const parsed = parseScriptDragPayload(e);
                                      if (!parsed || parsed.id === block.id) return;
                                      e.preventDefault();
                                      if (trashActive) setTrashActive(false);
                                      setDragOverTopBlockId(`${block.id}:after`);
                                    }}
                                    onDragLeave={() => dragOverTopBlockId === `${block.id}:after` && setDragOverTopBlockId(null)}
                                    onDrop={(e) => {
                                      if (mode === 'play') return;
                                      const parsed = parseScriptDragPayload(e);
                                      if (!parsed || parsed.id === block.id) return;
                                      e.preventDefault();
                                      insertDraggedTopLevelAt(parsed, index + 1);
                                      setDragOverTopBlockId(null);
                                    }}
                                  />
                                </div>
                              ))}
                              <div
                                className={`h-2 rounded-full border-2 border-dashed transition ${
                                  dragOverTopBlockId === 'script-end'
                                    ? 'border-sky-300 bg-sky-100/80'
                                    : 'border-transparent'
                                }`}
                                onDragOver={(e) => {
                                  if (mode === 'play') return;
                                  const parsed = parseScriptDragPayload(e);
                                  if (!parsed) return;
                                  e.preventDefault();
                                  if (trashActive) setTrashActive(false);
                                  setDragOverTopBlockId('script-end');
                                }}
                                onDragLeave={() => dragOverTopBlockId === 'script-end' && setDragOverTopBlockId(null)}
                                onDrop={(e) => {
                                  if (mode === 'play') return;
                                  const parsed = parseScriptDragPayload(e);
                                  if (!parsed) return;
                                  e.preventDefault();
                                  insertDraggedTopLevelAt(parsed);
                                  setDragOverTopBlockId(null);
                                }}
                              />
                              <div className="h-0.5" />
                            </div>
                          ) : (
                            <div className="flex flex-1 items-center justify-center">
                              <div className="flex flex-col items-center gap-3 text-slate-400">
                                <div className="grid h-16 w-16 place-items-center rounded-full border border-[#d8e9f8] bg-white/80 shadow-[inset_0_-2px_0_rgba(148,163,184,0.12)]">
                                  <span className="text-4xl font-semibold leading-none text-slate-300">+</span>
                                </div>
                                <p className="text-sm font-bold tracking-[0.02em] text-slate-400">Drop a block into this script area</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {draggingScriptBlock ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-6">
                    <div
                      className={`pointer-events-auto grid h-20 w-20 place-items-center rounded-full border-2 shadow-[0_10px_24px_rgba(15,23,42,0.24)] transition ${
                        trashActive
                          ? 'scale-110 border-rose-700 bg-rose-600 text-white'
                          : 'border-rose-200 bg-white/95 text-rose-500'
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!trashActive) setTrashActive(true);
                      }}
                      onDragLeave={() => setTrashActive(false)}
                      onDrop={handleTrashDrop}
                      aria-label="Delete dragged block"
                    >
                      <Trash2 size={34} strokeWidth={2.6} />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>
      <section>
        <div className="w-full">
          <AIChatPanel
            messages={messages}
            onSend={sendMessage}
            isStreaming={isStreaming}
            onAbort={abortResponse}
          />
        </div>
      </section>
      {draggingPaletteBlock && mode !== 'play' ? (
        <div className="pointer-events-none fixed inset-0 z-[80]">
          <div
            className={`absolute inset-0 transition ${
              draggingPaletteBlock
                ? 'bg-slate-950/70'
                : 'bg-transparent'
            }`}
          />
        </div>
      ) : null}
    </main>
  );
}
