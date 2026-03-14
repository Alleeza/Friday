import { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, Lightbulb, BrainCircuit, Zap, Check, Flame, Star, X } from 'lucide-react';
import { usePlanSession } from '../hooks/usePlanSession.js';
import PlanReview from './PlanReview.jsx';
import {
  getDefaultModelForProvider,
  getDefaultProviderName,
} from '../ai/providerCatalog.js';

/* ─── Option data ─── */
const STYLES = [
  { id: 'platformer', label: 'Platformer', desc: 'Side-scrolling jump & run' },
  { id: 'puzzle', label: 'Puzzle', desc: 'Logic and problem solving' },
  { id: 'action', label: 'Action', desc: 'Fast-paced combat & reflexes' },
  { id: 'arcade', label: 'Arcade', desc: 'Classic score-chasing fun' },
];

const GOALS = [
  { id: 'collect', label: 'Collect items', icon: '🪙' },
  { id: 'survive', label: 'Survive for time', icon: '⏱️' },
  { id: 'reach', label: 'Reach the end', icon: '🏁' },
  { id: 'highscore', label: 'High score', icon: '🏆' },
  { id: 'defeat', label: 'Defeat enemies', icon: '⚔️' },
];

const DIFFICULTIES = [
  { id: 'casual', label: 'Casual', desc: 'Relaxed pace, forgiving' },
  { id: 'normal', label: 'Normal', desc: 'Balanced challenge' },
  { id: 'hard', label: 'Hard', desc: 'Punishing, high stakes' },
];

