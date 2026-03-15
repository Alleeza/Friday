import { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, Lightbulb, BrainCircuit, Zap, Check, Flame, Star, X } from 'lucide-react';
import { usePlanSession } from '../hooks/usePlanSession.js';
import PlanReview from './PlanReview.jsx';
import questyImage from '../imgages/profile.png';
import questyHeroImage from '../imgages/Questy_Full_Body-removebg-preview.png';
import {
  getDefaultModelForProvider,
  getDefaultProviderName,
} from '../ai/providerCatalog.js';

/* ─── Option data ─── */
const STYLES = [
  { id: 'platformer', label: 'Platformer', icon: '🦘', desc: 'Side-scrolling jump & run' },
  { id: 'puzzle', label: 'Puzzle', icon: '🧩', desc: 'Logic and problem solving' },
  { id: 'action', label: 'Action', icon: '⚡', desc: 'Fast-paced combat & reflexes' },
  { id: 'arcade', label: 'Arcade', icon: '🕹️', desc: 'Classic score-chasing fun' },
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

const questyWaveAnimation = {
  animation: 'questy-wave 2.6s ease-in-out infinite',
  transformOrigin: '72% 48%',
};

/* ─── Shared Nav ─── */
function TopNav({ step, onGoHome }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#e5e7e5] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1140px] items-center justify-between px-6 py-3.5 lg:px-10">
        {/* Logo */}
        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center gap-3 rounded-2xl transition hover:opacity-85"
        >
          <img
            src={questyImage}
            alt="Questy avatar"
            className="h-12 w-auto rounded-xl object-contain mix-blend-multiply"
          />
          <span className="font-display text-[24px] font-bold leading-none tracking-[-0.02em] text-slate-800">CodeQuest</span>
        </button>

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
            <button
              type="button"
              onClick={onGoHome}
              className="hidden items-center gap-2 rounded-2xl bg-[#58cc02] px-5 py-2.5 text-[14px] font-extrabold text-white shadow-[0_3px_0_#46a302] transition-all hover:brightness-95 active:translate-y-[1px] active:shadow-none sm:inline-flex"
            >
              <span className="text-[18px] leading-none">+</span>
              Create New Game
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/* ─── Main Component ─── */
export default function GuidedSetupFlow({ onComplete, onLaunchExample, onGoHome }) {
  const [step, setStep] = useState('idea');
  const [idea, setIdea] = useState('');
  const [style, setStyle] = useState('platformer');
  const [goals, setGoals] = useState(['collect']);
  const [difficulty, setDifficulty] = useState('normal');
  const [showExamples, setShowExamples] = useState(false);
  const formRef = useRef(null);
  const examplesRef = useRef(null);
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

  useEffect(() => {
    if (step !== 'idea') {
      setShowExamples(false);
      return;
    }
    const section = examplesRef.current;
    if (!section || typeof IntersectionObserver === 'undefined') {
      setShowExamples(true);
      return;
    }

    setShowExamples(false);
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        setShowExamples(true);
        observer.disconnect();
      },
      {
        threshold: 0.18,
        rootMargin: '0px 0px -8% 0px',
      },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [step]);

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

  const handleGoHome = () => {
    reset();
    setStep('idea');
    onGoHome?.();
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
      {step !== 'review' && <TopNav step={step} onGoHome={handleGoHome} />}

      {/* ═══════════════════════════════════════════
          STEP 1 — HERO IDEA INPUT
      ═══════════════════════════════════════════ */}
      {step === 'idea' && (
        <main className="min-h-[calc(100vh-57px)] overflow-hidden bg-[radial-gradient(circle_at_top,#f2ffe6_0%,#ffffff_38%,#f8fcff_100%)]">
          <div className="mx-auto flex h-full max-w-[1140px] items-center justify-center px-6 py-8 lg:px-10">
            <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-2 md:p-4">
                <div className="mx-auto flex max-w-[1280px] flex-col items-center px-5 py-4 text-center sm:px-8 sm:py-6">
                  <style>{`
                    @keyframes questy-wave {
                      0%, 100% { transform: rotate(0deg) translateY(0); }
                      15% { transform: rotate(5deg) translateY(-1px); }
                      30% { transform: rotate(-4deg) translateY(0); }
                      45% { transform: rotate(6deg) translateY(-2px); }
                      60% { transform: rotate(-3deg) translateY(0); }
                      75% { transform: rotate(3deg) translateY(-1px); }
                    }

                    @keyframes example-fade-in {
                      from { opacity: 0; }
                      to { opacity: 1; }
                    }

                  `}</style>
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d9efc0] bg-[#f4fce8] px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#4a8c12] shadow-[0_3px_0_rgba(88,204,2,0.12)]">
                    <Sparkles className="h-4 w-4" />
                    Let’s Build Something Fun
                  </div>
                  <div className="mb-5">
                    <img
                      src={questyHeroImage}
                      alt="Questy avatar"
                      className="h-48 w-auto object-contain mix-blend-multiply drop-shadow-[0_16px_24px_rgba(37,168,239,0.14)] sm:h-56"
                      style={questyWaveAnimation}
                    />
                  </div>

                  <h1 className="whitespace-nowrap font-display text-[1.95rem] font-extrabold leading-[0.96] tracking-[-0.03em] text-[#58cc02] [text-shadow:0_2px_0_rgba(70,163,2,0.18)] sm:text-[2.35rem] lg:text-[3.15rem]">
                    What game do you want to build?
                  </h1>
                  <p className="mt-3 max-w-[620px] text-[16px] font-medium leading-7 text-slate-500 sm:text-[17px]">
                    Tell Questy your idea and we&apos;ll turn it into a playful starter plan with assets, goals, and first steps.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 text-[13px] font-bold text-slate-600">
                    <span className="rounded-full border border-[#d8e9f7] bg-[#f8fcff] px-3 py-1.5 shadow-[0_2px_0_rgba(37,168,239,0.08)]">🐰 Character</span>
                    <span className="rounded-full border border-[#d8e9f7] bg-[#f8fcff] px-3 py-1.5 shadow-[0_2px_0_rgba(37,168,239,0.08)]">🏁 Goal</span>
                    <span className="rounded-full border border-[#d8e9f7] bg-[#f8fcff] px-3 py-1.5 shadow-[0_2px_0_rgba(37,168,239,0.08)]">🪨 Obstacle</span>
                  </div>

                  <form ref={formRef} onSubmit={handleInitialSubmit} className="mt-6 w-full max-w-[1040px]">
                    <div className="overflow-hidden rounded-[32px] border-2 border-[#d7e3f0] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_12px_0_rgba(15,23,42,0.04)]">
                      <label htmlFor="idea-input" className="flex items-center gap-2 border-b border-[#edf1f7] px-6 py-4 text-left text-[13px] font-extrabold uppercase tracking-[0.12em] text-[#8fa0ba]">
                        <Lightbulb className="h-4 w-4 text-amber-400" />
                        Game Idea
                      </label>
                      <textarea
                        id="idea-input"
                        autoFocus
                        value={idea}
                        onChange={(e) => setIdea(e.target.value)}
                        placeholder="Describe your game idea. Example: a bunny collects carrots, avoids rocks, and reaches the finish line."
                        rows={3}
                        className="w-full resize-none bg-transparent px-6 py-4 text-[18px] leading-8 text-slate-800 placeholder:text-slate-300 focus:outline-none"
                      />
                      <div className="flex flex-col gap-4 border-t border-[#edf1f7] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="rounded-2xl border border-[#d8e9f7] bg-[#f8fcff] px-4 py-3 text-left text-[14px] font-semibold text-slate-500 shadow-[0_2px_0_rgba(28,176,246,0.08)]">
                          {idea.length > 0
                            ? idea.length < 25
                              ? 'Keep going: include your character, goal, and one obstacle.'
                              : 'Nice. That idea has enough detail for a strong setup plan.'
                            : 'Tip: mention your player, goal, and obstacles for the best result.'}
                        </div>

                        <div className="flex items-center gap-3 self-end">
                          <kbd className="hidden rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-400 shadow-[0_2px_0_rgba(15,23,42,0.05)] sm:inline-block">
                            ⌘ Enter
                          </kbd>
                          <button
                            type="submit"
                            disabled={!idea.trim()}
                            className="inline-flex items-center gap-2.5 rounded-[20px] bg-[#58cc02] px-8 py-4 text-[16px] font-extrabold text-white shadow-[0_5px_0_#46a302] transition-all hover:brightness-95 active:translate-y-[1px] active:shadow-[0_3px_0_#46a302] disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
                          >
                            Create Plan & Start
                            <ArrowRight className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>

                  <section
                    ref={examplesRef}
                    className={`mt-20 w-[min(1320px,calc(100vw-2.5rem))] max-w-none text-left ${showExamples ? 'motion-safe:animate-[example-fade-in_700ms_ease-out_forwards]' : 'opacity-0'}`}
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h2 className="font-display text-[1.65rem] font-extrabold tracking-[-0.02em] text-slate-900">Example Games</h2>
                        <p className="mt-1 text-[15px] font-medium text-slate-500">Start with a playful template and remix it your way.</p>
                      </div>
                    </div>
                    <div className="grid justify-items-center gap-1.5 xl:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => onLaunchExample?.('bunny')}
                        className="w-full max-w-[650px] rounded-[28px] border-2 border-[#d7ecc2] bg-white/95 p-4 text-left shadow-[0_10px_28px_-16px_rgba(88,204,2,0.4)] transition hover:-translate-y-0.5 hover:bg-[#f8fdea] hover:shadow-[0_16px_36px_-18px_rgba(88,204,2,0.45)]"
                      >
                        <div className="flex flex-col gap-4">
                          <div className="flex items-start gap-3">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#cfe8b7] bg-[#e8f7d3] text-[26px] shadow-[0_4px_0_rgba(88,204,2,0.14)]">
                              <span aria-hidden="true">🐰</span>
                            </span>
                            <div className="min-w-0 pt-1">
                              <h3 className="font-display text-[1.75rem] font-bold leading-none tracking-[-0.02em] text-slate-900">Bunny Chases Carrot</h3>
                              <p className="mt-2 text-[15px] font-medium leading-6 text-slate-500">
                                Scoop up carrots, dodge trouble, and race to the finish.
                              </p>
                            </div>
                          </div>

                          <div className="overflow-hidden rounded-[24px] border border-[#e5edf5] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] shadow-[inset_0_-2px_0_rgba(148,163,184,0.08)]">
                            <div className="border-b border-[#edf2f7] px-4 py-2.5">
                              <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#8fa0ba]">Preview</p>
                            </div>
                            <div className="grid gap-3 p-4 md:grid-cols-[1.32fr_0.68fr]">
                              <div className="rounded-[20px] border border-[#d8e9f7] bg-[#f8fcff] p-3.5">
                                <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#1b97dd]">Goals</p>
                                <div className="mt-2.5 space-y-2 text-[15px] font-bold text-slate-600">
                                  <div className="rounded-2xl bg-white px-3 py-2 shadow-[0_2px_0_rgba(15,23,42,0.04)]">🥕 Snag the carrot before time runs out</div>
                                  <div className="rounded-2xl bg-white px-3 py-2 shadow-[0_2px_0_rgba(15,23,42,0.04)]">🪨 Swerve around rocky obstacles</div>
                                  <div className="rounded-2xl bg-white px-3 py-2 shadow-[0_2px_0_rgba(15,23,42,0.04)]">🏁 Hop to the goal flag to win</div>
                                </div>
                              </div>
                              <div className="rounded-[20px] border border-[#dceac8] bg-[#f4fce8] p-3.5">
                                <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#4a8c12]">Starter Assets</p>
                                <div className="mt-2.5 flex flex-wrap gap-2 text-[15px] font-bold text-[#3f7f10]">
                                  <span className="rounded-full bg-white px-3 py-2 shadow-[0_2px_0_rgba(88,204,2,0.08)]">🐰 Bunny</span>
                                  <span className="rounded-full bg-white px-3 py-2 shadow-[0_2px_0_rgba(88,204,2,0.08)]">🥕 Carrot</span>
                                  <span className="rounded-full bg-white px-3 py-2 shadow-[0_2px_0_rgba(88,204,2,0.08)]">🪨 Rock</span>
                                  <span className="rounded-full bg-white px-3 py-2 shadow-[0_2px_0_rgba(88,204,2,0.08)]">🏁 Goal</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 text-[15px] font-extrabold text-[#3f7f10]">
                            Play Bunny Example
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => onLaunchExample?.('crossy')}
                        className="w-full max-w-[650px] rounded-[28px] border-2 border-[#d8e9f7] bg-white/95 p-4 text-left shadow-[0_10px_28px_-16px_rgba(37,168,239,0.3)] transition hover:-translate-y-0.5 hover:bg-[#f2faff] hover:shadow-[0_16px_36px_-18px_rgba(37,168,239,0.4)]"
                      >
                        <div className="flex flex-col gap-4">
                          <div className="flex items-start gap-3">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#cfe7fb] bg-[#e7f5ff] text-[26px] shadow-[0_4px_0_rgba(37,168,239,0.14)]">
                              <span aria-hidden="true">🚗</span>
                            </span>
                            <div className="min-w-0 pt-1">
                              <h3 className="font-display text-[1.75rem] font-bold leading-none tracking-[-0.02em] text-slate-900">Crossy Road Dash</h3>
                              <p className="mt-2 text-[15px] font-medium leading-6 text-slate-500">
                                Zig-zag through danger lanes and dash for the finish line.
                              </p>
                            </div>
                          </div>

                          <div className="overflow-hidden rounded-[24px] border border-[#e5edf5] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] shadow-[inset_0_-2px_0_rgba(148,163,184,0.08)]">
                            <div className="border-b border-[#edf2f7] px-4 py-2.5">
                              <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#8fa0ba]">Preview</p>
                            </div>
                            <div className="grid gap-3 p-4 md:grid-cols-[1.32fr_0.68fr]">
                              <div className="rounded-[20px] border border-[#d8e9f7] bg-[#f8fcff] p-3.5">
                                <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#1b97dd]">Goals</p>
                                <div className="mt-2.5 space-y-2 text-[15px] font-bold text-slate-600">
                                  <div className="rounded-2xl bg-white px-3 py-2 shadow-[0_2px_0_rgba(15,23,42,0.04)]">🚗 Dodge the road hazards and blocked lanes</div>
                                  <div className="rounded-2xl bg-white px-3 py-2 shadow-[0_2px_0_rgba(15,23,42,0.04)]">⌨️ Use the keyboard to guide your bunny</div>
                                  <div className="rounded-2xl bg-white px-3 py-2 shadow-[0_2px_0_rgba(15,23,42,0.04)]">🏁 Reach the far-side goal without crashing</div>
                                </div>
                              </div>
                              <div className="rounded-[20px] border border-[#d8e9f7] bg-[#eef8ff] p-3.5">
                                <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#1b97dd]">Starter Assets</p>
                                <div className="mt-2.5 flex flex-wrap gap-2 text-[15px] font-bold text-[#246ea5]">
                                  <span className="rounded-full bg-white px-3 py-2 shadow-[0_2px_0_rgba(37,168,239,0.08)]">🐰 Bunny</span>
                                  <span className="rounded-full bg-white px-3 py-2 shadow-[0_2px_0_rgba(37,168,239,0.08)]">🪨 Rock</span>
                                  <span className="rounded-full bg-white px-3 py-2 shadow-[0_2px_0_rgba(37,168,239,0.08)]">🏁 Goal</span>
                                  <span className="rounded-full bg-white px-3 py-2 shadow-[0_2px_0_rgba(37,168,239,0.08)]">⌨️ Key Press</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 text-[15px] font-extrabold text-[#1b97dd]">
                            Play Crossy Example
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      </button>
                    </div>
                  </section>
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
              <h1 className="font-display text-[2.5rem] font-bold leading-tight text-slate-900">
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
                      <span className="mb-2 block text-[22px] leading-none">{opt.icon}</span>
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
