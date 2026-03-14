import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStepDetection } from '../hooks/useStepDetection.js';
import { buildContext } from '../ai/context/contextBuilder.js';
import { sandboxAssets } from '../data/sandboxAssets.js';
import { evaluateStepChecks } from '../utils/stepChecker.js';
import { ArrowRight, Flame, Star } from 'lucide-react';
import questyImage from '../imgages/profile.png';

const STAGE_GRAPHICS = ['🐰', '🕹️', '🥕', '🪨', '🛠️'];

function TopNav({ onCreateNewGame }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#e5e7e5] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3.5 lg:px-6">
        <div className="flex items-center gap-3">
          <img
            src={questyImage}
            alt="Questy avatar"
            className="h-12 w-auto rounded-xl object-contain"
          />
          <span className="font-display text-[24px] font-bold leading-none tracking-[-0.02em] text-slate-800">CodeQuest</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-[#d6eec2] bg-[#f0fbe4] px-4 py-1.5 text-[13px] font-bold text-[#3a7d0a] sm:flex">
            <Star className="h-3.5 w-3.5" />
            Level 1
            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[#d6eec2]">
              <div className="h-full w-[10%] rounded-full bg-[#58cc02]" />
            </div>
          </div>

          <div className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-bold text-slate-600 sm:flex">
            <Flame className="h-3.5 w-3.5 text-orange-400" /> 0
          </div>

          <button
            type="button"
            onClick={onCreateNewGame}
            className="hidden items-center gap-2 rounded-2xl bg-[#58cc02] px-5 py-2.5 text-[14px] font-extrabold text-white shadow-[0_3px_0_#46a302] transition-all hover:brightness-95 active:translate-y-[1px] active:shadow-none sm:inline-flex"
          >
            <span className="text-[18px] leading-none">+</span>
            Create New Game
          </button>
        </div>
      </div>
    </header>
  );
}

function buildStepDebugInfo(currentStage, workspaceState, completedStepKeys, manualStepKeys) {
  if (!currentStage || !workspaceState) return [];

  return currentStage.steps.map((stepText, stepIndex) => {
    const stepKey = `${currentStage.id}:${stepIndex}`;
    const checks = currentStage.stepChecks?.[stepIndex] ?? [];
    const evaluation = checks.length > 0
      ? evaluateStepChecks(checks, workspaceState)
      : { passed: false, pendingAiChecks: [] };
    const programmaticChecks = checks.filter((check) => check?.type !== 'aiCheck');
    const programmaticEvaluation = programmaticChecks.length > 0
      ? evaluateStepChecks(programmaticChecks, workspaceState)
      : { passed: true, pendingAiChecks: [] };

    return {
      stepIndex,
      stepKey,
      stepText,
      checks,
      isCompleted: Boolean(completedStepKeys[stepKey]),
      evaluation: {
        passed: evaluation.passed,
        pendingAiChecks: evaluation.pendingAiChecks,
        programmaticPassed: programmaticEvaluation.passed,
      },
    };
  });
}

function buildStageProgress(plan, completedStepKeys) {
  const stages = plan.stages.map((stage, index) => ({
    ...stage,
    title: stage.label,
    graphic: STAGE_GRAPHICS[index % STAGE_GRAPHICS.length],
    optionalSteps: (stage.optionalSteps || []).map((step) => ({
      text: step.description,
      xp: step.bonusXp,
    })),
    stepHelp: stage.steps.map(() => stage.why),
  }));

  const stageStepStatuses = stages.map((stage) =>
    stage.steps.map((_, stepIndex) => Boolean(completedStepKeys[`${stage.id}:${stepIndex}`])),
  );
  const stageRequiredCompletedCounts = stageStepStatuses.map((statuses) => statuses.filter(Boolean).length);
  const stageLeadingCompletedCounts = stageStepStatuses.map((statuses) => statuses.findIndex((value) => !value));
  const normalizedLeadingCompletedCounts = stageLeadingCompletedCounts.map((count, stageIndex) => (
    count === -1 ? stages[stageIndex].steps.length : count
  ));

  const done = stageStepStatuses.map((statuses) => statuses.every(Boolean));
  const currentIndex = Math.max(0, done.findIndex((value) => !value));
  const safeCurrentIndex = done.every(Boolean) ? Math.max(0, stages.length - 1) : currentIndex;
  const currentStage = stages[safeCurrentIndex];
  const currentStageCompletedCount = stageRequiredCompletedCounts[safeCurrentIndex] ?? 0;
  const currentStageLeadingCompletedCount = normalizedLeadingCompletedCounts[safeCurrentIndex] ?? 0;
  const currentStageStepIndex = Math.min(currentStageLeadingCompletedCount, Math.max((currentStage?.steps.length || 1) - 1, 0));

  const earnedRequiredXp = stages.reduce(
    (sum, stage, stageIndex) =>
      sum + stage.stepXp.reduce(
        (stageSum, xp, stepIndex) => stageSum + (stageStepStatuses[stageIndex][stepIndex] ? xp : 0),
        0,
      ),
    0,
  );
  const totalRequiredXp = stages.reduce((sum, stage) => sum + stage.stepXp.reduce((stageSum, xp) => stageSum + xp, 0), 0);
  const totalSteps = stages.reduce((sum, stage) => sum + stage.steps.length, 0);
  const completedSteps = stageRequiredCompletedCounts.reduce((sum, count) => sum + count, 0);
  const progressPct = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return {
    stages,
    done,
    currentIndex: safeCurrentIndex,
    currentStage,
    currentStageCompletedCount,
    currentStageStepIndex,
    progressPct,
    earnedRequiredXp,
    totalRequiredXp,
  };
}

function StepRow({ active, done, label, xp, onClick, tone = 'step' }) {
  const palette = tone === 'bonus'
    ? {
        done: 'border-[#8fd0f8] bg-[#dff3ff] text-[#166b9a]',
        active: 'border-[#25a8ef] bg-[#25a8ef] text-white',
        idle: 'border-[#c7d5e7] bg-[#edf4ff] text-[#4b5f7a]',
        badgeDone: 'border-[#25a8ef] bg-[#25a8ef] text-white',
        badgeActive: 'border-white bg-white text-[#25a8ef]',
        badgeIdle: 'border-[#8fb5de] bg-white text-[#8fb5de]',
      }
    : {
        done: 'border-[#bfe7a1] bg-[#f3ffe8] text-[#3f7f13]',
        active: 'border-[#58cc02] bg-[#58cc02] text-white',
        idle: 'border-[#d7dbe1] bg-[#f5f7fb] text-slate-500',
        badgeDone: 'border-duo-green bg-duo-green text-white',
        badgeActive: 'border-white bg-white text-duo-green',
        badgeIdle: 'border-slate-300 bg-white text-slate-400',
      };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-2 rounded-2xl border px-4 py-2.5 text-left text-sm font-semibold ${
        done
          ? palette.done
          : active
            ? palette.active
            : palette.idle
      }`}
    >
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 text-[10px] font-bold ${
          done
            ? palette.badgeDone
            : active
              ? palette.badgeActive
              : palette.badgeIdle
        }`}
      >
        {done ? (tone === 'bonus' ? '★' : '✓') : ''}
      </span>
      <span className={`flex-1 ${active ? 'font-bold' : ''}`}>{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${done || active ? 'bg-white/90 text-[#4b5563]' : 'bg-white text-slate-500'}`}>
        +{xp} XP
      </span>
    </button>
  );
}

export function StageProgressSection({ setupData, plan, workspaceState = null, provider = null }) {
  const [completedStepKeys, setCompletedStepKeys] = useState({});
  const [showSteps, setShowSteps] = useState(false);
  const [showBonusQuests, setShowBonusQuests] = useState(false);
  const [selectedItem, setSelectedItem] = useState({ type: 'step', index: 0 });

  const {
    stages,
    done,
    currentIndex,
    currentStage,
    currentStageCompletedCount,
    currentStageStepIndex,
    progressPct,
    earnedRequiredXp,
    totalRequiredXp,
  } = useMemo(() => buildStageProgress(plan, completedStepKeys), [plan, completedStepKeys]);

  const safeStepIndex = Math.min(currentStageStepIndex, Math.max((currentStage?.steps.length || 1) - 1, 0));
  const activeLinePct = stages.length ? ((Math.max(currentIndex, 0) + 0.5) / stages.length) * 100 : 0;
  const visibleSteps = showSteps
    ? (currentStage?.steps || []).map((step, index) => ({ step, index }))
    : (currentStage?.steps?.length ? [{ step: currentStage.steps[safeStepIndex], index: safeStepIndex }] : []);
  const selectedStepIndex = selectedItem.type === 'step'
    ? Math.min(selectedItem.index, Math.max((currentStage?.steps.length || 1) - 1, 0))
    : safeStepIndex;
  const selectedBonusIndex = selectedItem.type === 'bonus'
    ? Math.min(selectedItem.index, Math.max((currentStage?.optionalSteps?.length || 1) - 1, 0))
    : 0;
  const selectedBonus = currentStage?.optionalSteps?.[selectedBonusIndex] || null;
  const selectedTitle = selectedItem.type === 'bonus'
    ? selectedBonus?.text
    : currentStage?.steps?.[selectedStepIndex] || currentStage?.objective;
  const selectedDescription = selectedItem.type === 'bonus'
    ? `Optional stretch goal for ${currentStage?.label?.toLowerCase()}. ${currentStage?.why || ''}`.trim()
    : currentStage?.stepHelp?.[selectedStepIndex] || currentStage?.why;

  useEffect(() => {
    setSelectedItem({ type: 'step', index: safeStepIndex });
  }, [currentStage?.id, safeStepIndex]);

  // Callbacks for the detection hook — stable refs via useCallback
  const handleStepAutoCompleted = useCallback((stepKey) => {
    setCompletedStepKeys((prev) => ({ ...prev, [stepKey]: true }));
  }, []);

  const handleStepAutoReverted = useCallback((stepKey) => {
    setCompletedStepKeys((prev) => {
      if (!prev[stepKey]) return prev;
      const next = { ...prev };
      delete next[stepKey];
      return next;
    });
  }, []);

  useStepDetection({
    provider,
    currentStage,
    workspaceState,
    completedStepKeys,
    onStepAutoCompleted: handleStepAutoCompleted,
    onStepAutoReverted: handleStepAutoReverted,
  });

  const stepDebugInfo = useMemo(
    () => buildStepDebugInfo(currentStage, workspaceState, completedStepKeys),
    [currentStage, workspaceState, completedStepKeys],
  );

  const workspaceDebugText = useMemo(() => {
    if (!workspaceState) return 'No workspace state available yet.';
    return buildContext({
      sceneInstances: workspaceState.sceneInstances ?? [],
      scriptsByInstanceKey: workspaceState.scriptsByInstanceKey ?? {},
      runtimeSnapshot: workspaceState.runtimeSnapshot ?? null,
      availableAssets: sandboxAssets,
      mode: workspaceState.runtimeSnapshot ? 'play' : 'edit',
    });
  }, [workspaceState]);

  useEffect(() => {
    if (!currentStage || !workspaceState) return;

    console.groupCollapsed(`[Step Debug] ${currentStage.label}`);
    console.debug('Canvas and workspace snapshot');
    console.debug(workspaceDebugText);
    console.debug('Stage metadata', {
      stageId: currentStage.id,
      stageLabel: currentStage.label,
      objective: currentStage.objective,
      success: currentStage.success,
      steps: currentStage.steps,
      stepChecks: currentStage.stepChecks,
    });
    console.debug('Step evaluation', stepDebugInfo);
    console.groupEnd();
  }, [currentStage, workspaceState, workspaceDebugText, stepDebugInfo]);

  return (
    <section className="quest-card w-full border border-[#e3e6eb] bg-[#f8fafc] p-4 shadow-[0_4px_0_rgba(148,163,184,0.1)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-3 pl-1">
          <h2 className="font-display text-3xl font-bold leading-none text-slate-800">Stage Progress</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-[#8fd0f8] bg-[#d9f0ff] px-4 py-1 text-sm font-extrabold text-[#1b97dd]">
            Stage {Math.min(currentIndex + 1, stages.length)} of {stages.length}
          </div>
          <div className="rounded-full border border-[#d3d7dd] bg-white px-4 py-1 text-sm font-extrabold text-slate-600">{progressPct}% complete</div>
          <div className="rounded-full border border-[#bde59f] bg-[#eefadb] px-4 py-1 text-sm font-extrabold text-[#3f7f13]">
            XP {earnedRequiredXp}/{totalRequiredXp}
          </div>
        </div>
      </div>

      <div className="relative mb-4 px-2">
        <div className="absolute left-2 right-2 top-5 h-[4px] rounded-full bg-[#d4dce6]" />
        <div className="absolute left-2 top-5 h-[4px] rounded-full bg-[#25a8ef] transition-all" style={{ width: `${activeLinePct}%` }} />

        <div
          className="relative grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.max(stages.length, 1)}, minmax(0, 1fr))` }}
        >
          {stages.map((stage, idx) => {
            const isDone = done[idx];
            const isActive = idx === currentIndex || (done.every(Boolean) && idx === stages.length - 1);
            return (
              <div key={stage.id} className="text-center">
                <div
                  className={`mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full border-[3px] text-sm font-extrabold ${
                    isDone
                      ? 'border-[#58cc02] bg-[#58cc02] text-white shadow-sm'
                      : isActive
                        ? 'border-[#25a8ef] bg-white text-[#25a8ef] shadow-sm'
                        : 'border-[#b9c4d2] bg-white text-[#8f9cad]'
                  }`}
                >
                  {isDone ? '✓' : idx + 1}
                </div>
                <p className={`text-[12px] font-bold leading-tight ${isActive ? 'text-[#25a8ef]' : 'text-slate-600'}`}>
                  {`Stage ${idx + 1}: ${stage.label}`}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <article className="rounded-3xl border border-[#d4d9df] bg-white p-3.5 shadow-[0_3px_0_rgba(148,163,184,0.16)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {`STAGE ${Math.min(currentIndex + 1, stages.length)}: ${currentStage?.label?.toUpperCase() ?? ''}`}
            </p>
            <button
              type="button"
              onClick={() => setShowSteps((prev) => !prev)}
              className="rounded-full border border-[#d3d7dd] bg-white px-3 py-1 text-xs font-extrabold text-slate-600"
            >
              {showSteps ? '▾' : '▸'}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {visibleSteps.map(({ step, index }) => {
              const stepKey = `${currentStage.id}:${index}`;
              const isDone = Boolean(completedStepKeys[stepKey]);
              return (
                <StepRow
                  key={stepKey}
                  active={selectedItem.type === 'step' && index === selectedStepIndex}
                  done={isDone}
                  label={`Step ${index + 1}: ${step}`}
                  xp={currentStage.stepXp[index] || 0}
                  onClick={() => {
                    setSelectedItem({ type: 'step', index });
                  }}
                />
              );
            })}
          </div>

          {currentStage?.optionalSteps?.length ? (
            <div className="pt-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.09em] text-[#1b97dd]">Bonus Quests (Optional)</p>
                <button
                  type="button"
                  onClick={() => setShowBonusQuests((prev) => !prev)}
                  className="rounded-full border border-[#b8d6ef] bg-white px-2.5 py-1 text-xs font-extrabold text-[#1b97dd]"
                >
                  {showBonusQuests ? '▾' : '▸'}
                </button>
              </div>
              {showBonusQuests ? (
                <div className="space-y-2">
                  {currentStage.optionalSteps.map((bonus, idx) => {
                    const bonusKey = `${currentStage.id}:bonus:${idx}`;
                    return (
                      <StepRow
                        key={bonusKey}
                        tone="bonus"
                        active={selectedItem.type === 'bonus' && idx === selectedBonusIndex}
                        done={false}
                        label={bonus.text}
                        xp={bonus.xp || 0}
                        onClick={() => {
                          setSelectedItem({ type: 'bonus', index: idx });
                        }}
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </article>

        <article className="rounded-3xl border border-[#d4d9df] bg-white p-3.5 shadow-[0_3px_0_rgba(148,163,184,0.16)]">
          <div className="mb-2 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ecf8ff] text-2xl">
              {currentStage?.graphic || '🎯'}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Current Step</p>
              <p className="text-sm font-bold text-slate-700">
                {selectedItem.type === 'bonus'
                  ? `Bonus Quest ${selectedBonusIndex + 1} of ${Math.max(currentStage?.optionalSteps?.length || 0, 1)}`
                  : `Step ${selectedStepIndex + 1} of ${Math.max(currentStage?.steps.length || 0, 1)}`}
              </p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-bold text-slate-800">{selectedTitle}</p>
            <p className="font-semibold text-slate-600">{selectedDescription}</p>
            {selectedItem.type === 'bonus' ? (
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#1b97dd]">Optional bonus quest</p>
            ) : null}
          </div>
        </article>
      </div>

    </section>
  );
}

export default function ProjectRoadmapPage({ setupData, plan, onStartBuilder, onBack }) {
  return (
    <>
      <TopNav onCreateNewGame={onBack} />
      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4 lg:px-6">
        <StageProgressSection setupData={setupData} plan={plan} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onBack}
            className="rounded-2xl px-5 py-3 font-bold text-slate-500 hover:bg-slate-100"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onStartBuilder}
            className="duo-btn-blue inline-flex items-center justify-center gap-2 rounded-2xl px-7 py-3 text-lg"
          >
            Continue to Builder
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </main>
    </>
  );
}