/* ─── Shared Nav ─── */
function TopNav({ step }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#e5e7e5] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1140px] items-center justify-between px-6 py-3.5 lg:px-10">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#58cc02] shadow-[0_2px_0_#46a302]">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-[22px] leading-none text-slate-800">CodeQuest</span>
        </div>

        {/* Right side — progress indicators */}
        <div className="flex items-center gap-3">
          {/* Level badge */}
          <div className="hidden items-center gap-2 rounded-full border border-[#d6eec2] bg-[#f0fbe4] px-4 py-1.5 text-[13px] font-bold text-[#3a7d0a] sm:flex">
            <Star className="h-3.5 w-3.5" />
            Level 1
            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[#d6eec2]">
              <div className="h-full w-[10%] rounded-full bg-[#58cc02]" />
            </div>
          </div>

          {/* Streak */}
          <div className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-bold text-slate-600 sm:flex">
            <Flame className="h-3.5 w-3.5 text-orange-400" /> 0
          </div>

          {/* CTA */}
          {step !== 'idea' && (
            <button className="hidden rounded-xl bg-[#58cc02] px-4 py-2 text-[13px] font-bold text-white shadow-[0_2px_0_#46a302] transition-all hover:brightness-95 active:translate-y-[1px] active:shadow-none sm:block">
              Create New Game
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/* ─── Main Component ─── */
export default function GuidedSetupFlow({ onComplete, onLaunchExample }) {
  const [step, setStep] = useState('idea');
  const [idea, setIdea] = useState('');
  const [style, setStyle] = useState('platformer');
  const [goals, setGoals] = useState(['collect']);
  const [difficulty, setDifficulty] = useState('normal');
  const formRef = useRef(null);
  const selectedProvider = getDefaultProviderName();
  const selectedModel = getDefaultModelForProvider(selectedProvider);

  const {
    plan, status, error, infeasible, suggestion, usedFallback,
    turnStats, refinementHistory,
    generatePlan, refinePlan, abort, reset,
  } = usePlanSession({ xp: 0, providerName: selectedProvider, model: selectedModel });

  // ⌘+Enter / Ctrl+Enter keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Transition from generating → review (or stay on error)
  useEffect(() => {
    if (step === 'generating' && status === 'ready') {
      setStep('review');
    }
  }, [step, status]);

  const toggleGoal = (id) => {
    setGoals((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleInitialSubmit = (e) => {
    e.preventDefault();
    if (!idea.trim()) return;
    if (idea.length < 25) {
      setStep('refine');
    } else {
      setStep('generating');
      generatePlan(idea);
    }
  };

  const handleRefineSubmit = (e) => {
    e.preventDefault();
    const selectedStyle = STYLES.find((s) => s.id === style)?.label || style;
    const selectedGoals = goals.map((g) => GOALS.find((x) => x.id === g)?.label || g);
    const selectedDifficulty = DIFFICULTIES.find((d) => d.id === difficulty)?.label || difficulty;
    const enrichedIdea = `${idea}. Style: ${selectedStyle}. Goals: ${selectedGoals.join(', ')}. Difficulty: ${selectedDifficulty}.`;
    setStep('generating');
    generatePlan(enrichedIdea);
  };

  const handleCancel = () => {
    abort();
    setStep('idea');
  };

  const handleRetry = () => {
    if (step === 'generating') {
      // Re-run the last generation
      reset();
      setStep('generating');
      generatePlan(idea);
    }
  };

  const handleUseFallback = () => {
    // Return to review with whatever plan state exists (fallback plans are set on ok:true)
    if (plan) {
      setStep('review');
    }
  };

  const selectedStyleLabel = STYLES.find((s) => s.id === style)?.label || '';
  const selectedGoalLabels = goals.map((g) => GOALS.find((x) => x.id === g)?.label).filter(Boolean);
  const selectedDiffLabel = DIFFICULTIES.find((d) => d.id === difficulty)?.label || '';

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {step !== 'review' && <TopNav step={step} />}

      {/* ═══════════════════════════════════════════
          STEP 1 — HERO IDEA INPUT
      ═══════════════════════════════════════════ */}
      {step === 'idea' && (
        <main className="h-[calc(100vh-57px)] overflow-hidden">
          <div className="mx-auto flex h-full max-w-[1140px] items-center px-6 lg:px-10">
            <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* Hero container */}
              <div className="relative overflow-hidden rounded-3xl border border-[#e0e6d8] bg-gradient-to-br from-[#fbfff6] via-white to-[#f6fbf0] p-8 shadow-[0_12px_48px_-12px_rgba(0,0,0,0.06)] md:p-10 lg:p-14">

                {/* Decorative blobs */}
                <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#58cc02]/[0.05] blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-[#1cb0f6]/[0.04] blur-3xl" />

                {/* Label */}
                <div className="relative mb-5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d6eec2] bg-white px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#4a8c12]">
                    <Sparkles className="h-3 w-3" />
                    Start New Project
                  </span>
                </div>

                {/* Headline — single line */}
                <h1 className="relative whitespace-nowrap font-display text-[2.5rem] leading-none text-slate-900 lg:text-[3rem]">
                  What game do you want to build?
                </h1>

                {/* Supporting text */}
                <p className="relative mt-3 max-w-[600px] text-base leading-relaxed text-slate-500">
                  Describe your idea and our AI will generate a playable starting point.
                </p>

                {/* Input area */}
                <form ref={formRef} onSubmit={handleInitialSubmit} className="relative mt-8">
                  <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                    <label htmlFor="idea-input" className="flex items-center gap-2 border-b border-slate-100 px-6 py-3 text-[12px] font-bold uppercase tracking-[0.1em] text-slate-400">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                      Game Idea
                    </label>
                    <textarea
                      id="idea-input"
                      autoFocus
                      value={idea}
                      onChange={(e) => setIdea(e.target.value)}
                      placeholder="I want to make a game where a bunny collects carrots and avoids rocks."
                      rows={3}
                      className="w-full resize-none bg-transparent px-6 py-4 text-[15px] leading-relaxed text-slate-800 placeholder:text-slate-300 focus:outline-none"
                    />
                  </div>

                  {/* Tip + CTA */}
                  <div className="mt-5 flex items-center justify-between gap-4">
                    <p className="text-[13px] font-medium text-slate-400">
                      {idea.length > 0
                        ? idea.length < 25
                          ? 'Keep going — mention your player, goal, and obstacles.'
                          : '✓ Looks like a solid idea'
                        : (
                          <span>
                            <span className="text-slate-500">Tip:</span> mention your player, goal, and obstacles.
                          </span>
                        )}
                    </p>
                    <div className="flex items-center gap-3">
                      <kbd className="hidden rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-400 shadow-[0_1px_0_rgba(0,0,0,0.06)] sm:inline-block">⌘ Enter</kbd>
                      <button
                        type="submit"
                        disabled={!idea.trim()}
                        className="flex items-center gap-2.5 rounded-2xl bg-[#58cc02] px-8 py-3 text-[15px] font-bold text-white shadow-[0_4px_0_#46a302] transition-all hover:brightness-95 active:translate-y-[1px] active:shadow-[0_2px_0_#46a302] disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
                      >
                        Create Plan & Start
                        <ArrowRight className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </form>

                <div className="relative mt-6 rounded-3xl border border-[#d8e7c6] bg-white/90 p-5 shadow-[0_10px_28px_-16px_rgba(88,204,2,0.45)]">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#58cc02]">Offline Example</p>
                      <h2 className="mt-1 font-display text-2xl leading-none text-slate-900">Bunny Chases Carrot</h2>
                      <p className="mt-2 max-w-[560px] text-sm font-medium leading-6 text-slate-500">
                        Open an offline starter plan for building a Bunny-and-Carrot game from scratch. It works even if the AI API is unavailable.
                      </p>
                    </div>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => onLaunchExample?.()}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[#b7d89c] bg-[#f4fce8] px-5 py-3 text-[14px] font-bold text-[#3f7f10] shadow-[0_3px_0_rgba(88,204,2,0.15)] transition-all hover:brightness-95 active:translate-y-[1px]"
                      >
                        Open Example Game
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ═══════════════════════════════════════════
          STEP 2 — GENERATING (real AI call)
      ═══════════════════════════════════════════ */}
      {step === 'generating' && (
        <main className="flex h-[calc(100vh-57px)] items-center justify-center overflow-hidden">
          <div className="animate-in fade-in zoom-in-95 duration-500 text-center">
            {status !== 'error' ? (
              <>
                <div className="relative mx-auto mb-8 flex h-16 w-16 items-center justify-center">
                  <div className="absolute inset-0 animate-ping rounded-full bg-[#58cc02] opacity-[0.1]" />
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[#58cc02] shadow-[0_3px_0_#46a302]">
                    <BrainCircuit className="h-6 w-6 animate-pulse text-white" />
                  </div>
                </div>
                <h2 className="font-display text-2xl text-slate-800">Generating your game plan…</h2>
                <p className="mt-2 text-[14px] text-slate-400">AI is thinking through your idea</p>
                <div className="mt-8 flex items-center justify-center gap-2">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[#58cc02]" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[#58cc02]" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[#58cc02]" style={{ animationDelay: '300ms' }} />
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="mt-8 flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 mx-auto"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </>
            ) : (
              <>
                <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100">
                  <BrainCircuit className="h-6 w-6 text-red-400" />
                </div>
                <h2 className="font-display text-2xl text-slate-800">Something went wrong</h2>
                <p className="mt-2 max-w-[360px] text-[14px] leading-relaxed text-slate-400">
                  {error || 'Could not generate a plan. Check your AI configuration.'}
                </p>
                <div className="mt-8 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-slate-500 transition-colors hover:bg-slate-100"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_2px_0_rgba(0,0,0,0.3)] transition-all hover:bg-slate-700"
                  >
                    Try Again
                  </button>
                  <button
                    type="button"
                    onClick={() => onLaunchExample?.()}
                    className="flex items-center gap-2 rounded-xl bg-[#f4fce8] px-5 py-2.5 text-[13px] font-bold text-[#3f7f10] shadow-[0_2px_0_rgba(88,204,2,0.18)] transition-all hover:bg-[#ebf8d8]"
                  >
                    Open Example Game
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
      )}

      {/* ═══════════════════════════════════════════
          STEP 3 — REFINE / MORE DETAILS
      ═══════════════════════════════════════════ */}
      {step === 'refine' && (
        <main className="mx-auto max-w-[1140px] px-6 py-10 lg:px-10 lg:py-14">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Step breadcrumb */}
            <div className="mb-8 flex items-center gap-3 text-[13px] font-medium text-slate-400">
              <span className="flex items-center gap-1.5 text-[#46a302]">
                <Check className="h-3.5 w-3.5" /> Idea entered
              </span>
              <span className="h-px w-5 bg-slate-200" />
              <span className="rounded-full bg-[#58cc02] px-3 py-0.5 text-[12px] font-bold text-white">2</span>
              <span className="font-semibold text-slate-700">Configure</span>
              <span className="h-px w-5 bg-slate-200" />
              <span>Generate</span>
              <span className="h-px w-5 bg-slate-200" />
              <span>Review</span>
            </div>

            {/* Page title */}
            <div className="mb-12">
              <h1 className="font-display text-[2.5rem] leading-tight text-slate-900">
                More Details
              </h1>
              <p className="mt-3 max-w-2xl text-lg leading-relaxed text-slate-500">
                Refine your idea to generate a better starting point. Select the options that best describe your game.
              </p>
            </div>

            <form onSubmit={handleRefineSubmit}>

              {/* ── Game Style ── */}
              <section className="mb-12">
                <h2 className="mb-1.5 text-sm font-bold uppercase tracking-wider text-slate-500">
                  Game Style
                </h2>
                <p className="mb-5 text-[13px] text-slate-400">Choose one</p>
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
                  {STYLES.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setStyle(opt.id)}
                      className={`group relative rounded-2xl border-2 px-6 py-5 text-left transition-all ${style === opt.id
                          ? 'border-[#58cc02] bg-[#f4fce8] shadow-[0_0_0_1px_#58cc02]'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                        }`}
                    >
                      {style === opt.id && (
                        <span className="absolute right-3.5 top-3.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#58cc02]">
                          <Check className="h-3 w-3 text-white" strokeWidth={3} />
                        </span>
                      )}
                      <span className={`block text-[15px] font-bold ${style === opt.id ? 'text-[#2d6b01]' : 'text-slate-800'}`}>
                        {opt.label}
                      </span>
                      <span className={`mt-1 block text-[13px] leading-snug ${style === opt.id ? 'text-[#4a9a0f]' : 'text-slate-400'}`}>
                        {opt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* ── Player Goal ── */}
              <section className="mb-12">
                <h2 className="mb-1.5 text-sm font-bold uppercase tracking-wider text-slate-500">
                  Player Goal
                </h2>
                <p className="mb-5 text-[13px] text-slate-400">Select up to 2</p>
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
                  {GOALS.map((opt) => {
                    const selected = goals.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleGoal(opt.id)}
                        className={`group relative rounded-2xl border-2 px-5 py-5 text-left transition-all ${selected
                            ? 'border-[#58cc02] bg-[#f4fce8] shadow-[0_0_0_1px_#58cc02]'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                          }`}
                      >
                        {selected && (
                          <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#58cc02]">
                            <Check className="h-3 w-3 text-white" strokeWidth={3} />
                          </span>
                        )}
                        <span className="mb-2 block text-xl">{opt.icon}</span>
                        <span className={`block text-[14px] font-bold leading-snug ${selected ? 'text-[#2d6b01]' : 'text-slate-700'}`}>
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* ── Difficulty ── */}
              <section className="mb-12">
                <h2 className="mb-1.5 text-sm font-bold uppercase tracking-wider text-slate-500">
                  Difficulty
                </h2>
                <p className="mb-5 text-[13px] text-slate-400">Choose one</p>
                <div className="grid grid-cols-3 gap-3.5">
                  {DIFFICULTIES.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDifficulty(opt.id)}
                      className={`group relative rounded-2xl border-2 px-6 py-5 text-left transition-all ${difficulty === opt.id
                          ? 'border-[#58cc02] bg-[#f4fce8] shadow-[0_0_0_1px_#58cc02]'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                        }`}
                    >
                      {difficulty === opt.id && (
                        <span className="absolute right-3.5 top-3.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#58cc02]">
                          <Check className="h-3 w-3 text-white" strokeWidth={3} />
                        </span>
                      )}
                      <span className={`block text-[15px] font-bold ${difficulty === opt.id ? 'text-[#2d6b01]' : 'text-slate-800'}`}>
                        {opt.label}
                      </span>
                      <span className={`mt-1 block text-[13px] leading-snug ${difficulty === opt.id ? 'text-[#4a9a0f]' : 'text-slate-400'}`}>
                        {opt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* ── Configuration Summary ── */}
              <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="mb-5 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Configuration Summary
                </p>
                <div className="grid grid-cols-3 gap-8">
                  <div>
                    <p className="text-[12px] font-medium text-slate-400">Style</p>
                    <p className="mt-1 text-[16px] font-bold text-slate-800">{selectedStyleLabel}</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-slate-400">Goal</p>
                    <p className="mt-1 text-[16px] font-bold text-slate-800">{selectedGoalLabels.join(' + ') || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-slate-400">Difficulty</p>
                    <p className="mt-1 text-[16px] font-bold text-slate-800">{selectedDiffLabel}</p>
                  </div>
                </div>
              </section>

              {/* ── Actions ── */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-7">
                <button
                  type="button"
                  onClick={() => setStep('idea')}
                  className="flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2.5 rounded-2xl bg-[#58cc02] px-8 py-3.5 text-[16px] font-bold text-white shadow-[0_4px_0_#46a302] transition-all hover:brightness-95 active:translate-y-[1px] active:shadow-[0_2px_0_#46a302]"
                >
                  <Zap className="h-5 w-5" />
                  Generate Game
                </button>
              </div>
            </form>
          </div>
        </main>
      )}

      {/* ═══════════════════════════════════════════
          STEP 4 — REVIEW & REFINE
      ═══════════════════════════════════════════ */}
      {step === 'review' && plan && (
        <PlanReview
          plan={plan}
          infeasible={infeasible}
          suggestion={suggestion}
          usedFallback={usedFallback}
          turnStats={turnStats}
          refinementHistory={refinementHistory}
          isRefining={status === 'refining'}
          onRefine={refinePlan}
          onAccept={() => onComplete({ idea, plan, selectedProvider, selectedModel })}
          onBack={() => { reset(); setStep('idea'); }}
        />
      )}
    </div>
  );
}
