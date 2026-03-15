import { useCallback, useEffect, useRef, useState } from 'react';
import GamePreviewCanvas from './GamePreviewCanvas';
import { loadPublishedProject } from '../api/projectState';
import { compileScriptsByInstance } from '../utils/scriptCompiler';
import { createScriptRuntime } from '../utils/scriptRuntime';

function getLiveSandboxStageSize() {
  if (typeof document === 'undefined') return null;
  const canvas = document.querySelector('[data-sandbox-canvas-root="true"]');
  if (!(canvas instanceof HTMLElement)) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return { width: rect.width, height: rect.height };
}

function normalizeProjectState(projectState) {
  return {
    setupData: projectState?.setupData || null,
    scene: {
      placedAssets: Array.isArray(projectState?.scene?.placedAssets)
        ? projectState.scene.placedAssets.map((asset) => ({ ...asset }))
        : [],
      selectedPlacedAssetKey: projectState?.scene?.selectedPlacedAssetKey || null,
      backdropState: projectState?.scene?.backdropState ? { ...projectState.scene.backdropState } : null,
    },
    scriptsByInstanceKey: projectState?.scriptsByInstanceKey || {},
  };
}

export default function SharedGamePage({ projectId, shareId }) {
  const runtimeRef = useRef(null);
  const rafRef = useRef(null);
  const lastTickRef = useRef(0);
  const lastSnapshotPublishRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [publication, setPublication] = useState(null);
  const [runtimeSnapshot, setRuntimeSnapshot] = useState(null);
  const [mode, setMode] = useState('view');

  const stopRuntime = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    runtimeRef.current = null;
    lastTickRef.current = 0;
    lastSnapshotPublishRef.current = 0;
    setMode('view');
    setRuntimeSnapshot(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadPublishedProject(projectId, shareId)
      .then((nextPublication) => {
        if (cancelled) return;
        setPublication({
          ...nextPublication,
          project: normalizeProjectState(nextPublication?.project),
        });
        setLoadError('');
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error.message || 'Unable to load shared game.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      stopRuntime();
    };
  }, [projectId, shareId, stopRuntime]);

  useEffect(() => {
    if (mode !== 'play') return undefined;
    const onKeyDown = (event) => {
      const normalizedKey = String(event.key || '').toLowerCase() === 'spacebar'
        ? 'space'
        : (event.key === ' ' ? 'space' : String(event.key || '').toLowerCase());
      runtimeRef.current?.dispatch('key is pressed', { key: normalizedKey });
      if (runtimeRef.current) setRuntimeSnapshot(runtimeRef.current.getSnapshot());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  const startRuntime = useCallback(() => {
    if (!publication?.project?.scene?.placedAssets?.length) return;

    const instances = publication.project.scene.placedAssets;
    const { programsByKey, errorsByKey } = compileScriptsByInstance(publication.project.scriptsByInstanceKey);
    if (Object.keys(errorsByKey).length) {
      setLoadError('This shared game could not be played because the published version has script errors.');
      return;
    }

    const runtime = createScriptRuntime({
      instances,
      programsByKey,
      stageSize: getLiveSandboxStageSize(),
    });
    runtime.dispatch('game starts');
    runtimeRef.current = runtime;
    setRuntimeSnapshot(runtime.getSnapshot());
    setMode('play');
    lastSnapshotPublishRef.current = 0;

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
  }, [publication]);

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="rounded-[28px] border border-[#d6eec2] bg-white px-8 py-6 text-center shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Friday CodeQuest</p>
          <p className="mt-2 font-display text-3xl text-slate-800">Loading shared game...</p>
        </div>
      </main>
    );
  }

  if (loadError && !publication) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="max-w-xl rounded-[28px] border border-[#ffd7dc] bg-white px-8 py-6 text-center shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-400">Shared Link</p>
          <p className="mt-2 font-display text-3xl text-slate-800">This game is unavailable.</p>
          <p className="mt-3 text-sm font-bold text-slate-500">{loadError}</p>
        </div>
      </main>
    );
  }

  const project = publication?.project || normalizeProjectState(null);
  const title = project.setupData?.idea || project.setupData?.title || 'Shared Friday Game';

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-4 py-6 lg:px-6">
      <section className="quest-card flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-sky-500">Read-Only Share Link</p>
          <h1 className="mt-2 font-display text-4xl leading-none text-slate-900">{title}</h1>
          <p className="mt-3 text-sm font-bold text-slate-500">
            This page runs the published snapshot only. It does not allow editing the original game.
          </p>
        </div>
        <div className="rounded-[22px] border border-[#dbe4ee] bg-[#f8fbff] px-4 py-3 text-sm font-bold text-slate-600">
          Published: {new Date(publication.publishedAt).toLocaleString()}
        </div>
      </section>

      {loadError ? (
        <div className="w-full rounded-full border border-[#ffd7dc] bg-[#fff4f5] px-4 py-2 text-sm font-bold text-rose-600 shadow">
          {loadError}
        </div>
      ) : null}

      <div className="relative h-[calc(100vh-13rem)] min-h-[640px] w-full">
        <GamePreviewCanvas
          mode={mode}
          runtimeSnapshot={runtimeSnapshot}
          initialSceneState={project.scene}
          onPlay={startRuntime}
          onStop={stopRuntime}
          onSpriteClick={(instanceKey) => {
            runtimeRef.current?.dispatch('sprite clicked', { instanceKey });
            runtimeRef.current?.dispatch('object is tapped', { instanceKey });
            if (runtimeRef.current) setRuntimeSnapshot(runtimeRef.current.getSnapshot());
          }}
          showEditToolbar={false}
          showSaveButton={false}
          showTrayToggle={false}
        />
      </div>
    </main>
  );
}
