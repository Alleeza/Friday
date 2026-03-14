import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, ArrowRight, Zap, ChevronDown, ChevronUp,
  AlertTriangle, Info, Star, Clock, Layers, Wrench,
  RefreshCw, MessageSquare,
} from 'lucide-react';
import { sandboxAssets } from '../data/sandboxAssets.js';

/* ─── Asset emoji lookup ─── */
const ASSET_MAP = Object.fromEntries(sandboxAssets.map((a) => [a.id, { emoji: a.emoji, label: a.label }]));

/* ─── Stage Card ─── */
function StageCard({ stage, index, isFirst }) {
  const [open, setOpen] = useState(isFirst);

  return (
    <div className={`rounded-2xl border-2 transition-all ${open ? 'border-[#58cc02] bg-[#f4fce8]' : 'border-slate-200 bg-white'}`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${open ? 'bg-[#58cc02] text-white' : 'bg-slate-100 text-slate-500'}`}>
            {index + 1}
          </span>
          <span className={`text-[15px] font-bold ${open ? 'text-[#2d6b01]' : 'text-slate-800'}`}>
            {stage.label}
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-[#58cc02]" />
          : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-[#d6eec2] px-6 pb-5 pt-4 space-y-4">
          {/* Objective */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Objective</p>
            <p className="mt-1 text-[14px] leading-relaxed text-slate-700">{stage.objective}</p>
          </div>

          {/* Learning concept */}
          <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Learning Concept</p>
              <p className="mt-0.5 text-[13px] text-blue-700">{stage.why}</p>
            </div>
          </div>

          {/* Steps */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Steps</p>
            <ol className="space-y-2">
              {stage.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#58cc02]/20 text-[11px] font-bold text-[#3a7d0a]">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-[13px] leading-relaxed text-slate-700">{step}</span>
                  {stage.stepXp[i] > 0 && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                      +{stage.stepXp[i]} XP
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {/* Success criteria */}
          <div className="flex items-start gap-2 rounded-xl border border-[#d6eec2] bg-white px-4 py-3">
            <Star className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Done when…</p>
              <p className="mt-0.5 text-[13px] text-slate-700">{stage.success}</p>
            </div>
          </div>

          {/* Optional steps */}
          {stage.optionalSteps?.length > 0 && (
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Bonus Challenges</p>
              <ul className="space-y-1.5">
                {stage.optionalSteps.map((os, i) => (
                  <li key={i} className="flex items-center gap-2 text-[13px] text-slate-600">
                    <span className="text-amber-400">✦</span>
                    {os.description}
                    {os.bonusXp > 0 && (
                      <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                        +{os.bonusXp} XP
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Refinement History ─── */
function RefinementHistory({ history }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history.length]);

  if (!history.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        <MessageSquare className="h-3.5 w-3.5" />
        Refinement History
      </p>
      <div className="space-y-2">
        {history.map((msg, i) => (
          <div
            key={i}
            className={`rounded-xl px-4 py-2.5 text-[13px] leading-relaxed ${
              msg.role === 'user'
                ? 'ml-4 bg-[#f4fce8] text-[#2d6b01]'
                : 'mr-4 bg-slate-100 text-slate-600'
            }`}
          >
            <span className="font-bold">
              {msg.role === 'user' ? 'You: ' : 'Updated plan: '}
            </span>
            {msg.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function PlanReview({
  plan,
  infeasible,
  suggestion,
  usedFallback,
  turnStats,
  refinementHistory,
  isRefining,
  onRefine,
  onAccept,
  onBack,
}) {
  const [refineText, setRefineText] = useState('');

  const handleRefineSubmit = (e) => {
    e.preventDefault();
    if (!refineText.trim() || isRefining || turnStats.remaining === 0) return;
    onRefine(refineText.trim());
    setRefineText('');
  };

  const totalXp = plan?.stages?.reduce(
    (sum, s) => sum + s.stepXp.reduce((a, b) => a + b, 0),
    0
  ) ?? 0;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <main className="mx-auto max-w-[860px] px-6 py-10 lg:px-10 lg:py-14">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Breadcrumb */}
          <div className="mb-8 flex items-center gap-2 text-[13px] font-medium text-slate-400">
            <span className="text-[#46a302]">✓ Idea entered</span>
            <span className="h-px w-4 bg-slate-200" />
            <span className="text-[#46a302]">✓ Plan generated</span>
            <span className="h-px w-4 bg-slate-200" />
            <span className="rounded-full bg-[#58cc02] px-3 py-0.5 text-[12px] font-bold text-white">3</span>
            <span className="font-semibold text-slate-700">Review & Refine</span>
          </div>

          {/* Page title */}
          <div className="mb-8">
            <h1 className="font-display text-[2.5rem] leading-tight text-slate-900">Your Game Plan</h1>
            <p className="mt-2 text-base leading-relaxed text-slate-500">
              Review your plan below. Not quite right? Ask for changes before you start building.
            </p>
          </div>

          {/* Infeasibility Banner */}
          {infeasible && suggestion && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-[14px] font-bold text-amber-800">Your idea needed some tweaks</p>
                <p className="mt-1 text-[13px] leading-relaxed text-amber-700">{suggestion}</p>
              </div>
            </div>
          )}

          {/* Fallback Notice */}
          {usedFallback && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="text-[13px] text-slate-500">
                We could not generate a safe custom plan for that exact prompt, so we made a starter version using mechanics the builder supports.
              </p>
            </div>
          )}

          {/* Plan Summary Card */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">Plan Overview</p>

            <p className="mb-4 text-[16px] leading-relaxed text-slate-800">{plan.summary}</p>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="font-semibold">{plan.eta}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
                <Layers className="h-4 w-4 text-slate-400" />
                <span className="font-semibold">{plan.stages.length} stage{plan.stages.length !== 1 ? 's' : ''}</span>
              </div>
              {totalXp > 0 && (
                <div className="flex items-center gap-1.5 text-[13px] text-amber-600">
                  <Star className="h-4 w-4 text-amber-400" />
                  <span className="font-semibold">Up to {totalXp} XP</span>
                </div>
              )}
            </div>

            {/* Entity badges */}
            {plan.entities.assets.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Characters & Objects</p>
                <div className="flex flex-wrap gap-2">
                  {plan.entities.assets.map((assetId) => {
                    const asset = ASSET_MAP[assetId];
                    return (
                      <span key={assetId} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[13px] font-medium text-slate-700">
                        {asset ? `${asset.emoji} ${asset.label}` : assetId}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {plan.entities.blocks.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Blocks You'll Use</p>
                <div className="flex flex-wrap gap-2">
                  {plan.entities.blocks.map((block) => (
                    <span key={block} className="flex items-center gap-1 rounded-full border border-[#d6eec2] bg-[#f0fbe4] px-3 py-1 text-[12px] font-semibold text-[#3a7d0a]">
                      <Wrench className="h-3 w-3" />
                      {block}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stages */}
          <div className="mb-6 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Stages</p>
            {plan.stages.map((stage, i) => (
              <StageCard key={stage.id} stage={stage} index={i} isFirst={i === 0} />
            ))}
          </div>

          {/* Refinement input */}
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Request Changes</p>
              {turnStats.remaining > 0 ? (
                <span className="text-[12px] text-slate-400">
                  {turnStats.remaining} refinement{turnStats.remaining !== 1 ? 's' : ''} remaining
                </span>
              ) : (
                <span className="text-[12px] font-semibold text-amber-600">Maximum refinements reached</span>
              )}
            </div>
            <form onSubmit={handleRefineSubmit}>
              <textarea
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                placeholder='e.g. "Make it simpler" or "Add an extra stage with coins"'
                rows={2}
                disabled={isRefining || turnStats.remaining === 0}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] leading-relaxed text-slate-800 placeholder:text-slate-300 focus:border-[#58cc02] focus:outline-none focus:ring-2 focus:ring-[#58cc02]/20 disabled:opacity-50"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={!refineText.trim() || isRefining || turnStats.remaining === 0}
                  className="flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_2px_0_rgba(0,0,0,0.3)] transition-all hover:bg-slate-700 active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {isRefining ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Refining…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Refine Plan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Refinement history */}
          <div className="mb-8">
            <RefinementHistory history={refinementHistory} />
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Idea
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={isRefining}
              className="flex items-center gap-2.5 rounded-2xl bg-[#58cc02] px-8 py-3.5 text-[16px] font-bold text-white shadow-[0_4px_0_#46a302] transition-all hover:brightness-95 active:translate-y-[1px] active:shadow-[0_2px_0_#46a302] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              <Zap className="h-5 w-5" />
              Accept Plan &amp; Start Building
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
