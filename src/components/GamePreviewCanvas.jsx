import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Play, RotateCcw, Save, Shapes, Square, Trash2, Undo2, X } from 'lucide-react';
import { backdropAssets, sandboxAssets } from '../data/sandboxAssets';
import { soundFileByName } from '../data/soundLibrary';

function getVisualAsset(asset, runtimeSnapshot) {
  if (!runtimeSnapshot?.assetsByKey?.[asset.key]) return asset;
  return { ...asset, ...runtimeSnapshot.assetsByKey[asset.key] };
}

function getTransform(asset) {
  const style = asset.rotationStyle || 'dont rotate';
  const parts = [];
  const defaultFacingScaleX = asset.id === 'chicken' ? -1 : 1;
  const runtimeFacingScaleX = asset.facing === -1 ? -1 : 1;

  if (style === 'left-right') {
    parts.push(`scaleX(${defaultFacingScaleX * runtimeFacingScaleX})`);
  } else if (defaultFacingScaleX === -1) {
    parts.push('scaleX(-1)');
  }
  if (style === 'all around') parts.push(`rotate(${asset.rotation || 0}deg)`);
  return parts.join(' ') || 'none';
}

function getOpacity(asset) {
  const invisibility = Math.max(0, Math.min(100, asset.invisibility || 0));
  return 1 - (invisibility / 100);
}

function getUnlockLevelLabel(unlockLevel) {
  const requiredLevel = Math.max(1, Number(unlockLevel) || 1);
  return `Level ${requiredLevel}`;
}

