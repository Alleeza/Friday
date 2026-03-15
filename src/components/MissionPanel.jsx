import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, ChevronUp, Map } from 'lucide-react';
import { useGamification } from '../hooks/useGamification';
import { missionsData } from '../gamification/missions';

const STEP_DETAILS = {
  mission_1: {
    add_bunny: {
      description: 'Place a Bunny object on the sandbox canvas so it can interact with other objects.',
      concept: 'Object placement',
    },
    add_carrot: {
      description: 'Add carrot objects the Bunny can collect during the mission.',
      concept: 'Collectible setup',
    },
    collect_carrots: {
      description: 'Run the game and guide the Bunny into carrots to prove the interaction works.',
      concept: 'Playtesting and collision feedback',
    },
  },
  mission_2: {
    set_timer: {
      description: 'Use a timer block so the challenge has a countdown and a goal.',
      concept: 'Variables and timers',
    },
    collect_5_carrots: {
      description: 'Keep testing until the Bunny can gather enough carrots before time runs out.',
      concept: 'Goal tracking',
    },
  },
  mission_3: {
    move_bunny: {
      description: 'Add movement logic so the player can control or move the Bunny around obstacles.',
      concept: 'Motion scripting',
    },
    avoid_obstacles: {
      description: 'Finish the level cleanly to confirm the obstacle rules and movement are working together.',
      concept: 'Challenge validation',
    },
  },
};
const STAGE_TITLES = {
  mission_1: 'Bring your Bunny to life',
  mission_2: 'Add something to collect',
  mission_3: 'Complete the challenge',
};

function distributeStepRewards(totalXp, stepCount) {
  if (!stepCount) return [];
  const baseReward = Math.floor(totalXp / stepCount);
  const remainder = totalXp % stepCount;
  return Array.from({ length: stepCount }, (_, index) => baseReward + (index < remainder ? 1 : 0));
}

function getStepDetails(missionId, step, stepXp) {
  const fromMap = STEP_DETAILS[missionId]?.[step.id];
  return {
    description: fromMap?.description || step.description,
    concept: fromMap?.concept || 'Mission progression',
    reward: `+${stepXp} XP`,
  };
}

