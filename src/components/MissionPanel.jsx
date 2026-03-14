import React from 'react';
import { useGamification } from '../hooks/useGamification';
import { missionsData } from '../gamification/missions';
import { CheckCircle, Circle, Map, BrainCircuit } from 'lucide-react';

export default function MissionPanel() {
  const { userProgress } = useGamification();

  const currentMission = missionsData.find(m => m.id === userProgress.current_mission);
  
  if (!currentMission) {
    return (
      <div className="flex w-[300px] flex-col gap-4 border-r border-slate-200 bg-slate-50 relative h-full justify-center items-center shrink-0">
        <div className="flex flex-col items-center justify-center gap-3 text-slate-500 p-6">
          <Map className="w-12 h-12 text-slate-300" />
          <h2 className="text-xl font-bold text-slate-700 text-center">All Missions Completed!</h2>
          <p className="text-[13px] text-center max-w-[230px]">You've completed all available missions. Sandbox mode is now fully open!</p>
        </div>
      </div>
    );
  }

  const missionProgress = userProgress.mission_progress[currentMission.id] || {};

  const totalSteps = currentMission.steps.length;
  const completedSteps = currentMission.steps.filter(step => (missionProgress[step.id] || 0) >= step.target).length;
  const isCheckedAll = completedSteps === totalSteps;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const activeStep = currentMission.steps.find(step => (missionProgress[step.id] || 0) < step.target);
  const aiHint = activeStep?.description.includes('timer') || activeStep?.description.includes('variables') ? "Hint: Use 'Set timer to' block." :
                 activeStep?.description.includes(' Bunny') || activeStep?.description.includes('bunny') ? "Hint: Drag a Bunny from the toolbar." :
                 activeStep?.description.includes('Movement') ? "Hint: Look under the Movement category." :
                 activeStep?.description.includes('Carrot') || activeStep?.description.includes('carrots') ? "Hint: Drag Carrots to the canvas to collect." :
                 "Hint: Think about what event connects to this action.";

  return (
    <div className="flex w-[300px] flex-col overflow-y-auto border-r border-slate-200/80 bg-[#fafbfc] relative h-full font-sans shrink-0">
      <div className="p-4 flex flex-col gap-3 flex-1">
        
        {/* Mission Header */}
        <div className="flex flex-col gap-1 pb-3 border-b border-slate-200/60">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-black text-[10px]">M</span>
            <span className="uppercase text-[10px] font-bold tracking-widest text-[#b0b0b0] flex-1">Current Mission</span>
          </div>
          <h2 className="text-[17px] font-extrabold text-slate-800 leading-tight">
            {currentMission.title}
          </h2>
          <p className="text-[12px] text-slate-500 leading-relaxed font-medium">
            {currentMission.description}
          </p>
        </div>

        {/* Overall Progress Bar */}
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 bg-slate-200/80 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
          <span className="text-[11px] font-black text-blue-500 tabular-nums whitespace-nowrap">{completedSteps}/{totalSteps}</span>
        </div>

        {/* Steps Checklist */}
        <div className="flex flex-col gap-2 pt-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#999]">Tasks</span>
          
          <ul className="flex flex-col gap-1.5">
            {currentMission.steps.map((step) => {
              const count = missionProgress[step.id] || 0;
              const isChecked = count >= step.target;

              return (
                <li
                  key={step.id}
                  className={`relative flex flex-col gap-1 overflow-hidden rounded-lg border px-3 py-2.5 transition-all ${
                    isChecked
                      ? 'border-[#c5e8c9] bg-[#f2faf0] opacity-70'
                      : 'border-slate-200 bg-white hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5 relative z-10">
                    <span className={`mt-0.5 shrink-0 ${isChecked ? 'text-[#58cc02]' : 'text-slate-300'}`}>
                      {isChecked ? <CheckCircle className="h-4 w-4 fill-current text-white" /> : <Circle className="h-4 w-4 stroke-[2.5]" />}
                    </span>
                    <div className="flex flex-col gap-[2px] w-full">
                      <span className={`text-[13px] font-semibold leading-tight ${isChecked ? 'text-[#3a7d0a]' : 'text-slate-700'}`}>
                        {step.description}
                      </span>
                      {step.target > 1 && (
                        <div className="mt-1 w-full flex items-center gap-2">
                           <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${isChecked ? 'bg-[#58cc02]' : 'bg-blue-400'} rounded-full transition-all`} 
                                style={{ width: `${Math.min(100, (count / step.target) * 100)}%` }} 
                              />
                           </div>
                           <span className={`text-[10px] font-black ${isChecked ? 'text-[#3a7d0a]' : 'text-blue-500'} tabular-nums`}>
                             {count}/{step.target}
                           </span>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        
        {/* AI Hint Section */}
        <div className="mt-auto pt-3 border-t border-slate-200/60">
        {!isCheckedAll && activeStep ? (
              <div className="rounded-lg flex gap-2.5 p-2.5 border border-purple-100/80 bg-gradient-to-br from-[#f8f5fd] to-white items-start">
                 <div className="bg-purple-100/80 p-1.5 rounded-md shrink-0 mt-0.5">
                    <BrainCircuit className="w-3.5 h-3.5 text-purple-600" />
                 </div>
                 <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-purple-600 tracking-wider uppercase">AI Coach</span>
                    <span className="text-[12px] font-medium text-purple-900/75 leading-snug">{aiHint}</span>
                 </div>
              </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
