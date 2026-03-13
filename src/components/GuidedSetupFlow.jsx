import { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Lightbulb, Gamepad2, Target, BrainCircuit, Loader2 } from 'lucide-react';

export default function GuidedSetupFlow({ onComplete }) {
  const [step, setStep] = useState('idea'); // 'idea', 'analyzing', 'refine'
  const [idea, setIdea] = useState('');
  
  // Refinement fields
  const [style, setStyle] = useState('Platformer');
  const [difficulty, setDifficulty] = useState('Casual');
  const [goal, setGoal] = useState('Collect all items');

  const [loadingText, setLoadingText] = useState('Analyzing idea...');

  const handleInitialSubmit = (e) => {
    e.preventDefault();
    if (!idea.trim()) return;
    
    setStep('analyzing');
    setLoadingText('Analyzing your game idea...');
    
    // Simulate analyzing the idea
    setTimeout(() => {
      if (idea.length < 25) {
        setStep('refine');
      } else {
        setLoadingText('Generating sandbox environment...');
        setTimeout(() => {
          onComplete({ idea });
        }, 1200);
      }
    }, 1500);
  };

  const handleRefineSubmit = (e) => {
    e.preventDefault();
    setStep('analyzing');
    setLoadingText('Synthesizing requirements...');
    
    setTimeout(() => {
      setLoadingText('Generating sandbox environment...');
      setTimeout(() => {
        onComplete({ idea, style, difficulty, goal });
      }, 1500);
    }, 1500);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      {/* Top Left Logo */}
      <div className="absolute left-6 top-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#58cc02] shadow-[0_4px_0_#49a300]">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <h1 className="font-display text-2xl text-slate-800">CodeQuest</h1>
      </div>

      <div className="w-full max-w-2xl">
        
        {/* Header Section */}
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-display text-slate-800 mb-2">
            {step === 'idea' && "What do you want to build?"}
            {step === 'analyzing' && "Processing..."}
            {step === 'refine' && "More Details"}
          </h2>
          <p className="text-lg font-semibold text-slate-500">
            {step === 'idea' && "Let's turn your idea into a playable sandbox."}
            {step === 'analyzing' && "Thinking about the best approach..."}
            {step === 'refine' && "We need a bit more detail to make it great."}
          </p>
        </div>

        {/* Step 1: Idea Input */}
        {step === 'idea' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <form onSubmit={handleInitialSubmit} className="rounded-[32px] border-2 border-[#e5e7eb] bg-white p-6 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.08)] transition-all focus-within:border-[#1cb0f6] focus-within:shadow-[0_12px_40px_-12px_rgba(28,176,246,0.15)] md:p-8">
              <label htmlFor="idea-input" className="mb-4 flex items-center gap-2 text-lg font-extrabold text-slate-700">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                Describe your game idea
              </label>
              <textarea
                id="idea-input"
                autoFocus
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="e.g. A game where a bunny jumps over crabs and collects glowing coins..."
                rows={4}
                className="w-full resize-none rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-lg font-semibold text-slate-700 placeholder:text-slate-400 focus:border-[#1cb0f6] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#1cb0f6]/10"
              />
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-400">
                  {idea.length > 0 ? (idea.length < 25 ? 'Keep going... a bit more detail helps!' : 'Looks like a solid idea!') : 'Start typing...'}
                </p>
                <button
                  type="submit"
                  disabled={!idea.trim()}
                  className="duo-btn-blue flex items-center gap-2 rounded-2xl px-6 py-3 text-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Generate Plan
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Analyzing / Loading */}
        {step === 'analyzing' && (
          <div className="flex animate-in fade-in zoom-in-95 duration-500 flex-col items-center justify-center rounded-[32px] border-2 border-[#e5e7eb] bg-white p-12 text-center shadow-[0_12px_40px_-12px_rgba(0,0,0,0.08)]">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-[#1cb0f6] opacity-20"></div>
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1cb0f6] shadow-[0_4px_0_#1899d6]">
                <BrainCircuit className="h-8 w-8 animate-pulse text-white" />
              </div>
            </div>
            <h3 className="mt-6 font-display text-2xl text-slate-800">{loadingText}</h3>
            <p className="mt-2 font-semibold text-slate-500">Designing logic blocks and state...</p>
          </div>
        )}

        {/* Step 3: Refinement Questions */}
        {step === 'refine' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <form onSubmit={handleRefineSubmit} className="rounded-[32px] border-2 border-[#e5e7eb] bg-white p-6 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.08)] md:p-8">
              <div className="mb-6 rounded-2xl bg-amber-50 p-4 text-amber-800 border-2 border-amber-200/50">
                <p className="font-semibold"><strong>"{idea}"</strong> is a bit concise. Let's flesh it out to generate the best starting point.</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">
                    <Gamepad2 className="h-4 w-4 text-purple-500" /> Game Style
                  </label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {['Platformer', 'Puzzle', 'Action', 'Arcade'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setStyle(opt)}
                        className={`rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition-all ${
                          style === opt
                            ? 'border-[#a855f7] bg-[#f3e8ff] text-[#7e22ce] shadow-[inset_0_-2px_0_rgba(168,85,247,0.3)]'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">
                    <Target className="h-4 w-4 text-rose-500" /> Player Goal
                  </label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {['Collect all items', 'Survive for time', 'Reach the end', 'High score', 'Defeat enemies'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setGoal(opt)}
                        className={`rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition-all ${
                          goal === opt
                            ? 'border-[#f43f5e] bg-[#ffe4e6] text-[#be123c] shadow-[inset_0_-2px_0_rgba(244,63,94,0.3)]'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">
                    Difficulty Level
                  </label>
                  <div className="flex rounded-xl bg-slate-100 p-1">
                    {['Casual', 'Normal', 'Hard'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setDifficulty(opt)}
                        className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all ${
                          difficulty === opt
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between border-t-2 border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={() => setStep('idea')}
                  className="rounded-2xl px-6 py-3 font-bold text-slate-500 hover:bg-slate-100"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="duo-btn-green flex items-center gap-2 rounded-2xl px-8 py-3 text-lg"
                >
                  Generate Now
                  <Sparkles className="h-5 w-5" />
                </button>
              </div>
            </form>
          </div>
        )}
        
      </div>
    </div>
  );
}