export default function MissionPanel() {
  const { userProgress } = useGamification();
  const [expandedStepId, setExpandedStepId] = useState(null);
  const [celebratingStepId, setCelebratingStepId] = useState(null);
  const previousCompletionMapRef = useRef({});
  const celebrationTimeoutRef = useRef(null);

  const currentMission = missionsData.find((mission) => mission.id === userProgress.current_mission);
  const currentStageNumber = currentMission ? Math.max(1, missionsData.findIndex((mission) => mission.id === currentMission.id) + 1) : 1;
  const currentStageTitle = currentMission ? (STAGE_TITLES[currentMission.id] || currentMission.title) : 'Current Stage';
  const missionSteps = currentMission?.steps || [];
  const missionProgress = currentMission ? (userProgress.mission_progress[currentMission.id] || {}) : {};
  const totalSteps = missionSteps.length;
  const stepRewards = currentMission ? distributeStepRewards(currentMission.reward_xp, totalSteps) : [];
  const completedSteps = missionSteps.filter((step) => (missionProgress[step.id] || 0) >= step.target).length;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  const isAllComplete = completedSteps === totalSteps;
  const activeStep = missionSteps.find((step) => (missionProgress[step.id] || 0) < step.target);
  const activeStepIndex = missionSteps.findIndex((step) => (missionProgress[step.id] || 0) < step.target);
  const missionXpEarned = missionSteps.reduce(
    (sum, step, index) => sum + ((missionProgress[step.id] || 0) >= step.target ? (stepRewards[index] || 0) : 0),
    0,
  );
  const stepCompletionMap = useMemo(
    () => Object.fromEntries(missionSteps.map((step) => [step.id, (missionProgress[step.id] || 0) >= step.target])),
    [missionProgress, missionSteps],
  );

  useEffect(() => () => {
    if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!currentMission) return;

    const previous = previousCompletionMapRef.current;
    const newlyCompletedStep = missionSteps.find((step) => stepCompletionMap[step.id] && !previous[step.id]);

    previousCompletionMapRef.current = stepCompletionMap;

    if (!newlyCompletedStep) return;

    setCelebratingStepId(newlyCompletedStep.id);
    if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
    celebrationTimeoutRef.current = window.setTimeout(() => {
      setCelebratingStepId(null);
      celebrationTimeoutRef.current = null;
    }, 900);
  }, [currentMission, missionSteps, stepCompletionMap]);

  if (!currentMission) {
    return (
      <aside className="flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-[#F7F7F7] shadow-[0_10px_30px_rgba(15,23,42,0.06)] lg:w-[320px]">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <Map className="h-14 w-14 text-slate-200" />
          <h2 className="text-center text-lg font-bold text-slate-700">All Missions Complete!</h2>
          <p className="max-w-[200px] text-center text-[13px] leading-relaxed text-slate-400">
            You&apos;ve finished every mission. Sandbox mode is fully unlocked!
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-[#F7F7F7] shadow-[0_10px_30px_rgba(15,23,42,0.06)] lg:w-[320px]">
      <style>{`
        @keyframes cq-step-complete {
          0% { transform: scale(0.98); box-shadow: 0 0 0 rgba(88, 204, 2, 0); }
          40% { transform: scale(1.01); box-shadow: 0 12px 28px rgba(88, 204, 2, 0.18); }
          100% { transform: scale(1); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04); }
        }
        @keyframes cq-check-pop {
          0% { transform: scale(0.55); opacity: 0; }
          70% { transform: scale(1.18); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes cq-xp-flash {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); background: #dcfce7; color: #15803d; }
          100% { transform: scale(1); }
        }
      `}</style>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="rounded-[24px] border border-[#E5E5E5] bg-white px-3.5 py-3.5 shadow-[0_4px_0_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#64748B]">Stage {currentStageNumber}</span>
              <h2 className="mt-1 text-[19px] font-black leading-[1.08] tracking-[-0.03em] text-slate-900">{currentStageTitle}</h2>
              <p className="mt-1.5 text-[11px] font-medium leading-[1.4] text-[#475569]">{currentMission.description}</p>
            </div>
            <div className="shrink-0 rounded-full bg-[#89E219] px-3 py-1.5 text-[11px] font-black text-[#2F5F00] shadow-[inset_0_-2px_0_rgba(0,0,0,0.08)]">
              {missionXpEarned} XP
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#E5E5E5] bg-white px-4 py-4 shadow-[0_4px_0_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.12em] text-[#64748B]">
            <span>Mission Progress</span>
            <span>{completedSteps}/{totalSteps} steps</span>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#E5E5E5]">
            <div
              className="h-full rounded-full bg-[#58CC02] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-3 text-right text-[10px] font-black text-[#58CC02]">{Math.round(progressPercent)}% completed</div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-[13px] font-black uppercase tracking-[0.08em] text-[#475569]">
            {`Stage ${currentStageNumber}: ${currentStageTitle}`.toUpperCase()}
          </div>
          <ul className="flex flex-col gap-3">
            {currentMission.steps.map((step, index) => {
              const count = missionProgress[step.id] || 0;
              const isChecked = count >= step.target;
              const isExpanded = expandedStepId === step.id;
              const isCelebrating = celebratingStepId === step.id;
              const stepReward = stepRewards[index] || 0;
              const stepDetails = getStepDetails(currentMission.id, step, stepReward);
              const isCurrent = !isChecked && index === activeStepIndex;
              const isLocked = !isChecked && activeStepIndex !== -1 && index > activeStepIndex;
              const cardClasses = isChecked
                ? 'border-[#B4DE8A] bg-[#EAF7E1] shadow-none'
                : isCurrent
                  ? 'border-[#58CC02] bg-[#58CC02] shadow-none'
                  : isLocked
                    ? 'border-[#D0D7E2] bg-[#F1F3F6] text-slate-400 shadow-none'
                    : 'border-[#E5E5E5] bg-white shadow-[0_2px_0_rgba(0,0,0,0.03)]';

              return (
                <li
                  key={step.id}
                  className={`overflow-hidden rounded-[24px] border transition-all duration-300 ${cardClasses}`}
                  style={isCelebrating ? { animation: 'cq-step-complete 650ms ease-out' } : undefined}
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={`mission-step-panel-${step.id}`}
                    onClick={() => setExpandedStepId((current) => (current === step.id ? null : step.id))}
                    className={`flex w-full cursor-pointer items-start gap-3 px-4 py-4 text-left transition duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-inset ${
                      isChecked
                        ? 'focus:ring-[#89E219] hover:bg-[#E3F4D5]'
                      : isLocked
                          ? 'focus:ring-[#D0D7E2] hover:bg-[#ECEFF3]'
                          : isCurrent
                            ? 'focus:ring-white/70 hover:brightness-[0.98]'
                            : 'focus:ring-[#89E219] hover:bg-[#F7F7F7]'
                    }`}
                    >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[3px] ${
                        isChecked
                          ? 'border-[#58CC02] bg-[#58CC02] text-white'
                          : isCurrent
                            ? 'border-[#D0D7E2] bg-white text-transparent'
                          : isLocked
                            ? 'border-[#C8D1DD] bg-[#F7F8FA] text-[#F7F8FA]'
                            : 'border-[#C7D2E2] bg-white text-transparent'
                      }`}
                      style={isCelebrating && isChecked ? { animation: 'cq-check-pop 280ms ease-out' } : undefined}
                    >
                      {isChecked ? <Check className="h-4 w-4 stroke-[3]" /> : null}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-start justify-between gap-3">
                        <span className={`min-w-0 flex-1 text-[14px] font-bold leading-snug ${isChecked ? 'text-[#325F13]' : isCurrent ? 'text-white' : isLocked ? 'text-[#64748B]' : 'text-slate-800'}`}>
                          {step.description}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black whitespace-nowrap ${
                              isLocked ? 'bg-[#FAFAFA] text-[#98A2B3]' : isCurrent ? 'bg-white text-[#2F5F00]' : 'bg-[#F7F7F7] text-[#334155]'
                            }`}
                            style={isCelebrating ? { animation: 'cq-xp-flash 420ms ease-out 1' } : undefined}
                          >
                            +{stepReward} XP
                          </span>
                          <span className={`shrink-0 ${isCurrent ? 'text-white/90' : isLocked ? 'text-[#98A2B3]' : 'text-slate-400'}`}>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </span>
                        </div>
                      </div>
                      {step.target > 1 && isExpanded ? (
                        <div className="mt-0.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E5E5E5]">
                            <div
                              className={`h-full rounded-full transition-all ${isChecked ? 'bg-[#58CC02]' : isLocked ? 'bg-slate-300' : 'bg-[#58CC02]'}`}
                              style={{ width: `${Math.min(100, (count / step.target) * 100)}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-bold tabular-nums ${isChecked ? 'text-[#46A302]' : isLocked ? 'text-slate-400' : 'text-[#58CC02]'}`}>
                            {count}/{step.target}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </button>

                  <div
                    className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
                    style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr', opacity: isExpanded ? 1 : 0 }}
                  >
                    <div
                      id={`mission-step-panel-${step.id}`}
                      className="overflow-hidden"
                    >
                      <div className={`border-t px-4 py-3 ${isChecked ? 'border-[#B4DE8A] bg-[#F3FAEC]' : isCurrent ? 'border-white/20 bg-white' : isLocked ? 'border-[#D0D7E2] bg-[#F7F8FA]' : 'border-[#E5E5E5] bg-[#F7F7F7]'}`}>
                        <div className="space-y-2.5">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Description</p>
                            <p className="mt-1 text-[12px] font-medium leading-relaxed text-slate-700">{stepDetails.description}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Learning Concept</p>
                            <p className="mt-1 text-[12px] font-bold text-slate-700">{stepDetails.concept}</p>
                          </div>
                          <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                            <span className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400">Reward</span>
                            <span className="text-[12px] font-extrabold text-[#58CC02]">{stepDetails.reward}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-2 flex items-center justify-between px-1">
            <span className="text-[13px] font-black uppercase tracking-[0.14em] text-[#1CB0F6]">Bonus Quests (Optional)</span>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#B7DAFB] bg-white text-[#1CB0F6] transition hover:bg-[#F4FBFF]"
              aria-label="View bonus quests"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-auto pt-2">
          {isAllComplete ? (
            <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-center">
              <span className="text-[13px] font-bold text-green-700">🎉 Mission Complete!</span>
              <p className="mt-1 text-[11px] text-green-600">+{currentMission.reward_xp} XP earned</p>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
