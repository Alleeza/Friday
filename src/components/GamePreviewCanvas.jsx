import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, RotateCcw, Square, Undo2, X } from 'lucide-react';
import { sandboxAssets } from '../data/sandboxAssets';

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

export default function GamePreviewCanvas({
  mode = 'edit',
  runtimeSnapshot,
  selectedInstanceKey,
  onSceneChange,
  onSelectedInstanceChange,
  onPlay,
  onStop,
  onSpriteClick,
  currentXp = 100,
}) {
  const canvasRef = useRef(null);
  const moveStartSnapshotRef = useRef(null);
  const movedDuringDragRef = useRef(false);
  const resizeStartRef = useRef(null);
  const resizedDuringDragRef = useRef(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [placedAssets, setPlacedAssets] = useState([]);
  const [selectedPlacedAssetKey, setSelectedPlacedAssetKey] = useState(null);
  const [pastStates, setPastStates] = useState([]);
  const [draggingPlacedAssetKey, setDraggingPlacedAssetKey] = useState(null);
  const [resizingPlacedAssetKey, setResizingPlacedAssetKey] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const trayAssets = useMemo(() => sandboxAssets, []);
  const selectedPlacedAsset = placedAssets.find((asset) => asset.key === selectedPlacedAssetKey) || null;

  const updateSelection = (nextKey) => {
    setSelectedPlacedAssetKey(nextKey);
    onSelectedInstanceChange?.(nextKey);
  };

  useEffect(() => {
    if (selectedInstanceKey === undefined) return;
    setSelectedPlacedAssetKey((current) => (current === (selectedInstanceKey || null) ? current : selectedInstanceKey || null));
  }, [selectedInstanceKey]);

  useEffect(() => {
    onSceneChange?.({ instances: placedAssets, selectedInstanceKey: selectedPlacedAssetKey });
  }, [placedAssets, selectedPlacedAssetKey, onSceneChange]);

  const onAssetDragStart = (e, asset) => {
    if (mode !== 'edit') return;
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
    const ghost = document.createElement('div');
    ghost.textContent = asset.emoji;
    ghost.style.fontSize = '96px';
    ghost.style.position = 'absolute';
    ghost.style.top = '-9999px';
    ghost.style.left = '-9999px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 48, 48);
    requestAnimationFrame(() => document.body.removeChild(ghost));
  };

  const onCanvasDrop = (e) => {
    if (mode !== 'edit') return;
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw || !canvasRef.current) return;
    try {
      const asset = JSON.parse(raw);
      const rect = canvasRef.current.getBoundingClientRect();
      const initialScale = 1;
      const halfSize = 90 * initialScale;
      const x = Math.max(halfSize, Math.min(e.clientX - rect.left, rect.width - halfSize));
      const y = Math.max(70 + halfSize, Math.min(e.clientY - rect.top, rect.height - halfSize));
      const placed = { ...asset, x, y, scale: initialScale, rotation: 0, key: `${asset.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
      const snapshot = { placedAssets: placedAssets.map((item) => ({ ...item })), selectedPlacedAssetKey };
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
  };

  const handleRestart = () => {
    if (mode !== 'edit' || !placedAssets.length) return;
    setPlacedAssets([]);
    updateSelection(null);
    setPastStates([]);
    setDraggingPlacedAssetKey(null);
    setResizingPlacedAssetKey(null);
    moveStartSnapshotRef.current = null;
    resizeStartRef.current = null;
    movedDuringDragRef.current = false;
    resizedDuringDragRef.current = false;
  };

  const handlePlacedAssetPointerDown = (e, asset) => {
    if (mode !== 'edit' || !canvasRef.current) return;
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    updateSelection(asset.key);
    setDraggingPlacedAssetKey(asset.key);
    setDragOffset({ x: e.clientX - rect.left - asset.x, y: e.clientY - rect.top - asset.y });
    moveStartSnapshotRef.current = { placedAssets: placedAssets.map((item) => ({ ...item })), selectedPlacedAssetKey };
    movedDuringDragRef.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleCanvasPointerMove = (e) => {
    if (!canvasRef.current || mode !== 'edit') return;
    if (resizingPlacedAssetKey && resizeStartRef.current) {
      const start = resizeStartRef.current;
      const deltaY = e.clientY - start.pointerY;
      const nextScale = Math.max(0.6, Math.min(1.8, Math.round((start.scale - deltaY / 220) * 10) / 10));
      setPlacedAssets((prev) => prev.map((asset) => asset.key !== resizingPlacedAssetKey ? asset : { ...asset, scale: nextScale }));
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
    setPlacedAssets((prev) => prev.map((asset) => asset.key !== draggingPlacedAssetKey ? asset : { ...asset, x, y }));
    movedDuringDragRef.current = true;
  };

  const handleCanvasPointerUp = () => {
    if (mode !== 'edit') return;
    if (draggingPlacedAssetKey) {
      if (movedDuringDragRef.current && moveStartSnapshotRef.current) setPastStates((prev) => [...prev, moveStartSnapshotRef.current]);
      setDraggingPlacedAssetKey(null);
      moveStartSnapshotRef.current = null;
      movedDuringDragRef.current = false;
    }
    if (resizingPlacedAssetKey) {
      if (resizedDuringDragRef.current && resizeStartRef.current?.snapshot) setPastStates((prev) => [...prev, resizeStartRef.current.snapshot]);
      setResizingPlacedAssetKey(null);
      resizeStartRef.current = null;
      resizedDuringDragRef.current = false;
    }
  };

  const handleResizeHandlePointerDown = (e, asset) => {
    if (mode !== 'edit') return;
    e.stopPropagation();
    updateSelection(asset.key);
    setResizingPlacedAssetKey(asset.key);
    resizeStartRef.current = {
      pointerY: e.clientY,
      scale: asset.scale || 1,
      snapshot: { placedAssets: placedAssets.map((item) => ({ ...item })), selectedPlacedAssetKey: asset.key },
    };
    resizedDuringDragRef.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleSelectedAssetWheel = (e, asset) => {
    if (mode !== 'edit') return;
    e.preventDefault();
    const currentScale = asset.scale || 1;
    const nextScale = Math.max(0.6, Math.min(1.8, Math.round((currentScale + (e.deltaY < 0 ? 0.1 : -0.1)) * 10) / 10));
    if (nextScale === currentScale) return;
    const snapshot = { placedAssets: placedAssets.map((item) => ({ ...item })), selectedPlacedAssetKey: asset.key };
    setPastStates((prev) => [...prev, snapshot]);
    setPlacedAssets((prev) => prev.map((item) => item.key === asset.key ? { ...item, scale: nextScale } : item));
  };

  const visibleAssets = placedAssets.map((asset) => getVisualAsset(asset, runtimeSnapshot));

  return (
    <section ref={canvasRef} className="relative h-full overflow-hidden rounded-[28px] border border-duo-line bg-[#ece7d2]" onClick={(e) => {
      if (mode === 'edit' && e.target === e.currentTarget) updateSelection(null);
    }} onPointerMove={handleCanvasPointerMove} onPointerUp={handleCanvasPointerUp} onPointerCancel={handleCanvasPointerUp} onLostPointerCapture={handleCanvasPointerUp} onDragOver={(e) => mode === 'edit' && e.preventDefault()} onDrop={onCanvasDrop}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.24),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.2),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] bg-[size:48px_48px] opacity-60" />
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <button type="button" onClick={handleUndo} disabled={mode !== 'edit' || !pastStates.length} className="grid h-14 w-14 place-items-center rounded-full bg-[#6f6f6f] text-white shadow disabled:cursor-not-allowed disabled:opacity-45"><Undo2 size={24} /></button>
        <button type="button" onClick={handleRestart} disabled={mode !== 'edit' || !placedAssets.length} className="grid h-14 w-14 place-items-center rounded-full bg-[#a5a5a5] text-white shadow disabled:cursor-not-allowed disabled:opacity-45"><RotateCcw size={24} /></button>
        {mode === 'play' ? <button onClick={onStop} className="duo-btn-blue inline-flex items-center gap-2 rounded-full px-7 py-3 text-3xl"><Square size={24} />Stop</button> : <button onClick={onPlay} className="duo-btn-blue inline-flex items-center gap-2 rounded-full px-7 py-3 text-3xl"><Play size={24} />Play</button>}
      </div>
      {mode === 'play' ? <div className="absolute left-4 top-4 z-10 rounded-2xl border border-[#d3dae3] bg-white/90 px-4 py-2 text-sm font-extrabold text-slate-700 shadow">Timer: {Math.ceil(runtimeSnapshot?.variables?.time ?? 0)}s</div> : null}
      {visibleAssets.map((asset) => {
        const isSelected = selectedPlacedAssetKey === asset.key;
        const scale = asset.scale || 1;
        const frameSize = 180 * scale;
        const emojiSize = 96 * scale;
        return (
          <div key={asset.key} className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 touch-none ${mode === 'edit' && draggingPlacedAssetKey === asset.key ? 'cursor-grabbing' : mode === 'edit' ? 'cursor-grab' : 'cursor-pointer'}`} style={{ left: asset.x, top: asset.y, width: frameSize, height: frameSize }} title={asset.label} onClick={(e) => {
            e.stopPropagation();
            updateSelection(asset.key);
            if (mode === 'play') onSpriteClick?.(asset.key);
          }} onPointerDown={(e) => handlePlacedAssetPointerDown(e, asset)} onWheel={isSelected ? (e) => handleSelectedAssetWheel(e, asset) : undefined}>
            {isSelected && mode === 'edit' ? <><div className="absolute inset-0 border-[3px] border-[#19a2ff]" /><div className="absolute -left-[7px] -top-[7px] h-[14px] w-[14px] cursor-nwse-resize border-2 border-[#19a2ff] bg-white" onPointerDown={(e) => handleResizeHandlePointerDown(e, asset)} /><div className="absolute -right-[7px] -top-[7px] h-[14px] w-[14px] cursor-nesw-resize border-2 border-[#19a2ff] bg-white" onPointerDown={(e) => handleResizeHandlePointerDown(e, asset)} /><div className="absolute -bottom-[7px] -left-[7px] h-[14px] w-[14px] cursor-nesw-resize border-2 border-[#19a2ff] bg-white" onPointerDown={(e) => handleResizeHandlePointerDown(e, asset)} /><div className="absolute -bottom-[7px] -right-[7px] h-[14px] w-[14px] cursor-nwse-resize border-2 border-[#19a2ff] bg-white" onPointerDown={(e) => handleResizeHandlePointerDown(e, asset)} /></> : null}
            <div className="grid h-full w-full place-items-center bg-transparent leading-none" style={{ fontSize: emojiSize, transform: getTransform(asset) }}>{asset.emoji}</div>
            {asset.costume && asset.costume !== 'default' ? <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-slate-600 shadow">{asset.costume}</div> : null}
          </div>
        );
      })}
      {selectedPlacedAsset ? <div className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-[20px] border border-duo-line bg-white px-4 py-2 shadow"><div className="flex items-center gap-3 text-2xl font-bold text-slate-800"><span className="rounded-xl bg-slate-100 px-2 py-1">{selectedPlacedAsset.emoji}</span>{selectedPlacedAsset.label}</div></div> : null}
      <button onClick={() => mode === 'edit' && setTrayOpen((v) => !v)} className="absolute bottom-4 left-1/2 z-20 grid h-16 w-16 -translate-x-1/2 place-items-center rounded-full border-b-4 border-[#666a65] bg-[#7f827c] text-5xl font-display text-white shadow">{trayOpen ? <X size={30} /> : '+'}</button>
      {trayOpen && mode === 'edit' ? <div className="absolute bottom-24 left-1/2 z-20 w-[900px] max-w-[94%] -translate-x-1/2 rounded-[34px] border-2 border-[#d7dde4] bg-white p-5 shadow-[0_8px_0_rgba(148,163,184,0.22)]"><p className="mb-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#64748b]">Drag Assets Into The Sandbox</p><div className="grid grid-cols-3 gap-3 md:grid-cols-6">{trayAssets.map((asset) => <div key={asset.id} draggable={(asset.unlockXp || 0) <= currentXp} onDragStart={(e) => onAssetDragStart(e, asset)} className={`relative rounded-[24px] border-2 p-3 text-center shadow-[inset_0_-3px_0_rgba(148,163,184,0.2)] transition ${(asset.unlockXp || 0) <= currentXp ? 'cursor-grab border-[#d5dbe3] bg-[#f7f9fc] hover:border-[#9fd7f7] hover:bg-[#eaf6ff] active:cursor-grabbing' : 'cursor-not-allowed border-[#d9dbe0] bg-[#eef0f3] opacity-65 grayscale'}`} title={(asset.unlockXp || 0) <= currentXp ? asset.label : `Unlocks at ${asset.unlockXp} XP`}><div className="text-3xl">{asset.emoji}</div><div className="mt-1 text-sm font-extrabold text-[#475569]">{asset.label}</div></div>)}</div></div> : null}
    </section>
  );
}
