import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFallbackPlan } from './ai/planning/fallbackPlans';
import { loadProjectState, saveProjectState } from './api/projectState';
import SandboxBuilderPage from './components/SandboxBuilderPage';
import GuidedSetupFlow from './components/GuidedSetupFlow';
import { createBunnyCarrotExampleProject } from './data/exampleProjects';

const BUILDER_RESUME_KEY = 'friday-codequest-resume-builder';
const emptyProjectState = {
  setupData: null,
  scene: {
    placedAssets: [],
    selectedPlacedAssetKey: null,
    backdropState: null,
  },
  scriptsByInstanceKey: {},
};

function normalizeProjectState(projectState) {
  return {
    setupData: projectState?.setupData || null,
    scene: {
      ...emptyProjectState.scene,
      ...(projectState?.scene || {}),
    },
    scriptsByInstanceKey: projectState?.scriptsByInstanceKey || {},
  };
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readResumeBuilderFlag() {
  if (!canUseLocalStorage()) return false;
  return window.localStorage.getItem(BUILDER_RESUME_KEY) === 'true';
}

function writeResumeBuilderFlag(value) {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(BUILDER_RESUME_KEY, value ? 'true' : 'false');
}

function deriveProjectPlan(setupData) {
  if (!setupData) return null;
  return setupData.plan || getFallbackPlan(setupData.idea || '', 0);
}

export default function App() {
  const lastSavedSnapshotRef = useRef('');
  const [isLoading, setIsLoading] = useState(true);
  const [projectState, setProjectState] = useState(emptyProjectState);
  const [projectPlan, setProjectPlan] = useState(null);
  const [storageError, setStorageError] = useState('');
  const [shouldResumeBuilder, setShouldResumeBuilder] = useState(false);
  const [saveState, setSaveState] = useState('idle');

  useEffect(() => {
    let cancelled = false;

    loadProjectState()
      .then((savedProject) => {
        if (cancelled) return;
        const normalized = normalizeProjectState(savedProject);
        setProjectState(normalized);
        setProjectPlan(deriveProjectPlan(normalized.setupData));
        lastSavedSnapshotRef.current = JSON.stringify(normalized);
        setSaveState(savedProject ? 'saved' : 'idle');
        setStorageError('');
      })
      .catch((error) => {
        if (cancelled) return;
        setStorageError(error.message || 'Unable to load saved project data.');
      })
      .finally(() => {
        if (!cancelled) {
          setShouldResumeBuilder(readResumeBuilderFlag());
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (JSON.stringify(projectState) !== lastSavedSnapshotRef.current) {
      setSaveState('idle');
    }
  }, [isLoading, projectState]);

  const hasSetupData = useMemo(() => Boolean(projectState.setupData), [projectState.setupData]);
  const hasSavedBuilderState = useMemo(() => {
    const placedAssets = projectState.scene?.placedAssets || [];
    const scriptsByInstanceKey = projectState.scriptsByInstanceKey || {};
    return placedAssets.length > 0 || Object.keys(scriptsByInstanceKey).length > 0 || Boolean(projectState.scene?.backdropState);
  }, [projectState]);
  const shouldOpenBuilder = shouldResumeBuilder || hasSetupData || hasSavedBuilderState;

  const handleSetupComplete = useCallback((nextSetupData) => {
    writeResumeBuilderFlag(true);
    setShouldResumeBuilder(true);
    setProjectState((current) => ({ ...current, setupData: nextSetupData }));
    setProjectPlan(deriveProjectPlan(nextSetupData));
    setSaveState('idle');
  }, []);

  const handleLaunchExample = useCallback(() => {
    handleSetupComplete(createBunnyCarrotExampleProject());
  }, [handleSetupComplete]);

  const handleProjectStateChange = useCallback((nextProjectState) => {
    const normalized = normalizeProjectState(nextProjectState);
    writeResumeBuilderFlag(true);
    setShouldResumeBuilder(true);
    setProjectState(normalized);
    setProjectPlan(deriveProjectPlan(normalized.setupData));
  }, []);

  const handleSaveProject = useCallback(async () => {
    setSaveState('saving');
    try {
      const savedProject = await saveProjectState(projectState);
      const normalized = normalizeProjectState(savedProject || projectState);
      setProjectState(normalized);
      setProjectPlan(deriveProjectPlan(normalized.setupData));
      lastSavedSnapshotRef.current = JSON.stringify(normalized);
      setStorageError('');
      setSaveState('saved');
    } catch (error) {
      setStorageError(error.message || 'Unable to save project data.');
      setSaveState('error');
    }
  }, [projectState]);

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fafafa] px-6">
        <div className="rounded-[28px] border border-[#d6eec2] bg-white px-8 py-6 text-center shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Friday CodeQuest</p>
          <p className="mt-2 font-display text-3xl text-slate-800">Loading saved game...</p>
        </div>
      </main>
    );
  }

  if (!shouldOpenBuilder) {
    return (
      <>
        {storageError ? (
          <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border border-[#ffd7dc] bg-[#fff4f5] px-4 py-2 text-sm font-bold text-rose-600 shadow">
            Storage offline: {storageError}
          </div>
        ) : null}
        <GuidedSetupFlow onComplete={handleSetupComplete} onLaunchExample={handleLaunchExample} />
      </>
    );
  }

  return (
    <>
      {storageError ? (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border border-[#ffd7dc] bg-[#fff4f5] px-4 py-2 text-sm font-bold text-rose-600 shadow">
          Storage offline: {storageError}
        </div>
      ) : null}
      <SandboxBuilderPage
        initialSetupData={projectState.setupData}
        initialProjectState={projectState}
        onProjectStateChange={handleProjectStateChange}
        onSaveProject={handleSaveProject}
        saveState={saveState}
        projectPlan={projectPlan}
      />
    </>
  );
}