function normalizeSelectionBox(box) {
  if (!box) return null;
  const left = Math.min(box.startX, box.currentX);
  const top = Math.min(box.startY, box.currentY);
  const right = Math.max(box.startX, box.currentX);
  const bottom = Math.max(box.startY, box.currentY);
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function assetIntersectsSelectionBox(asset, selectionBox) {
  if (!selectionBox) return false;
  const frameSize = 180 * (asset.scale || 1);
  const halfSize = frameSize / 2;
  const assetLeft = asset.x - halfSize;
  const assetRight = asset.x + halfSize;
  const assetTop = asset.y - halfSize;
  const assetBottom = asset.y + halfSize;
  return !(
    assetRight < selectionBox.left ||
    assetLeft > selectionBox.right ||
    assetBottom < selectionBox.top ||
    assetTop > selectionBox.bottom
  );
}

function buildSnapshot(placedAssets, selectedPlacedAssetKey, backdropState) {
  return {
    placedAssets: placedAssets.map((item) => ({ ...item })),
    selectedPlacedAssetKey,
    backdropState: backdropState ? { ...backdropState } : null,
  };
}

function normalizeSceneState(sceneState) {
  return {
    placedAssets: Array.isArray(sceneState?.placedAssets) ? sceneState.placedAssets.map((asset) => ({ ...asset })) : [],
    selectedPlacedAssetKey: sceneState?.selectedPlacedAssetKey || null,
    backdropState: sceneState?.backdropState ? { ...sceneState.backdropState } : null,
  };
}

function getBackdropScaleBounds(canvasRect) {
  const width = Math.max(canvasRect?.width || 0, 1);
  const height = Math.max(canvasRect?.height || 0, 1);
  const minScale = Math.max(0.45, 320 / width, 180 / height);
  const maxScale = Math.min(2.25, Math.max(1.4, 1800 / width, 1000 / height));
  return { minScale, maxScale };
}

function clampBackdropState(backdropState, canvasRect) {
  if (!backdropState) return backdropState;
  const bounds = getBackdropScaleBounds(canvasRect);
  const width = canvasRect?.width || 0;
  const height = canvasRect?.height || 0;
  const scale = Math.max(bounds.minScale, Math.min(bounds.maxScale, backdropState.scale || 1));
  const visibleOverflowX = Math.max(0, (width * scale - width) / 2);
  const visibleOverflowY = Math.max(0, (height * scale - height) / 2);
  const dragAllowanceX = width * 0.35;
  const dragAllowanceY = height * 0.35;
  const maxOffsetX = visibleOverflowX + dragAllowanceX;
  const maxOffsetY = visibleOverflowY + dragAllowanceY;
  return {
    ...backdropState,
    scale,
    x: Math.max(-maxOffsetX, Math.min(maxOffsetX, backdropState.x || 0)),
    y: Math.max(-maxOffsetY, Math.min(maxOffsetY, backdropState.y || 0)),
  };
}

function resolveSoundSource(soundName) {
  return soundFileByName[soundName] || soundFileByName[String(soundName || '').replace(/\s+/g, '')] || null;
}

export default function GamePreviewCanvas({
  mode = 'edit',
  runtimeSnapshot,
  initialSceneState,
  availableSpriteAssets = sandboxAssets,
  prioritySpriteAssetIds = [],
  selectedInstanceKey,
  onSceneChange,
  onSelectedInstanceChange,
  onPlay,
  onStop,
  onSave,
  onPublish,
  saveState = 'idle',
  publishState = 'idle',
  onSpriteClick,
  onHistoryStateChange,
  onHistoryAction,
  currentLevel = 1,
  suppressSelectionChrome = false,
  showEditToolbar = true,
  showCanvasControls = true,
  showSaveButton = true,
  showPublishButton = false,
  showTrayToggle = true,
  publishLabel = 'Share',
  undoSignal = 0,
  redoSignal = 0,
}) {
  const canvasRef = useRef(null);
  const backdropRef = useRef(null);
  const controlsRef = useRef(null);
  const trayRef = useRef(null);
  const trayToggleRef = useRef(null);
  const trashZoneRef = useRef(null);
  const moveStartSnapshotRef = useRef(null);
  const movedDuringDragRef = useRef(false);
  const resizeStartRef = useRef(null);
  const resizedDuringDragRef = useRef(false);
  const wheelResizeSnapshotRef = useRef(null);
  const wheelResizeTimeoutRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioBuffersRef = useRef({});
  const audioBufferPromisesRef = useRef({});
  const lastPlayedSoundRef = useRef('');
  const backdropMoveStartRef = useRef(null);
  const backdropMovedDuringDragRef = useRef(false);
  const backdropResizeStartRef = useRef(null);
  const backdropResizedDuringDragRef = useRef(false);
  const suppressNextAssetClickRef = useRef(false);
  const onSceneChangeRef = useRef(onSceneChange);
  const initialSceneRef = useRef(normalizeSceneState(initialSceneState));
  const lastUndoSignalRef = useRef(undoSignal);
  const lastRedoSignalRef = useRef(redoSignal);
  const [trayOpen, setTrayOpen] = useState(false);
  const [trayTab, setTrayTab] = useState('sprites');
  const [placedAssets, setPlacedAssets] = useState(initialSceneRef.current.placedAssets);
  const [selectedPlacedAssetKey, setSelectedPlacedAssetKey] = useState(initialSceneRef.current.selectedPlacedAssetKey);
  const [selectedPlacedAssetKeys, setSelectedPlacedAssetKeys] = useState(
    initialSceneRef.current.selectedPlacedAssetKey ? [initialSceneRef.current.selectedPlacedAssetKey] : []
  );
  const [backdropState, setBackdropState] = useState(initialSceneRef.current.backdropState);
  const [pastStates, setPastStates] = useState([]);
  const [futureStates, setFutureStates] = useState([]);
  const [draggingPlacedAssetKey, setDraggingPlacedAssetKey] = useState(null);
  const [resizingPlacedAssetKey, setResizingPlacedAssetKey] = useState(null);
  const [draggingBackdrop, setDraggingBackdrop] = useState(false);
  const [resizingBackdrop, setResizingBackdrop] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [backdropDragOffset, setBackdropDragOffset] = useState({ x: 0, y: 0 });
  const [trashHover, setTrashHover] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const isEditMode = mode === 'edit';
  const isPlayMode = mode === 'play';
  const prioritySpriteAssetIdSet = useMemo(
    () => new Set(prioritySpriteAssetIds),
    [prioritySpriteAssetIds]
  );

  const trayAssets = useMemo(
    () => (trayTab === 'backdrops' ? backdropAssets : availableSpriteAssets),
    [availableSpriteAssets, trayTab]
  );
  const spriteAssetSections = useMemo(() => {
    const neededAssets = [];
    const extraAssets = [];

    availableSpriteAssets.forEach((asset) => {
      if (prioritySpriteAssetIdSet.has(asset.id)) {
        neededAssets.push(asset);
        return;
      }
      extraAssets.push(asset);
    });

    if (!neededAssets.length) {
      return [{
        id: 'all-assets',
        title: 'Emoji Assets',
        assets: availableSpriteAssets,
      }];
    }

    return [
      {
        id: 'needed-assets',
        title: 'Needed For This Project',
        assets: neededAssets,
      },
      {
        id: 'extra-assets',
        title: 'Extra Emoji Assets',
        assets: extraAssets,
      },
    ].filter((section) => section.assets.length);
  }, [availableSpriteAssets, prioritySpriteAssetIdSet]);
  const selectedPlacedAsset = placedAssets.find((asset) => asset.key === selectedPlacedAssetKey) || null;
  const selectedBackdrop = backdropState
    ? backdropAssets.find((asset) => asset.id === backdropState.id) || null
    : null;

  const ensureAudioReady = () => {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  };

  const loadSoundBuffer = async (soundName) => {
    const sourceUrl = resolveSoundSource(soundName);
    const audioContext = ensureAudioReady();
    if (!sourceUrl || !audioContext) return null;
    if (audioBuffersRef.current[soundName]) return audioBuffersRef.current[soundName];
    if (!audioBufferPromisesRef.current[soundName]) {
      audioBufferPromisesRef.current[soundName] = fetch(sourceUrl)
        .then((response) => response.arrayBuffer())
        .then((buffer) => audioContext.decodeAudioData(buffer.slice(0)))
        .then((decoded) => {
          audioBuffersRef.current[soundName] = decoded;
          return decoded;
        })
        .catch(() => null)
        .finally(() => {
          delete audioBufferPromisesRef.current[soundName];
        });
    }
    return audioBufferPromisesRef.current[soundName];
  };

  const playSoundEffect = async (soundName) => {
    const audioContext = ensureAudioReady();
    if (!audioContext) return;
    const buffer = await loadSoundBuffer(soundName);
    if (!buffer) return;
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    gain.gain.value = 0.6;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(audioContext.destination);
    source.start();
  };

  const updateSelection = (nextKey, nextKeys = nextKey ? [nextKey] : []) => {
    const normalizedKeys = Array.from(new Set(nextKeys.filter(Boolean)));
    setSelectedPlacedAssetKey(nextKey);
    setSelectedPlacedAssetKeys(normalizedKeys);
    onSelectedInstanceChange?.(nextKey);
  };

  useEffect(() => {
    onSceneChangeRef.current = onSceneChange;
  }, [onSceneChange]);

  useEffect(() => {
    if (selectedInstanceKey === undefined) return;
    const normalizedKey = selectedInstanceKey || null;
    setSelectedPlacedAssetKey((current) => (
      current === normalizedKey ? current : normalizedKey
    ));
    setSelectedPlacedAssetKeys((current) => {
      if (!normalizedKey) return [];
      return current.includes(normalizedKey) ? current : [normalizedKey];
    });
  }, [selectedInstanceKey]);

  useEffect(() => {
    onHistoryStateChange?.({
      canUndo: pastStates.length > 0,
      canRedo: futureStates.length > 0,
    });
  }, [futureStates.length, onHistoryStateChange, pastStates.length]);

  useEffect(() => () => {
    if (wheelResizeTimeoutRef.current) {
      clearTimeout(wheelResizeTimeoutRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
  }, []);

  const recordSceneHistory = (snapshot) => {
    setPastStates((prev) => [...prev.slice(-29), snapshot]);
    setFutureStates([]);
    onHistoryAction?.('scene');
  };

  const restoreSceneState = (snapshot) => {
    setPlacedAssets(snapshot.placedAssets);
    updateSelection(snapshot.selectedPlacedAssetKey);
    setBackdropState(snapshot.backdropState);
  };

  useEffect(() => {
    const soundKeys = Object.entries(runtimeSnapshot?.assetsByKey || {})
      .filter(([, asset]) => Boolean(asset.lastSound))
      .map(([key, asset]) => `${key}:${asset.lastSound}:${asset.soundTick || 0}`)
      .join('|');

    if (!soundKeys || soundKeys === lastPlayedSoundRef.current) return;
    lastPlayedSoundRef.current = soundKeys;

    Object.values(runtimeSnapshot?.assetsByKey || {}).forEach((asset) => {
      if (asset.lastSound) {
        playSoundEffect(asset.lastSound);
      }
    });
  }, [runtimeSnapshot]);

  useEffect(() => {
    if (!isEditMode || !trayOpen) return undefined;

    const handleWindowPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (trayRef.current?.contains(target)) return;
      if (trayToggleRef.current?.contains(target)) return;
      setTrayOpen(false);
    };

    window.addEventListener('pointerdown', handleWindowPointerDown, true);
    return () => {
      window.removeEventListener('pointerdown', handleWindowPointerDown, true);
    };
  }, [isEditMode, trayOpen]);

  useEffect(() => {
    if (!isEditMode) return undefined;

    const handleWindowKeyDown = (event) => {
      if ((event.key !== 'Delete' && event.key !== 'Backspace') || !selectedPlacedAssetKeys.length) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (
          target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
        )
      ) {
        return;
      }

      event.preventDefault();
      deletePlacedAssets(selectedPlacedAssetKeys);
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [isEditMode, selectedPlacedAssetKeys, placedAssets, backdropState]);

  useEffect(() => {
    const sceneState = buildSnapshot(placedAssets, selectedPlacedAssetKey, backdropState);
    const currentSelectedBackdrop = backdropState
      ? backdropAssets.find((asset) => asset.id === backdropState.id) || null
      : null;

    onSceneChangeRef.current?.({
      instances: placedAssets,
      selectedInstanceKey: selectedPlacedAssetKey,
      selectedBackdrop: currentSelectedBackdrop ? { ...currentSelectedBackdrop, ...backdropState } : null,
      sceneState,
    });
  }, [backdropState, placedAssets, selectedPlacedAssetKey]);

  const onAssetDragStart = (e, asset, kind = 'sprite') => {
    if (!isEditMode) return;
    e.dataTransfer.setData('application/json', JSON.stringify({ kind, asset }));
    e.dataTransfer.effectAllowed = 'copy';

    const ghost = document.createElement('div');
    ghost.style.position = 'absolute';
    ghost.style.top = '-9999px';
    ghost.style.left = '-9999px';
    ghost.style.display = 'grid';
    ghost.style.placeItems = 'center';
    ghost.style.borderRadius = '20px';
    ghost.style.overflow = 'hidden';
    ghost.style.boxShadow = '0 12px 28px rgba(15, 23, 42, 0.18)';

    if (kind === 'backdrop') {
      ghost.style.width = '120px';
      ghost.style.height = '72px';
      ghost.style.border = '2px solid #d7dde4';
      ghost.style.backgroundImage = `url(${asset.src})`;
      ghost.style.backgroundSize = 'cover';
      ghost.style.backgroundPosition = 'center';
    } else {
      ghost.textContent = asset.emoji;
      ghost.style.width = '96px';
      ghost.style.height = '96px';
      ghost.style.background = '#ffffff';
      ghost.style.fontSize = '64px';
      ghost.style.transform = getTransform(asset);
    }

    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, kind === 'backdrop' ? 60 : 48, kind === 'backdrop' ? 36 : 48);
    requestAnimationFrame(() => document.body.removeChild(ghost));
  };

  const applyBackdrop = (backdrop) => {
    const snapshot = buildSnapshot(placedAssets, selectedPlacedAssetKey, backdropState);
    recordSceneHistory(snapshot);
    setBackdropState(clampBackdropState({
      id: backdrop.id,
      x: 0,
      y: 0,
      scale: 1,
      locked: false,
    }, canvasRef.current?.getBoundingClientRect()));
    updateSelection(null);
  };

  const addSpriteAssetToCanvas = (asset) => {
    if (!isEditMode) return;
    const unlockLevel = asset.unlockLevel || 1;
    if (unlockLevel > currentLevel) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    const canvasWidth = rect?.width || 960;
    const canvasHeight = rect?.height || 640;
    const initialScale = 1;
    const halfSize = 90 * initialScale;
    const existingCount = placedAssets.filter((placed) => placed.id === asset.id).length;
    const spreadOffset = (existingCount % 4) * 28;
    const x = Math.max(halfSize, Math.min((canvasWidth / 2) + spreadOffset, canvasWidth - halfSize));
    const y = Math.max(70 + halfSize, Math.min((canvasHeight / 2) + spreadOffset, canvasHeight - halfSize));
    const placed = {
      ...asset,
      x,
      y,
      scale: initialScale,
      rotation: 0,
      key: `${asset.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };

    const snapshot = buildSnapshot(placedAssets, selectedPlacedAssetKey, backdropState);
    recordSceneHistory(snapshot);
    setPlacedAssets((prev) => [...prev, placed]);
    updateSelection(placed.key);
  };

  const renderSpriteAssetCard = (asset) => {
    const isExtraAsset = prioritySpriteAssetIdSet.size > 0 && !prioritySpriteAssetIdSet.has(asset.id);
    const isUnlocked = (asset.unlockLevel || 1) <= currentLevel;
    const isEnabled = isUnlocked;

    return (
      <button
        type="button"
        key={asset.id}
        draggable={isEnabled}
        onDragStart={isEnabled ? (e) => onAssetDragStart(e, asset, 'sprite') : undefined}
        onClick={() => addSpriteAssetToCanvas(asset)}
        className={`relative rounded-[24px] border-2 p-3 text-center shadow-[inset_0_-3px_0_rgba(148,163,184,0.2)] transition ${
          isEnabled
            ? 'cursor-grab border-[#d5dbe3] bg-[#f7f9fc] hover:border-[#9fd7f7] hover:bg-[#eaf6ff] active:cursor-grabbing'
            : 'cursor-not-allowed border-[#d9dbe0] bg-[#eef0f3] opacity-65 grayscale'
        }`}
        title={
          isUnlocked
            ? (isExtraAsset ? `${asset.label} is unlocked and optional for this project` : asset.label)
            : `Unlocks at ${getUnlockLevelLabel(asset.unlockLevel)}`
        }
      >
        <div className="text-3xl" style={{ transform: getTransform(asset) }}>{asset.emoji}</div>
        <div className="mt-1 text-sm font-extrabold text-[#475569]">{asset.label}</div>
        {(asset.unlockLevel || 1) > currentLevel ? (
          <div className="mt-2 inline-flex max-w-full items-center rounded-full border border-[#d4d8de] bg-white/90 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7b8794] shadow-[0_2px_0_rgba(148,163,184,0.12)]">
            🔒 {getUnlockLevelLabel(asset.unlockLevel)}
          </div>
        ) : null}
      </button>
    );
  };

  const onCanvasDrop = (e) => {
    if (!isEditMode) return;
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw || !canvasRef.current) return;

    try {
      const payload = JSON.parse(raw);
      if (payload?.kind === 'backdrop' && payload.asset) {
        if (payload.asset.id !== backdropState?.id) applyBackdrop(payload.asset);
        return;
      }
      if (payload?.kind !== 'sprite' || !payload.asset) return;

      const asset = payload.asset;
      const rect = canvasRef.current.getBoundingClientRect();
      const initialScale = 1;
      const halfSize = 90 * initialScale;
      const x = Math.max(halfSize, Math.min(e.clientX - rect.left, rect.width - halfSize));
      const y = Math.max(70 + halfSize, Math.min(e.clientY - rect.top, rect.height - halfSize));
      const placed = {
        ...asset,
        x,
        y,
        scale: initialScale,
        rotation: 0,
        key: `${asset.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };
      const snapshot = buildSnapshot(placedAssets, selectedPlacedAssetKey, backdropState);
      recordSceneHistory(snapshot);
      setPlacedAssets((prev) => [...prev, placed]);
      updateSelection(placed.key);
    } catch {
      // ignore malformed drag payload
    }
  };

  const handleUndo = () => {
    if (!isEditMode || !pastStates.length) return;
    const currentSnapshot = buildSnapshot(placedAssets, selectedPlacedAssetKey, backdropState);
    const previous = pastStates[pastStates.length - 1];
    setPastStates((prev) => prev.slice(0, -1));
    setFutureStates((prev) => [...prev, currentSnapshot]);
    restoreSceneState(previous);
  };

  const handleRedo = () => {
    if (!isEditMode || !futureStates.length) return;
    const currentSnapshot = buildSnapshot(placedAssets, selectedPlacedAssetKey, backdropState);
    const next = futureStates[futureStates.length - 1];
    setFutureStates((prev) => prev.slice(0, -1));
    setPastStates((prev) => [...prev.slice(-29), currentSnapshot]);
    restoreSceneState(next);
  };

  const handleRestart = () => {
    if (!isEditMode || (!placedAssets.length && !backdropState)) return;
    const snapshot = buildSnapshot(placedAssets, selectedPlacedAssetKey, backdropState);
    recordSceneHistory(snapshot);
    setPlacedAssets([]);
    updateSelection(null);
    setBackdropState(null);
    setDraggingPlacedAssetKey(null);
    setResizingPlacedAssetKey(null);
    setDraggingBackdrop(false);
    setResizingBackdrop(false);
    setTrashHover(false);
    moveStartSnapshotRef.current = null;
    resizeStartRef.current = null;
    backdropMoveStartRef.current = null;
    backdropResizeStartRef.current = null;
    movedDuringDragRef.current = false;
    resizedDuringDragRef.current = false;
    backdropMovedDuringDragRef.current = false;
    backdropResizedDuringDragRef.current = false;
  };

  const isPointerOverTrash = (clientX, clientY) => {
    const rect = trashZoneRef.current?.getBoundingClientRect();
    if (!rect) return false;
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  };

  const deletePlacedAssets = (assetKeys) => {
    const keysToDelete = Array.from(new Set((assetKeys || []).filter(Boolean)));
    if (!keysToDelete.length) return;
    const snapshot = buildSnapshot(placedAssets, selectedPlacedAssetKey, backdropState);
    recordSceneHistory(snapshot);
    setPlacedAssets((prev) => prev.filter((asset) => !keysToDelete.includes(asset.key)));
    const remainingSelectedKeys = selectedPlacedAssetKeys.filter((key) => !keysToDelete.includes(key));
    const nextPrimary = remainingSelectedKeys.includes(selectedPlacedAssetKey)
      ? selectedPlacedAssetKey
      : (remainingSelectedKeys[remainingSelectedKeys.length - 1] || null);
    updateSelection(nextPrimary, remainingSelectedKeys);
  };

  const deletePlacedAsset = (assetKey) => {
    deletePlacedAssets([assetKey]);
  };

  const handleAssetSelection = (event, assetKey) => {
    if (!isEditMode) return;

    if (!(event.shiftKey || event.metaKey || event.ctrlKey)) {
      updateSelection(assetKey);
      return;
    }

    if (selectedPlacedAssetKeys.includes(assetKey)) {
      const remainingKeys = selectedPlacedAssetKeys.filter((key) => key !== assetKey);
      const nextPrimary = selectedPlacedAssetKey === assetKey
        ? (remainingKeys[remainingKeys.length - 1] || null)
        : selectedPlacedAssetKey;
      updateSelection(nextPrimary, remainingKeys);
      return;
    }

    updateSelection(assetKey, [...selectedPlacedAssetKeys, assetKey]);
  };

  const handlePlacedAssetPointerDown = (e, asset) => {
    if (!isEditMode || !canvasRef.current) return;
    e.stopPropagation();

    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      handleAssetSelection(e, asset.key);
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    updateSelection(asset.key);
    setDraggingPlacedAssetKey(asset.key);
    setDragOffset({ x: e.clientX - rect.left - asset.x, y: e.clientY - rect.top - asset.y });
    moveStartSnapshotRef.current = buildSnapshot(placedAssets, selectedPlacedAssetKey, backdropState);
    movedDuringDragRef.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleBackdropPointerDown = (e) => {
    if (!isEditMode || !canvasRef.current || !backdropState || backdropState.locked) return;
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    setDraggingBackdrop(true);
    setBackdropDragOffset({
      x: e.clientX - rect.left - backdropState.x,
      y: e.clientY - rect.top - backdropState.y,
    });
    backdropMoveStartRef.current = buildSnapshot(placedAssets, selectedPlacedAssetKey, backdropState);
    backdropMovedDuringDragRef.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const lockBackdropEditing = () => {
    if (!backdropState || backdropState.locked) return;
    const snapshot = buildSnapshot(placedAssets, selectedPlacedAssetKey, backdropState);
    setPastStates((prev) => [...prev, snapshot]);
    setBackdropState((prev) => (prev ? {
      ...clampBackdropState(prev, canvasRef.current?.getBoundingClientRect()),
      locked: true,
    } : prev));
  };

  const getSafeDraggedPosition = (nextX, nextY, frameHalf, canvasRect) => {
    const controlsRect = controlsRef.current?.getBoundingClientRect();
    if (!controlsRect) return { x: nextX, y: nextY };

    const margin = 14;
    const protectedZone = {
      left: Math.max(0, controlsRect.left - canvasRect.left - margin),
      right: Math.min(canvasRect.width, controlsRect.right - canvasRect.left + margin),
      top: Math.max(0, controlsRect.top - canvasRect.top - margin),
      bottom: Math.min(canvasRect.height, controlsRect.bottom - canvasRect.top + margin),
    };

    const overlapsControls = !(
      nextX + frameHalf < protectedZone.left ||
      nextX - frameHalf > protectedZone.right ||
      nextY + frameHalf < protectedZone.top ||
      nextY - frameHalf > protectedZone.bottom
    );

    if (!overlapsControls) return { x: nextX, y: nextY };

    const leftCandidateX = protectedZone.left - frameHalf - margin;
    if (leftCandidateX >= frameHalf) {
      return { x: leftCandidateX, y: nextY };
    }

    const belowCandidateY = protectedZone.bottom + frameHalf + margin;
    if (belowCandidateY <= canvasRect.height - frameHalf) {
      return { x: nextX, y: belowCandidateY };
    }

    return {
      x: nextX,
      y: Math.max(frameHalf, protectedZone.top - frameHalf - margin),
    };
  };

  const handleCanvasPointerMove = (e) => {
    if (!canvasRef.current || !isEditMode) return;

    if (selectionBox) {
      const rect = canvasRef.current.getBoundingClientRect();
      setSelectionBox((current) => (current ? {
        ...current,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
      } : current));
      return;
    }

    if (resizingBackdrop && backdropResizeStartRef.current && backdropState) {
      const start = backdropResizeStartRef.current;
      const bounds = getBackdropScaleBounds(canvasRef.current.getBoundingClientRect());
      const deltaX = e.clientX - start.pointerX;
      const deltaY = e.clientY - start.pointerY;
      const resizeDelta = ((start.directionX * deltaX) + (start.directionY * deltaY)) / 320;
      const nextScale = Math.max(bounds.minScale, Math.min(bounds.maxScale, Math.round((start.scale + resizeDelta) * 100) / 100));
      setBackdropState((prev) => (prev ? clampBackdropState({ ...prev, scale: nextScale }, canvasRef.current?.getBoundingClientRect()) : prev));
      backdropResizedDuringDragRef.current = true;
      return;
    }

    if (draggingBackdrop && backdropState) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - backdropDragOffset.x;
      const y = e.clientY - rect.top - backdropDragOffset.y;
      setBackdropState((prev) => (prev ? clampBackdropState({ ...prev, x, y }, canvasRef.current?.getBoundingClientRect()) : prev));
      backdropMovedDuringDragRef.current = true;
      return;
    }

    if (resizingPlacedAssetKey && resizeStartRef.current) {
      const start = resizeStartRef.current;
      const deltaX = e.clientX - start.pointerX;
      const deltaY = e.clientY - start.pointerY;
      const projectedDelta = ((deltaX * start.directionX) + (deltaY * start.directionY)) / 2;
      const nextScale = Math.max(0.6, Math.min(1.8, Math.round((start.scale + projectedDelta / 220) * 10) / 10));
      setPlacedAssets((prev) => prev.map((asset) => (
        asset.key !== resizingPlacedAssetKey ? asset : { ...asset, scale: nextScale }
      )));
      resizedDuringDragRef.current = true;
      return;
    }

    if (!draggingPlacedAssetKey) return;
    const draggingAsset = placedAssets.find((asset) => asset.key === draggingPlacedAssetKey);
    if (!draggingAsset) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const frameHalf = 90 * (draggingAsset.scale || 1);
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;
    const clampedX = Math.max(frameHalf, Math.min(pointerX - dragOffset.x, rect.width - frameHalf));
    const clampedY = Math.max(frameHalf, Math.min(pointerY - dragOffset.y, rect.height - frameHalf));
    const { x, y } = getSafeDraggedPosition(clampedX, clampedY, frameHalf, rect);
    setPlacedAssets((prev) => prev.map((asset) => (
      asset.key !== draggingPlacedAssetKey ? asset : { ...asset, x, y }
    )));
    movedDuringDragRef.current = true;
    setTrashHover(isPointerOverTrash(e.clientX, e.clientY));
  };

  const handleCanvasPointerUp = (e) => {
    if (!isEditMode) return;

    if (selectionBox) {
      const normalizedBox = normalizeSelectionBox(selectionBox);
      const hasDragArea = normalizedBox && (normalizedBox.width > 6 || normalizedBox.height > 6);
      if (hasDragArea) {
        const selectedKeys = placedAssets
          .filter((asset) => assetIntersectsSelectionBox(asset, normalizedBox))
          .map((asset) => asset.key);
        const primaryKey = selectedKeys[selectedKeys.length - 1] || null;
        updateSelection(primaryKey, selectedKeys);
        suppressNextAssetClickRef.current = true;
      } else if (e?.target === canvasRef.current) {
        updateSelection(null, []);
      }
      setSelectionBox(null);
      return;
    }

    if (draggingBackdrop) {
      if (backdropMovedDuringDragRef.current && backdropMoveStartRef.current) {
        recordSceneHistory(backdropMoveStartRef.current);
      }
      setDraggingBackdrop(false);
      backdropMoveStartRef.current = null;
      backdropMovedDuringDragRef.current = false;
    }

    if (resizingBackdrop) {
      if (backdropResizedDuringDragRef.current && backdropResizeStartRef.current?.snapshot) {
        recordSceneHistory(backdropResizeStartRef.current.snapshot);
      }
      setResizingBackdrop(false);
      backdropResizeStartRef.current = null;
      backdropResizedDuringDragRef.current = false;
    }

    if (draggingPlacedAssetKey) {
      const shouldDelete = Boolean(e) && isPointerOverTrash(e.clientX, e.clientY);
      if (shouldDelete) {
        deletePlacedAsset(draggingPlacedAssetKey);
      } else if (movedDuringDragRef.current && moveStartSnapshotRef.current) {
        recordSceneHistory(moveStartSnapshotRef.current);
      }
      setDraggingPlacedAssetKey(null);
      setTrashHover(false);
      moveStartSnapshotRef.current = null;
      movedDuringDragRef.current = false;
    }

    if (resizingPlacedAssetKey) {
      if (resizedDuringDragRef.current && resizeStartRef.current?.snapshot) {
        recordSceneHistory(resizeStartRef.current.snapshot);
      }
      setResizingPlacedAssetKey(null);
      resizeStartRef.current = null;
      resizedDuringDragRef.current = false;
    }
  };

  const handleResizeHandlePointerDown = (e, asset, directionX, directionY) => {
    if (!isEditMode) return;
    e.stopPropagation();
    updateSelection(asset.key);
    setResizingPlacedAssetKey(asset.key);
    resizeStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      directionX,
      directionY,
      scale: asset.scale || 1,
      snapshot: buildSnapshot(placedAssets, asset.key, backdropState),
    };
    resizedDuringDragRef.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleBackdropResizePointerDown = (e) => {
    if (!isEditMode || !backdropState || backdropState.locked) return;
    e.stopPropagation();
    setResizingBackdrop(true);
    backdropResizeStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      scale: backdropState.scale || 1,
      directionX: Number(e.currentTarget.dataset.directionX || 1),
      directionY: Number(e.currentTarget.dataset.directionY || 1),
      snapshot: buildSnapshot(placedAssets, selectedPlacedAssetKey, backdropState),
    };
    backdropResizedDuringDragRef.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    if (!isEditMode || (!draggingBackdrop && !resizingBackdrop && !selectionBox)) return undefined;
    const onWindowPointerMove = (event) => handleCanvasPointerMove(event);
    const onWindowPointerUp = (event) => handleCanvasPointerUp(event);
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
    };
  }, [draggingBackdrop, isEditMode, resizingBackdrop, selectionBox]);

  useEffect(() => {
    if (!isEditMode || !backdropState || backdropState.locked || draggingBackdrop || resizingBackdrop) return undefined;
    const onWindowPointerDown = (event) => {
      if (backdropRef.current?.contains(event.target)) return;
      lockBackdropEditing();
    };
    window.addEventListener('pointerdown', onWindowPointerDown, true);
    return () => {
      window.removeEventListener('pointerdown', onWindowPointerDown, true);
    };
  }, [backdropState, draggingBackdrop, isEditMode, resizingBackdrop]);

  const handleSelectedAssetWheel = (e, asset) => {
    if (!isEditMode) return;
    e.preventDefault();
    if (!wheelResizeSnapshotRef.current) {
      wheelResizeSnapshotRef.current = buildSnapshot(placedAssets, asset.key, backdropState);
      recordSceneHistory(wheelResizeSnapshotRef.current);
    }

    setPlacedAssets((prev) => prev.map((item) => {
      if (item.key !== asset.key) return item;
      const currentScale = item.scale || 1;
      const nextScale = Math.max(0.6, Math.min(1.8, Math.round((currentScale + (e.deltaY < 0 ? 0.1 : -0.1)) * 10) / 10));
      return nextScale === currentScale ? item : { ...item, scale: nextScale };
    }));

    if (wheelResizeTimeoutRef.current) {
      clearTimeout(wheelResizeTimeoutRef.current);
    }
    wheelResizeTimeoutRef.current = setTimeout(() => {
      wheelResizeSnapshotRef.current = null;
      wheelResizeTimeoutRef.current = null;
    }, 180);
  };

  useEffect(() => {
    if (undoSignal === lastUndoSignalRef.current) return;
    lastUndoSignalRef.current = undoSignal;
    handleUndo();
  }, [undoSignal]);

  useEffect(() => {
    if (redoSignal === lastRedoSignalRef.current) return;
    lastRedoSignalRef.current = redoSignal;
    handleRedo();
  }, [redoSignal]);

  const visibleAssets = placedAssets.map((asset) => getVisualAsset(asset, runtimeSnapshot));
  const showSelectionChrome = isEditMode && !suppressSelectionChrome;
  const normalizedSelectionBox = normalizeSelectionBox(selectionBox);
  const backdropTransform = backdropState
    ? `translate(${backdropState.x}px, ${backdropState.y}px) scale(${backdropState.scale})`
    : 'none';
  const saveLabel = saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save';
  const resolvedPublishLabel = publishState === 'publishing' ? 'Sharing...' : publishState === 'published' ? 'Copied' : publishLabel;

  const startSelectionBox = (event) => {
    if (!isEditMode || !canvasRef.current) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (controlsRef.current?.contains(target)) return;
    if (trayRef.current?.contains(target)) return;
    if (trayToggleRef.current?.contains(target)) return;
    if (target.closest('[data-canvas-asset="true"]')) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const startX = event.clientX - rect.left;
    const startY = event.clientY - rect.top;
    setSelectionBox({
      startX,
      startY,
      currentX: startX,
      currentY: startY,
    });
  };

  return (
    <section
      ref={canvasRef}
      data-sandbox-canvas-root="true"
      className="relative h-full select-none overflow-hidden rounded-[28px] border border-duo-line bg-[#ece7d2]"
      onPointerDown={startSelectionBox}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerCancel={handleCanvasPointerUp}
      onLostPointerCapture={handleCanvasPointerUp}
      onDragOver={(e) => isEditMode && e.preventDefault()}
      onDrop={onCanvasDrop}
    >
      <style>{`
        @keyframes cq-bottom-drawer-in {
          0% {
            opacity: 0;
            transform: translateY(32px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      {selectedBackdrop ? (
        <div
          ref={backdropRef}
          className={`absolute left-1/2 top-1/2 z-0 aspect-[16/9] w-full max-w-none -translate-x-1/2 -translate-y-1/2 ${isEditMode && !backdropState?.locked ? 'cursor-grab' : ''} ${draggingBackdrop ? 'cursor-grabbing' : ''}`}
          style={{ transform: `translate(-50%, -50%) ${backdropTransform}` }}
          onPointerDown={handleBackdropPointerDown}
          onClick={(e) => {
            if (!isEditMode) return;
            if (e.target instanceof HTMLElement && e.target.closest('button')) return;
            updateSelection(null);
          }}
        >
          <img src={selectedBackdrop.src} alt={selectedBackdrop.label} className="h-full w-full select-none object-cover" draggable={false} onDragStart={(e) => e.preventDefault()} />
          {isEditMode && backdropState && !backdropState.locked ? (
            <>
              <div className="pointer-events-none absolute inset-0 border-[3px] border-[#19a2ff]" />
              <button type="button" onPointerDown={handleBackdropResizePointerDown} data-direction-x="-1" data-direction-y="-1" className="absolute -left-[7px] -top-[7px] z-10 h-[14px] w-[14px] cursor-nwse-resize border-2 border-[#19a2ff] bg-white" aria-label="Resize backdrop" />
              <button type="button" onPointerDown={handleBackdropResizePointerDown} data-direction-x="1" data-direction-y="-1" className="absolute -right-[7px] -top-[7px] z-10 h-[14px] w-[14px] cursor-nesw-resize border-2 border-[#19a2ff] bg-white" aria-label="Resize backdrop" />
              <button type="button" onPointerDown={handleBackdropResizePointerDown} data-direction-x="-1" data-direction-y="1" className="absolute -bottom-[7px] -left-[7px] z-10 h-[14px] w-[14px] cursor-nesw-resize border-2 border-[#19a2ff] bg-white" aria-label="Resize backdrop" />
              <button type="button" onPointerDown={handleBackdropResizePointerDown} data-direction-x="1" data-direction-y="1" className="absolute -bottom-[7px] -right-[7px] z-10 h-[14px] w-[14px] cursor-nwse-resize border-2 border-[#19a2ff] bg-white" aria-label="Resize backdrop" />
            </>
          ) : null}
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.24),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.2),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.45)_1px,transparent_1px)] bg-[size:48px_48px] opacity-60" />
      {normalizedSelectionBox ? (
        <div
          className="pointer-events-none absolute z-20 border-2 border-[#1CB0F6] bg-[#1CB0F6]/15"
          style={{
            left: normalizedSelectionBox.left,
            top: normalizedSelectionBox.top,
            width: normalizedSelectionBox.width,
            height: normalizedSelectionBox.height,
          }}
        />
      ) : null}

      {showCanvasControls ? (
        <div ref={controlsRef} className={`absolute right-4 top-4 z-10 flex items-center gap-2 ${draggingPlacedAssetKey ? 'pointer-events-none' : ''}`}>
          {showEditToolbar ? (
            <>
              <button type="button" onClick={handleUndo} disabled={!isEditMode || !pastStates.length} className="grid h-14 w-14 place-items-center rounded-full bg-[#6f6f6f] text-white shadow disabled:cursor-not-allowed disabled:opacity-45"><Undo2 size={24} /></button>
              <button type="button" onClick={handleRestart} disabled={!isEditMode || (!placedAssets.length && !backdropState)} className="grid h-14 w-14 place-items-center rounded-full bg-[#a5a5a5] text-white shadow disabled:cursor-not-allowed disabled:opacity-45"><RotateCcw size={24} /></button>
            </>
          ) : null}
          {showSaveButton ? (
            <button type="button" onClick={onSave} disabled={saveState === 'saving'} className="duo-btn-blue inline-flex items-center gap-2 rounded-full px-7 py-3 text-3xl disabled:cursor-not-allowed disabled:opacity-70">
              <Save size={24} />
              {saveLabel}
            </button>
          ) : null}
          {showPublishButton ? (
            <button type="button" onClick={onPublish} disabled={publishState === 'publishing'} className="duo-btn-green inline-flex items-center gap-2 rounded-full px-7 py-3 text-3xl disabled:cursor-not-allowed disabled:opacity-70">
              <Shapes size={24} />
              {resolvedPublishLabel}
            </button>
          ) : null}
          {isPlayMode ? <button onClick={onStop} className="duo-btn-blue inline-flex items-center gap-2 rounded-full px-7 py-3 text-3xl"><Square size={24} />Stop</button> : <button onClick={() => {
            ensureAudioReady();
            onPlay?.();
          }} className="duo-btn-blue inline-flex items-center gap-2 rounded-full px-7 py-3 text-3xl"><Play size={24} />Play</button>}
        </div>
      ) : null}

      {isPlayMode ? <div className="absolute left-4 top-4 z-10 rounded-2xl border border-[#d3dae3] bg-white/90 px-4 py-2 text-sm font-extrabold text-slate-700 shadow">Timer: {Math.ceil(runtimeSnapshot?.variables?.time ?? 0)}s | Score: {Math.round(runtimeSnapshot?.variables?.score ?? 0)}</div> : null}

      {visibleAssets.map((asset) => {
        const isSelected = selectedPlacedAssetKeys.includes(asset.key);
        const scale = asset.scale || 1;
        const frameSize = 180 * scale;
        const emojiSize = 96 * scale;
        return (
          <div
            key={asset.key}
            data-canvas-asset="true"
            className={`absolute -translate-x-1/2 -translate-y-1/2 touch-none select-none ${isEditMode && draggingPlacedAssetKey === asset.key ? 'z-40 cursor-grabbing' : 'z-20'} ${isEditMode && draggingPlacedAssetKey !== asset.key ? 'cursor-grab' : isPlayMode ? 'cursor-pointer' : ''}`}
            style={{ left: asset.x, top: asset.y, width: frameSize, height: frameSize, opacity: getOpacity(asset) }}
            title={asset.label}
            onClick={(e) => {
              e.stopPropagation();
              if (suppressNextAssetClickRef.current) {
                suppressNextAssetClickRef.current = false;
                return;
              }
              if (isEditMode) handleAssetSelection(e, asset.key);
              if (isPlayMode) onSpriteClick?.(asset.key);
            }}
            onPointerDown={(e) => handlePlacedAssetPointerDown(e, asset)}
            onWheel={selectedPlacedAssetKey === asset.key ? (e) => handleSelectedAssetWheel(e, asset) : undefined}
          >
            {asset.speechText ? (
              <div className="pointer-events-none absolute -top-10 left-1/2 z-30 w-max max-w-[220px] -translate-x-1/2">
                <div className="relative rounded-[22px] border-2 border-[#d8dfeb] bg-white px-5 py-3 text-center text-[17px] font-black leading-tight text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.14)]">
                  {asset.speechText}
                  <div className="absolute left-1/2 top-full h-4 w-4 -translate-x-1/2 -translate-y-[55%] rotate-45 border-b-2 border-r-2 border-[#d8dfeb] bg-white" />
                </div>
              </div>
            ) : null}
            {isSelected && showSelectionChrome ? (
              <>
                <div className="pointer-events-none absolute inset-0 rounded-[2px] border-[3px] border-[#19a2ff]" />
                <div className="absolute -left-[7px] -top-[7px] h-[14px] w-[14px] cursor-nwse-resize border-2 border-[#19a2ff] bg-white" onPointerDown={(e) => handleResizeHandlePointerDown(e, asset, -1, -1)} />
                <div className="absolute -right-[7px] -top-[7px] h-[14px] w-[14px] cursor-nesw-resize border-2 border-[#19a2ff] bg-white" onPointerDown={(e) => handleResizeHandlePointerDown(e, asset, 1, -1)} />
                <div className="absolute -bottom-[7px] -left-[7px] h-[14px] w-[14px] cursor-nesw-resize border-2 border-[#19a2ff] bg-white" onPointerDown={(e) => handleResizeHandlePointerDown(e, asset, -1, 1)} />
                <div className="absolute -bottom-[7px] -right-[7px] h-[14px] w-[14px] cursor-nwse-resize border-2 border-[#19a2ff] bg-white" onPointerDown={(e) => handleResizeHandlePointerDown(e, asset, 1, 1)} />
              </>
            ) : null}
            <div className="grid h-full w-full place-items-center bg-transparent leading-none select-none" style={{ fontSize: emojiSize, transform: getTransform(asset) }}>{asset.emoji}</div>
          </div>
        );
      })}

      {showSelectionChrome && selectedPlacedAssetKeys.length > 1 ? (
        <div className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-[20px] border border-duo-line bg-white px-4 py-2 shadow">
          <div className="flex items-center gap-3 text-xl font-bold text-slate-800">
            <span className="rounded-xl bg-slate-100 px-2 py-1">◻</span>
            {selectedPlacedAssetKeys.length} assets selected
          </div>
        </div>
      ) : selectedPlacedAsset && showSelectionChrome ? (
        <div className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-[20px] border border-duo-line bg-white px-4 py-2 shadow">
          <div className="flex items-center gap-3 text-2xl font-bold text-slate-800"><span className="rounded-xl bg-slate-100 px-2 py-1">{selectedPlacedAsset.emoji}</span>{selectedPlacedAsset.label}</div>
        </div>
      ) : null}
      {showTrayToggle && isEditMode && !draggingPlacedAssetKey && !trayOpen ? <button ref={trayToggleRef} onClick={() => setTrayOpen(true)} className="absolute bottom-4 left-1/2 z-20 grid h-16 w-16 -translate-x-1/2 place-items-center rounded-full border-b-4 border-[#666a65] bg-[#7f827c] text-5xl font-display text-white shadow">+</button> : null}

      {trayOpen && isEditMode ? (
        <div
          ref={trayRef}
          className="absolute inset-x-4 bottom-4 z-20 flex h-[42%] min-h-[280px] max-h-[420px] flex-col overflow-hidden rounded-[30px] border-2 border-[#d7dde4] bg-white px-5 py-4 shadow-[0_8px_0_rgba(148,163,184,0.22)]"
          style={{ animation: 'cq-bottom-drawer-in 220ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-[#64748b]">Drag Assets Into The Sandbox</p>
              {trayTab === 'backdrops' ? (
                <p className="mt-1 text-sm font-bold text-slate-500">Pick a backdrop, adjust it once, then lock it into place.</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-[22px] border-2 border-[#d7dde4] bg-[#f8fafc] p-1 shadow-[inset_0_-2px_0_rgba(148,163,184,0.12)]">
                <button type="button" onClick={() => setTrayTab('sprites')} className={`inline-flex items-center gap-2 rounded-[16px] px-4 py-2 text-sm font-extrabold transition ${trayTab === 'sprites' ? 'bg-white text-[#0d76ab] shadow-[0_3px_0_rgba(148,163,184,0.18)]' : 'text-slate-500 hover:text-slate-700'}`}><Shapes size={16} />Emoji Assets</button>
                <button type="button" onClick={() => setTrayTab('backdrops')} className={`inline-flex items-center gap-2 rounded-[16px] px-4 py-2 text-sm font-extrabold transition ${trayTab === 'backdrops' ? 'bg-white text-[#0d76ab] shadow-[0_3px_0_rgba(148,163,184,0.18)]' : 'text-slate-500 hover:text-slate-700'}`}><Image size={16} />Backdrop Assets</button>
              </div>
              <button
                type="button"
                onClick={() => setTrayOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#d7dde4] bg-white text-slate-500 shadow-[0_3px_0_rgba(148,163,184,0.14)] transition hover:bg-slate-50"
                aria-label="Close assets drawer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
          {trayTab === 'backdrops' ? (
            <div className="h-full overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
                {trayAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    draggable={(asset.unlockLevel || 1) <= currentLevel}
                    onDragStart={(e) => onAssetDragStart(e, asset, 'backdrop')}
                    onClick={() => {
                      if ((asset.unlockLevel || 1) > currentLevel) return;
                      applyBackdrop(asset);
                    }}
                    className={`relative overflow-hidden rounded-[24px] border-2 bg-[#f7f9fc] text-left shadow-[inset_0_-3px_0_rgba(148,163,184,0.2)] transition ${
                      (asset.unlockLevel || 1) <= currentLevel
                        ? `hover:border-[#9fd7f7] hover:bg-[#eaf6ff] ${backdropState?.id === asset.id ? 'border-[#13a4ff]' : 'border-[#d5dbe3]'}`
                        : 'cursor-not-allowed border-[#d9dbe0] bg-[#eef0f3] opacity-65 grayscale'
                    }`}
                    title={(asset.unlockLevel || 1) <= currentLevel ? asset.label : `🔒 ${getUnlockLevelLabel(asset.unlockLevel)}`}
                  >
                    {(asset.unlockLevel || 1) > currentLevel ? (
                      <div className="absolute right-3 top-3 z-10 rounded-full bg-white/95 px-2 py-1 text-[11px] font-extrabold text-[#7b8794] shadow-[0_2px_0_rgba(148,163,184,0.12)]">
                        🔒
                      </div>
                    ) : null}
                    <div className="aspect-[16/9] w-full bg-slate-200">
                      <img src={asset.src} alt={asset.label} className="h-full w-full object-cover" />
                    </div>
                    <div className="px-3 py-2 text-sm font-extrabold text-[#475569]">{asset.label}</div>
                    {(asset.unlockLevel || 1) > currentLevel ? (
                      <div className="absolute right-3 top-3 z-10">
                        <div className="inline-flex max-w-full items-center rounded-full border border-[#d4d8de] bg-white/90 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7b8794] shadow-[0_2px_0_rgba(148,163,184,0.12)]">
                          🔒 {getUnlockLevelLabel(asset.unlockLevel)}
                        </div>
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full space-y-4 overflow-y-auto pr-1">
              {spriteAssetSections.map((section) => (
                <section key={section.id} className="rounded-[24px] border border-[#e2e8f0] bg-[#f8fafc] p-3 shadow-[inset_0_-2px_0_rgba(148,163,184,0.12)]">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#64748b]">{section.title}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-[0.08em] text-[#0d76ab] shadow-[0_2px_0_rgba(148,163,184,0.12)]">
                      {section.assets.length} assets
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
                    {section.assets.map(renderSpriteAssetCard)}
                  </div>
                </section>
              ))}
            </div>
          )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white via-white/85 to-transparent" />
          </div>
        </div>
      ) : null}

      {isEditMode && draggingPlacedAssetKey ? (
        <div ref={trashZoneRef} className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2">
          <div
            className={`grid h-16 w-16 place-items-center rounded-full border-2 shadow-[0_10px_24px_rgba(15,23,42,0.24)] transition ${
              trashHover
                ? 'scale-110 border-rose-700 bg-rose-600 text-white'
                : 'border-rose-200 bg-white/95 text-rose-500'
            }`}
            aria-label="Delete dragged asset"
          >
            <Trash2 size={28} strokeWidth={2.6} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
