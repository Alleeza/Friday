import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BrainCircuit, CheckCircle, Circle, Map } from 'lucide-react';
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
  const [hoveredStepId, setHoveredStepId] = useState(null);
  const [celebratingStepId, setCelebratingStepId] = useState(null);
  const previousCompletionMapRef = useRef({});
  const celebrationTimeoutRef = useRef(null);

  const currentMission = missionsData.find((mission) => mission.id === userProgress.current_mission);
  const missionSteps = currentMission?.steps || [];
  const missionProgress = currentMission ? (userProgress.mission_progress[currentMission.id] || {}) : {};
  const totalSteps = missionSteps.length;
  const completedSteps = missionSteps.filter((step) => (missionProgress[step.id] || 0) >= step.target).length;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  const isAllComplete = completedSteps === totalSteps;
  const activeStep = missionSteps.find((step) => (missionProgress[step.id] || 0) < step.target);
  const stepXp = currentMission ? Math.round(currentMission.reward_xp / Math.max(totalSteps, 1)) : 0;
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
      <aside className="flex h-full w-full flex-col rounded-[28px] border border-[#e3e8ef] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] lg:w-[320px]">
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

  const aiHint = activeStep?.description.includes('timer') || activeStep?.description.includes('variables')
    ? "Use the 'Set timer to' block from Variables."
    : activeStep?.description.includes('Bunny') || activeStep?.description.includes('bunny')
      ? 'Drag a Bunny from the asset tray onto the canvas.'
      : activeStep?.description.includes('Movement') || activeStep?.description.includes('movement')
        ? 'Look under the Movement block category.'
        : activeStep?.description.includes('Carrot') || activeStep?.description.includes('carrots')
          ? 'Drag Carrots to the canvas to collect.'
          : 'Think about what event connects to this action.';

  return (
    <aside className="flex h-full w-full flex-col overflow-visible rounded-[28px] border border-[#e3e8ef] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] lg:w-[320px]">
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

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff2c7] text-[#b7791f] shadow-sm">
              <Map className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Current Mission</span>
              <h2 className="text-[20px] font-extrabold leading-tight text-slate-800">{currentMission.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{currentMission.description}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-[#e8edf3] bg-[#f8fafc] p-3">
          <div className="flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
            <span>Mission Progress</span>
            <span>{completedSteps}/{totalSteps} steps</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-[#58cc02] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 text-right text-[11px] font-extrabold text-[#58cc02]">{Math.round(progressPercent)}%</div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Steps</div>
          <ul className="flex flex-col gap-1.5">
            {currentMission.steps.map((step) => {
              const count = missionProgress[step.id] || 0;
              const isChecked = count >= step.target;
              const isHovered = hoveredStepId === step.id;
              const isCelebrating = celebratingStepId === step.id;
              const stepDetails = getStepDetails(currentMission.id, step, stepXp);

              return (
                <li
                  key={step.id}
                  tabIndex={0}
                  onMouseEnter={() => setHoveredStepId(step.id)}
                  onMouseLeave={() => setHoveredStepId((current) => (current === step.id ? null : current))}
                  onFocus={() => setHoveredStepId(step.id)}
                  onBlur={() => setHoveredStepId((current) => (current === step.id ? null : current))}
                  className={`relative flex items-start gap-2.5 rounded-xl border p-3 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#bfe3f8] ${
                    isChecked
                      ? 'border-[#c5e8c9] bg-[#f2faf0]'
                      : 'border-[#e7ebf0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
                  }`}
                  style={isCelebrating ? { animation: 'cq-step-complete 650ms ease-out' } : undefined}
                >
                  <span
                    className={`mt-0.5 shrink-0 ${isChecked ? 'text-[#58cc02]' : 'text-slate-300'}`}
                    style={isCelebrating && isChecked ? { animation: 'cq-check-pop 280ms ease-out' } : undefined}
                  >
                    {isChecked
                      ? <CheckCircle className="h-[18px] w-[18px]" />
                      : <Circle className="h-[18px] w-[18px] stroke-[2]" />
                    }
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-1">
                      <span className={`text-[13px] font-semibold leading-tight ${isChecked ? 'text-[#3a7d0a] line-through decoration-[#3a7d0a]/30' : 'text-slate-700'}`}>
                        {step.description}
                      </span>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black whitespace-nowrap ${
                          isChecked ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-500'
                        }`}
                        style={isCelebrating ? { animation: 'cq-xp-flash 420ms ease-out 1' } : undefined}
                      >
                        +{stepXp} XP
                      </span>
                    </div>
                    {step.target > 1 ? (
                      <div className="mt-0.5 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all ${isChecked ? 'bg-[#58cc02]' : 'bg-blue-400'}`}
                            style={{ width: `${Math.min(100, (count / step.target) * 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold tabular-nums ${isChecked ? 'text-[#3a7d0a]' : 'text-blue-500'}`}>
                          {count}/{step.target}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div
                    className={`pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-30 w-[240px] -translate-y-1/2 rounded-2xl border border-[#d9e7f2] bg-white/95 p-3 shadow-[0_16px_40px_rgba(15,23,42,0.14)] transition-all duration-200 ${
                      isHovered ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0'
                    }`}
                    aria-hidden={!isHovered}
                  >
                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Description</p>
                        <p className="mt-1 text-[12px] leading-relaxed text-slate-700">{stepDetails.description}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Learning Concept</p>
                        <p className="mt-1 text-[12px] font-semibold text-slate-700">{stepDetails.concept}</p>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-[#f8fafc] px-3 py-2">
                        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Reward</span>
                        <span className="text-[12px] font-extrabold text-[#1b97dd]">{stepDetails.reward}</span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-auto border-t border-slate-100 pt-3">
          {!isAllComplete && activeStep ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-[#cfe6fb] bg-gradient-to-br from-[#eef7ff] to-white p-3">
              <div className="mt-0.5 shrink-0 rounded-lg bg-[#d9f0ff] p-1.5">
                <BrainCircuit className="h-3.5 w-3.5 text-[#1b97dd]" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1b97dd]">AI Coach</span>
                <span className="text-[12px] font-medium leading-snug text-slate-700">{aiHint}</span>
              </div>
            </div>
          ) : isAllComplete ? (
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
