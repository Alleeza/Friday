import React from 'react';
import { useGamification } from '../hooks/useGamification';
import { missionsData } from '../gamification/missions';
import { CheckCircle, Circle, Map, BookOpen, BrainCircuit, ChevronDown } from 'lucide-react';

export default function MissionPanel() {
  const { userProgress } = useGamification();

  const currentMission = missionsData.find(m => m.id === userProgress.current_mission);

  if (!currentMission) {
    return (
      <div className="flex w-[280px] shrink-0 flex-col border-r border-slate-200 bg-white h-full">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <Map className="w-14 h-14 text-slate-200" />
          <h2 className="text-lg font-bold text-slate-700 text-center">All Missions Complete!</h2>
          <p className="text-[13px] text-slate-400 text-center max-w-[200px] leading-relaxed">
            You've finished every mission. Sandbox mode is fully unlocked!
          </p>
        </div>
      </div>
    );
  }

  const missionProgress = userProgress.mission_progress[currentMission.id] || {};
  const totalSteps = currentMission.steps.length;
  const completedSteps = currentMission.steps.filter(step => (missionProgress[step.id] || 0) >= step.target).length;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  const isAllComplete = completedSteps === totalSteps;

  const activeStep = currentMission.steps.find(step => (missionProgress[step.id] || 0) < step.target);
  const aiHint = activeStep?.description.includes('timer') || activeStep?.description.includes('variables')
    ? "Use the 'Set timer to' block from Variables."
    : activeStep?.description.includes('Bunny') || activeStep?.description.includes('bunny')
    ? "Drag a Bunny from the asset tray onto the canvas."
    : activeStep?.description.includes('Movement') || activeStep?.description.includes('movement')
    ? "Look under the Movement block category."
    : activeStep?.description.includes('Carrot') || activeStep?.description.includes('carrots')
    ? "Drag Carrots to the canvas to collect."
    : "Think about what event connects to this action.";

  // XP per step — evenly distributed from mission reward
  const stepXp = Math.round(currentMission.reward_xp / totalSteps);

  return (
    <div className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white h-full">
      <div className="p-4 flex flex-col gap-4 flex-1">

        {/* Mission Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm shrink-0">
              <Map className="w-4 h-4" />
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Current Mission</span>
              <h2 className="text-[16px] font-extrabold text-slate-800 leading-tight truncate">
                {currentMission.title}
              </h2>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          <p className="text-[12px] text-slate-500 leading-relaxed">
            {currentMission.description}
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-bold text-slate-500 whitespace-nowrap">{completedSteps}/{totalSteps} steps</div>
          <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#58cc02] rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-[11px] font-bold text-[#58cc02] whitespace-nowrap">{Math.round(progressPercent)}%</div>
        </div>

        {/* Learning Objectives */}
        <div className="rounded-xl bg-amber-50/70 p-3 border border-amber-100/60">
          <div className="flex items-center gap-1.5 text-amber-600 mb-2">
            <BookOpen className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em]">Learning</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {currentMission.learningObjectives.map((obj, i) => (
              <span key={i} className="text-[10px] font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                {obj}
              </span>
            ))}
          </div>
        </div>

        {/* Task Checklist */}
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-1.5">
            {currentMission.steps.map((step) => {
              const count = missionProgress[step.id] || 0;
              const isChecked = count >= step.target;

              return (
                <li
                  key={step.id}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 transition-all ${
                    isChecked
                      ? 'border-[#c5e8c9] bg-[#f2faf0]'
                      : 'border-slate-150 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
                  }`}
                >
                  <span className={`mt-0.5 shrink-0 ${isChecked ? 'text-[#58cc02]' : 'text-slate-300'}`}>
                    {isChecked
                      ? <CheckCircle className="h-[18px] w-[18px]" />
                      : <Circle className="h-[18px] w-[18px] stroke-[2]" />
                    }
                  </span>
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <span className={`text-[13px] font-semibold leading-tight ${isChecked ? 'text-[#3a7d0a] line-through decoration-[#3a7d0a]/30' : 'text-slate-700'}`}>
                        {step.description}
                      </span>
                      <span className={`text-[10px] font-black whitespace-nowrap shrink-0 px-1.5 py-0.5 rounded-md ${
                        isChecked ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-500'
                      }`}>
                        +{stepXp} XP
                      </span>
                    </div>
                    {step.target > 1 && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${isChecked ? 'bg-[#58cc02]' : 'bg-blue-400'} rounded-full transition-all`}
                            style={{ width: `${Math.min(100, (count / step.target) * 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold tabular-nums ${isChecked ? 'text-[#3a7d0a]' : 'text-blue-500'}`}>
                          {count}/{step.target}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* AI Coach Hint */}
        <div className="mt-auto pt-3 border-t border-slate-100">
          {!isAllComplete && activeStep ? (
            <div className="rounded-xl flex gap-2.5 p-3 border border-purple-100/80 bg-gradient-to-br from-purple-50/60 to-white items-start">
              <div className="bg-purple-100 p-1.5 rounded-lg shrink-0 mt-0.5">
                <BrainCircuit className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-purple-500 tracking-wider uppercase">AI Coach</span>
                <span className="text-[12px] font-medium text-purple-800/80 leading-snug">{aiHint}</span>
              </div>
            </div>
          ) : isAllComplete ? (
            <div className="rounded-xl p-3 bg-green-50 border border-green-100 text-center">
              <span className="text-[13px] font-bold text-green-700">🎉 Mission Complete!</span>
              <p className="text-[11px] text-green-600 mt-1">+{currentMission.reward_xp} XP earned</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
