import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Play, Share2, Square } from 'lucide-react';
import GamePreviewCanvas from './GamePreviewCanvas';
import { loadPublishedProject } from '../api/projectState';
import { compileScriptsByInstance } from '../utils/scriptCompiler';
import { createScriptRuntime } from '../utils/scriptRuntime';
import questyImage from '../imgages/profile.png';

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
    plan: projectState?.plan || projectState?.setupData?.plan || null,
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

function SharedTopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#e5e7e5] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3">
          <img
            src={questyImage}
            alt="Questy avatar"
            className="h-10 w-auto rounded-xl object-contain"
          />
          <div>
            <p className="font-display text-[22px] font-bold leading-none tracking-[-0.02em] text-slate-800">CodeQuest</p>
            <p className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Shared Play Mode</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-[#d8e9f7] bg-[#f8fcff] px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#1b97dd]">
            Published Snapshot
          </div>
          <a
            href="/"
            className="duo-btn-green inline-flex items-center gap-2 rounded-2xl px-5 py-2 text-[13px] font-extrabold"
          >
            <ExternalLink className="h-4 w-4" />
            Make Your Own
          </a>
        </div>
      </div>
    </header>
  );
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
      <>
        <SharedTopNav />
        <main className="grid min-h-[calc(100vh-73px)] place-items-center px-6">
          <div className="quest-card w-full max-w-xl border border-[#d6eec2] bg-white px-8 py-8 text-center shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-500">Shared Link</p>
            <p className="mt-3 font-display text-3xl text-slate-800">Loading shared game...</p>
            <p className="mt-3 text-sm font-bold text-slate-500">Fetching the published snapshot and play canvas.</p>
          </div>
        </main>
      </>
    );
  }

  if (loadError && !publication) {
    return (
      <>
        <SharedTopNav />
        <main className="grid min-h-[calc(100vh-73px)] place-items-center px-6">
          <div className="quest-card w-full max-w-xl border border-[#ffd7dc] bg-white px-8 py-8 text-center shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-400">Shared Link</p>
            <p className="mt-3 font-display text-3xl text-slate-800">This game is unavailable.</p>
            <p className="mt-3 text-sm font-bold text-slate-500">{loadError}</p>
          </div>
        </main>
      </>
    );
  }

  const project = publication?.project || normalizeProjectState(null);
  const title = project.setupData?.idea || project.setupData?.title || 'Shared Friday Game';
  const publishedAtText = publication?.publishedAt ? new Date(publication.publishedAt).toLocaleString() : 'Unknown';

  return (
    <>
      <SharedTopNav />
      <main className="min-h-[calc(100vh-73px)] bg-[radial-gradient(circle_at_top_left,rgba(88,204,2,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(28,176,246,0.12),transparent_22%),linear-gradient(180deg,#f8fbff_0%,#f4f5f7_100%)] px-4 py-4 lg:px-6">
        <div className="mx-auto flex max-w-[1920px] flex-col gap-4">
          <section className="quest-card overflow-hidden border border-[#dfe6ee] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-end lg:justify-between lg:px-6">
              <div className="max-w-4xl">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-sky-500">Read-Only Share Link</p>
                <h1 className="mt-2 font-display text-[1.9rem] leading-none tracking-[-0.03em] text-slate-900 lg:text-[2.35rem]">{title}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-[22px] border border-[#dbe4ee] bg-[#f8fbff] px-4 py-3 text-sm font-bold text-slate-600">
                  Published: {publishedAtText}
                </div>
                <div className="rounded-[22px] border border-[#d6eec2] bg-[#f0fbe4] px-4 py-3 text-sm font-bold text-[#3a7d0a]">
                  {mode === 'play' ? 'Game Running' : 'Ready to Play'}
                </div>
              </div>
            </div>

          </section>

          {loadError ? (
            <div className="w-full rounded-full border border-[#ffd7dc] bg-[#fff4f5] px-4 py-2 text-sm font-bold text-rose-600 shadow">
              {loadError}
            </div>
          ) : null}

          <section className="quest-card border border-[#dfe6ee] bg-[#eef3f8] p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] lg:p-4">
            <div className="overflow-hidden rounded-[28px] border border-[#d9e1ea] bg-white shadow-[inset_0_-2px_0_rgba(148,163,184,0.12)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2f7] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-4 py-3 lg:px-5">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8fa0ba]">Game Player</p>
                </div>
                {mode === 'play' ? (
                  <button
                    type="button"
                    onClick={stopRuntime}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-[#1CB0F6] px-4 py-2 text-[12px] font-extrabold text-white shadow-[0_4px_0_#0099E5] transition hover:-translate-y-[1px] hover:bg-[#0099E5]"
                  >
                    <Square className="h-3.5 w-3.5" />
                    Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRuntime}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-[#1CB0F6] px-4 py-2 text-[12px] font-extrabold text-white shadow-[0_4px_0_#0099E5] transition hover:-translate-y-[1px] hover:bg-[#0099E5]"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Play
                  </button>
                )}
              </div>

              <div className="relative h-[calc(100vh-21rem)] min-h-[620px] w-full bg-[#eef3f8]">
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
                  showCanvasControls={false}
                  showSaveButton={false}
                  showTrayToggle={false}
                />
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
