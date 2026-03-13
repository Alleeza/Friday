import { useEffect, useRef, useState } from 'react';
import AIChatPanel from './AIChatPanel';
import BlocklyScriptEditor from './BlocklyScriptEditor';
import GamePreviewCanvas from './GamePreviewCanvas';
import { compileScriptsByInstance } from '../utils/scriptCompiler';
import { createScriptRuntime } from '../utils/scriptRuntime';

const defaultEvent = 'game starts';

function createSeedScript(eventName = defaultEvent) {
  return [{ id: 'event-start', type: 'block', parts: ['When', eventName], tone: 'events' }];
}

function getInstanceDisplayLabel(instances, instanceKey) {
  const instance = instances.find((item) => item.key === instanceKey);
  if (!instance) return 'Select an object';
  const sameType = instances.filter((item) => item.id === instance.id);
  const index = sameType.findIndex((item) => item.key === instanceKey);
  return `${instance.label} ${index + 1}`;
}

function getRuntimeHint(selectedErrors, selectedLabel, selectedScriptBlocks, mode) {
  if (selectedErrors.length) return `Fix ${selectedLabel}'s compile issues, then press Play again.`;
  if (mode === 'play') return `Running ${selectedLabel}. Click the sprite or press a key to trigger more events.`;
  const actionCount = Math.max(0, (selectedScriptBlocks?.length || 0) - 1);
  return `For ${selectedLabel}, start with an event and add ${actionCount ? 'more actions or loops' : 'a first action block'}.`;
}

export default function SandboxBuilderPage() {
  const runtimeRef = useRef(null);
  const rafRef = useRef(null);
  const lastTickRef = useRef(0);
  const [sceneInstances, setSceneInstances] = useState([]);
  const [selectedInstanceKey, setSelectedInstanceKey] = useState(null);
  const [scriptsByInstanceKey, setScriptsByInstanceKey] = useState({});
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
    setSelectedInstanceKey((current) => (current && instanceKeys.has(current) ? current : sceneInstances[0]?.key || null));
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

  const selectedScriptBlocks = scriptsByInstanceKey[selectedInstanceKey] || [];
  const selectedErrors = compileErrorsByInstance[selectedInstanceKey] || [];
  const selectedLabel = getInstanceDisplayLabel(sceneInstances, selectedInstanceKey);
  const runtimeLogs = runtimeSnapshot?.logs || [];

  const pushAiMessage = (text) => setMessages((prev) => [...prev, { role: 'ai', text }]);

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
    const reply = canned || getRuntimeHint(selectedErrors, selectedLabel, selectedScriptBlocks, mode);
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
        <div className="h-[640px] lg:col-span-9">
          <GamePreviewCanvas
            mode={mode}
            runtimeSnapshot={runtimeSnapshot}
            onSceneChange={({ instances, selectedInstanceKey: nextKey }) => {
              setSceneInstances(instances);
              if (nextKey) setSelectedInstanceKey(nextKey);
            }}
            onPlay={startRuntime}
            onStop={stopRuntime}
            onSpriteClick={(instanceKey) => {
              runtimeRef.current?.dispatch('sprite clicked', { instanceKey });
              if (runtimeRef.current) setRuntimeSnapshot(runtimeRef.current.getSnapshot());
            }}
          />
        </div>
        <div className="h-[640px] lg:col-span-3">
          <AIChatPanel messages={messages} onSend={sendChat} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-12">
        <div className="studio-panel rounded-[34px] border-[#ddd6c8] bg-[#f2f1eb] lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-extrabold uppercase tracking-wide text-slate-600">Scene Objects</p>
          </div>
          <div className="space-y-2">
            {sceneInstances.length ? sceneInstances.map((instance) => (
              <button
                key={instance.key}
                onClick={() => {
                  if (mode === 'play') return;
                  setSelectedInstanceKey(instance.key);
                  setMessages((prev) => [...prev, { role: 'ai', text: `Selected ${getInstanceDisplayLabel(sceneInstances, instance.key)}. Script edits only affect this object.` }]);
                }}
                className={`w-full rounded-[22px] border-2 px-5 py-4 text-left text-base font-bold leading-none shadow-[inset_0_-2px_0_rgba(15,23,42,0.06)] transition ${selectedInstanceKey === instance.key ? 'border-[#13a4ff] bg-[#dff2ff] text-[#0d76ab]' : 'border-[#d7d8dc] bg-white text-slate-700 hover:border-[#cfd3da]'}`}
              >
                {instance.emoji} {getInstanceDisplayLabel(sceneInstances, instance.key)}
              </button>
            )) : (
              <p className="rounded-2xl bg-white px-4 py-4 text-sm font-bold text-slate-500">Drop objects into the sandbox to create script targets.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-6">
          <BlocklyScriptEditor
            selectedInstanceKey={selectedInstanceKey}
            selectedLabel={selectedLabel}
            scriptBlocks={selectedScriptBlocks}
            mode={mode}
            onScriptChange={(nextScript) => {
              if (!selectedInstanceKey || mode === 'play') return;
              setScriptsByInstanceKey((prev) => ({ ...prev, [selectedInstanceKey]: nextScript }));
              setCompileErrorsByInstance((prev) => ({ ...prev, [selectedInstanceKey]: [] }));
            }}
          />
        </div>

        <div className="studio-panel lg:col-span-3">
          <div className="rounded-3xl border border-[#d6dbe2] bg-white p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Status</p>
            <p className="mt-2 text-lg font-display text-slate-800">{selectedLabel}</p>
            <p className={`mt-1 text-sm font-bold ${selectedErrors.length ? 'text-rose-500' : mode === 'play' ? 'text-[#1cb0f6]' : 'text-[#58cc02]'}`}>
              {selectedErrors.length ? 'Compile error' : mode === 'play' ? 'Running' : 'Ready'}
            </p>
            {selectedErrors.length ? (
              <ul className="mt-3 space-y-1 text-sm font-semibold text-rose-600">
                {selectedErrors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            ) : (
              <p className="mt-3 text-sm font-semibold text-slate-500">
                {mode === 'play' ? 'Editing is locked while runtime is active.' : 'Use Blockly categories and connections to build the selected object script.'}
              </p>
            )}
          </div>
          <div className="mt-4 rounded-3xl border border-[#d6dbe2] bg-white p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Runtime Log</p>
            <div className="mt-3 max-h-32 space-y-2 overflow-y-auto text-sm font-semibold text-slate-600">
              {runtimeLogs.length ? runtimeLogs.map((log, idx) => <p key={`${log}-${idx}`}>{log}</p>) : <p>No runtime events yet. Press Play and interact with the sandbox.</p>}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
