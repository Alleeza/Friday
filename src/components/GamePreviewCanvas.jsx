import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Play, RotateCcw, Save, Shapes, Square, Trash2, Undo2, X } from 'lucide-react';
import { backdropAssets, sandboxAssets } from '../data/sandboxAssets';

function getVisualAsset(asset, runtimeSnapshot) {
  if (!runtimeSnapshot?.assetsByKey?.[asset.key]) return asset;
  return { ...asset, ...runtimeSnapshot.assetsByKey[asset.key] };
}

function getTransform(asset) {
  const style = asset.rotationStyle || 'dont rotate';
  const parts = [];
  if (style === 'left-right') parts.push(`scaleX(${asset.facing === -1 ? -1 : 1})`);
  if (style === 'all around') parts.push(`rotate(${asset.rotation || 0}deg)`);
  return parts.join(' ') || 'none';
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

export default function GamePreviewCanvas({
  mode = 'edit',
  runtimeSnapshot,
  initialSceneState,
  selectedInstanceKey,
  onSceneChange,
  onSelectedInstanceChange,
  onPlay,
  onStop,
  onSave,
  saveState = 'idle',
  onSpriteClick,
  currentXp = 100,
  suppressSelectionChrome = false,
}) {
  const canvasRef = useRef(null);
  const backdropRef = useRef(null);
  const trashZoneRef = useRef(null);
  const moveStartSnapshotRef = useRef(null);
  const movedDuringDragRef = useRef(false);
  const resizeStartRef = useRef(null);
  const resizedDuringDragRef = useRef(false);
  const backdropMoveStartRef = useRef(null);
  const backdropMovedDuringDragRef = useRef(false);
  const backdropResizeStartRef = useRef(null);
  const backdropResizedDuringDragRef = useRef(false);
  const initialSceneRef = useRef(normalizeSceneState(initialSceneState));
  const [trayOpen, setTrayOpen] = useState(false);
  const [trayTab, setTrayTab] = useState('sprites');
  const [placedAssets, setPlacedAssets] = useState(initialSceneRef.current.placedAssets);
  const [selectedPlacedAssetKey, setSelectedPlacedAssetKey] = useState(initialSceneRef.current.selectedPlacedAssetKey);
  const [backdropState, setBackdropState] = useState(initialSceneRef.current.backdropState);
  const [pastStates, setPastStates] = useState([]);
  const [draggingPlacedAssetKey, setDraggingPlacedAssetKey] = useState(null);
  const [resizingPlacedAssetKey, setResizingPlacedAssetKey] = useState(null);
  const [draggingBackdrop, setDraggingBackdrop] = useState(false);
  const [resizingBackdrop, setResizingBackdrop] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [backdropDragOffset, setBackdropDragOffset] = useState({ x: 0, y: 0 });
  const [trashHover, setTrashHover] = useState(false);

  const trayAssets = useMemo(
    () => (trayTab === 'backdrops' ? backdropAssets : sandboxAssets),
    [trayTab]
  );
  const selectedPlacedAsset = placedAssets.find((asset) => asset.key === selectedPlacedAssetKey) || null;
  const selectedBackdrop = backdropState
    ? backdropAssets.find((asset) => asset.id === backdropState.id) || null
    : null;

  const updateSelection = (nextKey) => {
    setSelectedPlacedAssetKey(nextKey);
    onSelectedInstanceChange?.(nextKey);
  };

  useEffect(() => {
    if (selectedInstanceKey === undefined) return;
    setSelectedPlacedAssetKey((current) => (
      current === (selectedInstanceKey || null) ? current : selectedInstanceKey || null
    ));
  }, [selectedInstanceKey]);

  useEffect(() => {
    const sceneState = buildSnapshot(placedAssets, selectedPlacedAssetKey, backdropState);
    onSceneChange?.({
      instances: placedAssets,
      selectedInstanceKey: selectedPlacedAssetKey,
      selectedBackdrop: selectedBackdrop ? { ...selectedBackdrop, ...backdropState } : null,
      sceneState,
    });
  }, [backdropState, placedAssets, selectedBackdrop, selectedPlacedAssetKey, onSceneChange]);

  const onAssetDragStart = (e, asset, kind = 'sprite') => {
    if (mode !== 'edit') return;
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
    }

    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, kind === 'backdrop' ? 60 : 48, kind === 'backdrop' ? 36 : 48);
    requestAnimationFrame(() => document.body.removeChild(ghost));
  };

  const applyBackdrop = (backdrop) => {
    const snapshot = buildSnapshot(placedAssets, selectedPlacedAssetKey, backdropState);
    setPastStates((prev) => [...prev, snapshot]);
    setBackdropState(clampBackdropState({
      id: backdrop.id,
      x: 0,
      y: 0,
      scale: 1,
      locked: false,
    }, canvasRef.current?.getBoundingClientRect()));
    updateSelection(null);
  };

  const onCanvasDrop = (e) => {
    if (mode !== 'edit') return;
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
      setPastStates((prev) => [...prev, snapshot]);
      setPlacedAssets((prev) => [...prev, placed]);
      updateSelection(placed.key);
    } catch {
      // ignore malformed drag payload
    }
  };

  const handleUndo = () => {
    if (mode !== 'edit' || !pastStates.length) return;
    const previous = pastStates[pastStates.length - 1];
    setPastStates((prev) => prev.slice(0, -1));
    setPlacedAssets(previous.placedAssets);
    updateSelection(previous.selectedPlacedAssetKey);
    setBackdropState(previous.backdropState);
  };

  const handleRestart = () => {
    if (mode !== 'edit' || (!placedAssets.length && !backdropState)) return;
    setPlacedAssets([]);
    updateSelection(null);
    setBackdropState(null);
    setPastStates([]);
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

  const deletePlacedAsset = (assetKey) => {
    if (!assetKey) return;
    const snapshot = buildSnapshot(placedAssets, selectedPlacedAssetKey, backdropState);
    setPastStates((prev) => [...prev, snapshot]);
    setPlacedAssets((prev) => prev.filter((asset) => asset.key !== assetKey));
    updateSelection(selectedPlacedAssetKey === assetKey ? null : selectedPlacedAssetKey);
  };

  const handlePlacedAssetPointerDown = (e, asset) => {
    if (mode !== 'edit' || !canvasRef.current) return;
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    updateSelection(asset.key);
    setDraggingPlacedAssetKey(asset.key);
    setDragOffset({ x: e.clientX - rect.left - asset.x, y: e.clientY - rect.top - asset.y });
    moveStartSnapshotRef.current = buildSnapshot(placedAssets, selectedPlacedAssetKey, backdropState);
    movedDuringDragRef.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleBackdropPointerDown = (e) => {
    if (mode !== 'edit' || !canvasRef.current || !backdropState || backdropState.locked) return;
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

  const handleCanvasPointerMove = (e) => {
    if (!canvasRef.current || mode !== 'edit') return;

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
    const x = Math.max(frameHalf, Math.min(pointerX - dragOffset.x, rect.width - frameHalf));
    const y = Math.max(frameHalf, Math.min(pointerY - dragOffset.y, rect.height - frameHalf));
    setPlacedAssets((prev) => prev.map((asset) => (
      asset.key !== draggingPlacedAssetKey ? asset : { ...asset, x, y }
    )));
    movedDuringDragRef.current = true;
    setTrashHover(isPointerOverTrash(e.clientX, e.clientY));
  };

  const handleCanvasPointerUp = (e) => {
    if (mode !== 'edit') return;

    if (draggingBackdrop) {
      if (backdropMovedDuringDragRef.current && backdropMoveStartRef.current) {
        setPastStates((prev) => [...prev, backdropMoveStartRef.current]);
      }
      setDraggingBackdrop(false);
      backdropMoveStartRef.current = null;
      backdropMovedDuringDragRef.current = false;
    }

    if (resizingBackdrop) {
      if (backdropResizedDuringDragRef.current && backdropResizeStartRef.current?.snapshot) {
        setPastStates((prev) => [...prev, backdropResizeStartRef.current.snapshot]);
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
        setPastStates((prev) => [...prev, moveStartSnapshotRef.current]);
      }
      setDraggingPlacedAssetKey(null);
      setTrashHover(false);
      moveStartSnapshotRef.current = null;
      movedDuringDragRef.current = false;
    }

    if (resizingPlacedAssetKey) {
      if (resizedDuringDragRef.current && resizeStartRef.current?.snapshot) {
        setPastStates((prev) => [...prev, resizeStartRef.current.snapshot]);
      }
      setResizingPlacedAssetKey(null);
      resizeStartRef.current = null;
      resizedDuringDragRef.current = false;
    }
  };

  const handleResizeHandlePointerDown = (e, asset, directionX, directionY) => {
    if (mode !== 'edit') return;
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
    if (mode !== 'edit' || !backdropState || backdropState.locked) return;
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
    if (mode !== 'edit' || (!draggingBackdrop && !resizingBackdrop)) return undefined;
    const onWindowPointerMove = (event) => handleCanvasPointerMove(event);
    const onWindowPointerUp = () => handleCanvasPointerUp();
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
    };
  }, [draggingBackdrop, resizingBackdrop, mode]);

  useEffect(() => {
    if (mode !== 'edit' || !backdropState || backdropState.locked || draggingBackdrop || resizingBackdrop) return undefined;
    const onWindowPointerDown = (event) => {
      if (backdropRef.current?.contains(event.target)) return;
      lockBackdropEditing();
    };
    window.addEventListener('pointerdown', onWindowPointerDown, true);
    return () => {
      window.removeEventListener('pointerdown', onWindowPointerDown, true);
    };
  }, [backdropState, draggingBackdrop, resizingBackdrop, mode]);

  const handleSelectedAssetWheel = (e, asset) => {
    if (mode !== 'edit') return;
    e.preventDefault();
    const currentScale = asset.scale || 1;
    const nextScale = Math.max(0.6, Math.min(1.8, Math.round((currentScale + (e.deltaY < 0 ? 0.1 : -0.1)) * 10) / 10));
    if (nextScale === currentScale) return;
    const snapshot = buildSnapshot(placedAssets, asset.key, backdropState);
    setPastStates((prev) => [...prev, snapshot]);
    setPlacedAssets((prev) => prev.map((item) => (
      item.key === asset.key ? { ...item, scale: nextScale } : item
    )));
  };

  const visibleAssets = placedAssets.map((asset) => getVisualAsset(asset, runtimeSnapshot));
  const showSelectionChrome = mode === 'edit' && !suppressSelectionChrome;
  const backdropTransform = backdropState
    ? `translate(${backdropState.x}px, ${backdropState.y}px) scale(${backdropState.scale})`
    : 'none';
  const saveLabel = saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save';

  return (
    <section
      ref={canvasRef}
      data-sandbox-canvas-root="true"
      className="relative h-full overflow-hidden rounded-[28px] border border-duo-line bg-[#ece7d2]"
      onClick={(e) => {
        if (mode === 'edit' && e.target === e.currentTarget) updateSelection(null);
      }}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerCancel={handleCanvasPointerUp}
      onLostPointerCapture={handleCanvasPointerUp}
      onDragOver={(e) => mode === 'edit' && e.preventDefault()}
      onDrop={onCanvasDrop}
    >
      {selectedBackdrop ? (
        <div
          ref={backdropRef}
          className={`absolute left-1/2 top-1/2 z-0 aspect-[16/9] w-full max-w-none -translate-x-1/2 -translate-y-1/2 ${mode === 'edit' && !backdropState?.locked ? 'cursor-grab' : ''} ${draggingBackdrop ? 'cursor-grabbing' : ''}`}
          style={{ transform: `translate(-50%, -50%) ${backdropTransform}` }}
          onPointerDown={handleBackdropPointerDown}
        >
          <img src={selectedBackdrop.src} alt={selectedBackdrop.label} className="h-full w-full select-none object-cover" draggable={false} onDragStart={(e) => e.preventDefault()} />
          {mode === 'edit' && backdropState && !backdropState.locked ? (
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

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <button type="button" onClick={handleUndo} disabled={mode !== 'edit' || !pastStates.length} className="grid h-14 w-14 place-items-center rounded-full bg-[#6f6f6f] text-white shadow disabled:cursor-not-allowed disabled:opacity-45"><Undo2 size={24} /></button>
        <button type="button" onClick={handleRestart} disabled={mode !== 'edit' || (!placedAssets.length && !backdropState)} className="grid h-14 w-14 place-items-center rounded-full bg-[#a5a5a5] text-white shadow disabled:cursor-not-allowed disabled:opacity-45"><RotateCcw size={24} /></button>
        <button type="button" onClick={onSave} disabled={saveState === 'saving'} className="duo-btn-blue inline-flex items-center gap-2 rounded-full px-7 py-3 text-3xl disabled:cursor-not-allowed disabled:opacity-70">
          <Save size={24} />
          {saveLabel}
        </button>
        {mode === 'play' ? <button onClick={onStop} className="duo-btn-blue inline-flex items-center gap-2 rounded-full px-7 py-3 text-3xl"><Square size={24} />Stop</button> : <button onClick={onPlay} className="duo-btn-blue inline-flex items-center gap-2 rounded-full px-7 py-3 text-3xl"><Play size={24} />Play</button>}
      </div>

      {mode === 'play' ? <div className="absolute left-4 top-4 z-10 rounded-2xl border border-[#d3dae3] bg-white/90 px-4 py-2 text-sm font-extrabold text-slate-700 shadow">Timer: {Math.ceil(runtimeSnapshot?.variables?.time ?? 0)}s | Score: {Math.round(runtimeSnapshot?.variables?.score ?? 0)}</div> : null}

      {visibleAssets.map((asset) => {
        const isSelected = selectedPlacedAssetKey === asset.key;
        const scale = asset.scale || 1;
        const frameSize = 180 * scale;
        const emojiSize = 96 * scale;
        return (
          <div
            key={asset.key}
            className={`absolute -translate-x-1/2 -translate-y-1/2 touch-none ${mode === 'edit' && draggingPlacedAssetKey === asset.key ? 'z-40 cursor-grabbing' : 'z-20'} ${mode === 'edit' && draggingPlacedAssetKey !== asset.key ? 'cursor-grab' : mode !== 'edit' ? 'cursor-pointer' : ''}`}
            style={{ left: asset.x, top: asset.y, width: frameSize, height: frameSize }}
            title={asset.label}
            onClick={(e) => {
              e.stopPropagation();
              updateSelection(asset.key);
              if (mode === 'play') onSpriteClick?.(asset.key);
            }}
            onPointerDown={(e) => handlePlacedAssetPointerDown(e, asset)}
            onWheel={isSelected ? (e) => handleSelectedAssetWheel(e, asset) : undefined}
          >
            {isSelected && showSelectionChrome ? (
              <>
                <div className="absolute inset-0 border-[3px] border-[#19a2ff]" />
                <div className="absolute -left-[7px] -top-[7px] h-[14px] w-[14px] cursor-nwse-resize border-2 border-[#19a2ff] bg-white" onPointerDown={(e) => handleResizeHandlePointerDown(e, asset, -1, -1)} />
                <div className="absolute -right-[7px] -top-[7px] h-[14px] w-[14px] cursor-nesw-resize border-2 border-[#19a2ff] bg-white" onPointerDown={(e) => handleResizeHandlePointerDown(e, asset, 1, -1)} />
                <div className="absolute -bottom-[7px] -left-[7px] h-[14px] w-[14px] cursor-nesw-resize border-2 border-[#19a2ff] bg-white" onPointerDown={(e) => handleResizeHandlePointerDown(e, asset, -1, 1)} />
                <div className="absolute -bottom-[7px] -right-[7px] h-[14px] w-[14px] cursor-nwse-resize border-2 border-[#19a2ff] bg-white" onPointerDown={(e) => handleResizeHandlePointerDown(e, asset, 1, 1)} />
              </>
            ) : null}
            <div className="grid h-full w-full place-items-center bg-transparent leading-none" style={{ fontSize: emojiSize, transform: getTransform(asset) }}>{asset.emoji}</div>
            {asset.costume && asset.costume !== 'default' ? <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-slate-600 shadow">{asset.costume}</div> : null}
          </div>
        );
      })}

      {selectedPlacedAsset && showSelectionChrome ? <div className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-[20px] border border-duo-line bg-white px-4 py-2 shadow"><div className="flex items-center gap-3 text-2xl font-bold text-slate-800"><span className="rounded-xl bg-slate-100 px-2 py-1">{selectedPlacedAsset.emoji}</span>{selectedPlacedAsset.label}</div></div> : null}
      <button onClick={() => mode === 'edit' && setTrayOpen((v) => !v)} className="absolute bottom-4 left-1/2 z-20 grid h-16 w-16 -translate-x-1/2 place-items-center rounded-full border-b-4 border-[#666a65] bg-[#7f827c] text-5xl font-display text-white shadow">{trayOpen ? <X size={30} /> : '+'}</button>

      {trayOpen && mode === 'edit' ? (
        <div className="absolute bottom-24 left-1/2 z-20 w-[900px] max-w-[94%] -translate-x-1/2 rounded-[34px] border-2 border-[#d7dde4] bg-white p-5 shadow-[0_8px_0_rgba(148,163,184,0.22)]">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-[#64748b]">Drag Assets Into The Sandbox</p>
              <p className="mt-1 text-sm font-bold text-slate-500">{trayTab === 'backdrops' ? 'Pick a backdrop, adjust it once, then lock it into place.' : 'Emoji assets stay interactive and can be scripted like before.'}</p>
            </div>
            <div className="inline-flex rounded-[22px] border-2 border-[#d7dde4] bg-[#f8fafc] p-1 shadow-[inset_0_-2px_0_rgba(148,163,184,0.12)]">
              <button type="button" onClick={() => setTrayTab('sprites')} className={`inline-flex items-center gap-2 rounded-[16px] px-4 py-2 text-sm font-extrabold transition ${trayTab === 'sprites' ? 'bg-white text-[#0d76ab] shadow-[0_3px_0_rgba(148,163,184,0.18)]' : 'text-slate-500 hover:text-slate-700'}`}><Shapes size={16} />Emoji Assets</button>
              <button type="button" onClick={() => setTrayTab('backdrops')} className={`inline-flex items-center gap-2 rounded-[16px] px-4 py-2 text-sm font-extrabold transition ${trayTab === 'backdrops' ? 'bg-white text-[#0d76ab] shadow-[0_3px_0_rgba(148,163,184,0.18)]' : 'text-slate-500 hover:text-slate-700'}`}><Image size={16} />Backdrop Assets</button>
            </div>
          </div>

          {trayTab === 'backdrops' ? (
            <div className="max-h-[360px] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
                {trayAssets.map((asset) => (
                  <button key={asset.id} type="button" draggable onDragStart={(e) => onAssetDragStart(e, asset, 'backdrop')} onClick={() => applyBackdrop(asset)} className={`relative overflow-hidden rounded-[24px] border-2 bg-[#f7f9fc] text-left shadow-[inset_0_-3px_0_rgba(148,163,184,0.2)] transition hover:border-[#9fd7f7] hover:bg-[#eaf6ff] ${backdropState?.id === asset.id ? 'border-[#13a4ff]' : 'border-[#d5dbe3]'}`} title={asset.label}>
                    <div className="aspect-[16/9] w-full bg-slate-200">
                      <img src={asset.src} alt={asset.label} className="h-full w-full object-cover" />
                    </div>
                    <div className="px-3 py-2 text-sm font-extrabold text-[#475569]">{asset.label}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
              {trayAssets.map((asset) => (
                <div key={asset.id} draggable={(asset.unlockXp || 0) <= currentXp} onDragStart={(e) => onAssetDragStart(e, asset, 'sprite')} className={`relative rounded-[24px] border-2 p-3 text-center shadow-[inset_0_-3px_0_rgba(148,163,184,0.2)] transition ${(asset.unlockXp || 0) <= currentXp ? 'cursor-grab border-[#d5dbe3] bg-[#f7f9fc] hover:border-[#9fd7f7] hover:bg-[#eaf6ff] active:cursor-grabbing' : 'cursor-not-allowed border-[#d9dbe0] bg-[#eef0f3] opacity-65 grayscale'}`} title={(asset.unlockXp || 0) <= currentXp ? asset.label : `Unlocks at ${asset.unlockXp} XP`}>
                  <div className="text-3xl">{asset.emoji}</div>
                  <div className="mt-1 text-sm font-extrabold text-[#475569]">{asset.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {mode === 'edit' && draggingPlacedAssetKey ? (
        <div ref={trashZoneRef} className="pointer-events-none absolute left-4 top-24 z-30">
          <div className={`grid h-20 w-20 place-items-center rounded-full border-2 shadow-[0_10px_24px_rgba(15,23,42,0.24)] transition ${trashHover ? 'scale-110 border-rose-700 bg-rose-600 text-white' : 'border-rose-200 bg-white/95 text-rose-500'}`} aria-label="Delete dragged asset">
            <Trash2 size={34} strokeWidth={2.6} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
