import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFallbackPlan } from './ai/planning/fallbackPlans';
import {
  createNewProjectState,
  loadProjectState,
  publishSavedProject,
  saveProjectState,
} from './api/projectState';
import SandboxBuilderPage from './components/SandboxBuilderPage';
import GuidedSetupFlow from './components/GuidedSetupFlow';
import SharedGamePage from './components/SharedGamePage';
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

function getSharedPublicationFromPath() {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/play\/gamemakeSession\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return {
    projectId: decodeURIComponent(match[1]),
    shareId: decodeURIComponent(match[2]),
  };
}

export default function App() {
  const sharedPublication = getSharedPublicationFromPath();
  const lastSavedSnapshotRef = useRef('');
  const publishTimeoutRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projectState, setProjectState] = useState(emptyProjectState);
  const [projectPlan, setProjectPlan] = useState(null);
  const [storageError, setStorageError] = useState('');
  const [resumeToken, setResumeToken] = useState(false);
  const [activeScreen, setActiveScreen] = useState('setup');
  const [saveState, setSaveState] = useState('idle');
  const [publishState, setPublishState] = useState('idle');
  const [hasSavedProject, setHasSavedProject] = useState(false);

  useEffect(() => () => {
    if (publishTimeoutRef.current) window.clearTimeout(publishTimeoutRef.current);
  }, []);

  if (sharedPublication) {
    return (
      <SharedGamePage
        projectId={sharedPublication.projectId}
        shareId={sharedPublication.shareId}
      />
    );
  }

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
        setHasSavedProject(Boolean(savedProject));
        setStorageError('');
      })
      .catch((error) => {
        if (cancelled) return;
      })
      .finally(() => {
        if (!cancelled) {
          const nextResumeToken = readResumeBuilderFlag();
          setResumeToken(nextResumeToken);
          setActiveScreen(nextResumeToken ? 'builder' : 'setup');
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

  const hasPersistedProject = useMemo(() => {
    const placedAssets = projectState.scene?.placedAssets || [];
    const scriptsByInstanceKey = projectState.scriptsByInstanceKey || {};
    return Boolean(projectState.setupData)
      || placedAssets.length > 0
      || Object.keys(scriptsByInstanceKey).length > 0
      || Boolean(projectState.scene?.backdropState);
  }, [projectState]);

  useEffect(() => {
    if (isLoading) return;
    if (!hasPersistedProject && resumeToken) {
      writeResumeBuilderFlag(false);
      setResumeToken(false);
      setActiveScreen('setup');
    }
  }, [hasPersistedProject, isLoading, resumeToken]);

  const handleSetupComplete = useCallback((nextSetupData) => {
    writeResumeBuilderFlag(true);
    setResumeToken(true);
    setActiveScreen('builder');
    setProjectState((current) => ({ ...current, setupData: nextSetupData }));
    setProjectPlan(deriveProjectPlan(nextSetupData));
    setSaveState('idle');
  }, []);

  const handleLaunchExample = useCallback(() => {
    handleSetupComplete(createBunnyCarrotExampleProject());
  }, [handleSetupComplete]);

  const handleCreateNewGame = useCallback(() => {
    createNewProjectState();
    writeResumeBuilderFlag(false);
    setResumeToken(false);
    setProjectState(emptyProjectState);
    setProjectPlan(null);
    lastSavedSnapshotRef.current = JSON.stringify(emptyProjectState);
    setSaveState('idle');
    setPublishState('idle');
    setHasSavedProject(false);
    setStorageError('');
    setActiveScreen('setup');
  }, []);

  const handleProjectStateChange = useCallback((nextProjectState) => {
    const normalized = normalizeProjectState(nextProjectState);
    writeResumeBuilderFlag(true);
    setResumeToken(true);
    setActiveScreen('builder');
    setProjectState(normalized);
    setProjectPlan(deriveProjectPlan(normalized.setupData));
  }, []);

  const saveCurrentProject = useCallback(async () => {
    setSaveState('saving');
    const savedProject = await saveProjectState(projectState);
    const normalized = normalizeProjectState(savedProject || projectState);
    setProjectState(normalized);
    setProjectPlan(deriveProjectPlan(normalized.setupData));
    lastSavedSnapshotRef.current = JSON.stringify(normalized);
    setStorageError('');
    setSaveState('saved');
    setHasSavedProject(true);
    return normalized;
  }, [projectState]);

  const handleSaveProject = useCallback(async () => {
    try {
      await saveCurrentProject();
    } catch (error) {
      setSaveState('error');
    }
  }, [saveCurrentProject]);

  const handlePublishProject = useCallback(async () => {
    setPublishState('publishing');
    try {
      await saveCurrentProject();
      const publication = await publishSavedProject();
      const shareUrl = new URL(publication.sharePath, window.location.origin).toString();

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }

      if (publishTimeoutRef.current) window.clearTimeout(publishTimeoutRef.current);
      publishTimeoutRef.current = window.setTimeout(() => setPublishState('idle'), 2500);
      setStorageError('');
      setPublishState('published');
    } catch (error) {
      setSaveState('error');
      setPublishState('error');
    }
  }, [saveCurrentProject]);

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

  if (activeScreen !== 'builder') {
    return (
      <>
        <GuidedSetupFlow onComplete={handleSetupComplete} onLaunchExample={handleLaunchExample} />
      </>
    );
  }

  return (
    <>
      <SandboxBuilderPage
        initialSetupData={projectState.setupData}
        initialProjectState={projectState}
        onProjectStateChange={handleProjectStateChange}
        onSaveProject={handleSaveProject}
        onPublishProject={handlePublishProject}
        saveState={saveState}
        publishState={publishState}
        hasSavedProject={hasSavedProject}
        projectPlan={projectPlan}
        onCreateNewGame={handleCreateNewGame}
      />
    </>
  );
}
