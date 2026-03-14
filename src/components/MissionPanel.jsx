import React from 'react';
import { useGamification } from '../hooks/useGamification';
import { missionsData } from '../gamification/missions';
import { CheckCircle, Circle, Map, BookOpen, BrainCircuit } from 'lucide-react';

export default function MissionPanel() {
  const { userProgress } = useGamification();

  const currentMission = missionsData.find(m => m.id === userProgress.current_mission);
  
  if (!currentMission) {
    return (
      <div className="flex w-[320px] flex-col gap-4 border-r border-slate-200 bg-slate-50 relative h-full justify-center items-center">
        <div className="flex flex-col items-center justify-center gap-3 text-slate-500 p-6">
          <Map className="w-12 h-12 text-slate-300" />
          <h2 className="text-xl font-bold text-slate-700 text-center">All Missions Completed!</h2>
          <p className="text-[14px] text-center max-w-[250px]">You've completed all available missions. Sandbox mode is now fully open. Keep exploring and building!</p>
        </div>
      </div>
    );
  }

  const missionProgress = userProgress.mission_progress[currentMission.id] || {};

  const totalSteps = currentMission.steps.length;
  const completedSteps = currentMission.steps.filter(step => (missionProgress[step.id] || 0) >= step.target).length;
  const isCheckedAll = completedSteps === totalSteps;

  const activeStep = currentMission.steps.find(step => (missionProgress[step.id] || 0) < step.target);
  const aiHint = activeStep?.description.includes('timer') || activeStep?.description.includes('variables') ? "Hint: Use 'Set timer to' block." :
                 activeStep?.description.includes(' Bunny') || activeStep?.description.includes('bunny') ? "Hint: Drag a Bunny from the toolbar." :
                 activeStep?.description.includes('Movement') ? "Hint: Look under the Movement category." :
                 activeStep?.description.includes('Carrot') || activeStep?.description.includes('carrots') ? "Hint: Drag Carrots to the canvas to collect." :
                 "Hint: Think about what event connects to this action.";

  return (
    <div className="flex w-[320px] flex-col overflow-y-auto border-r border-slate-200 bg-slate-50 relative shadow-inner drop-shadow-sm h-full font-sans">
      <div className="p-5 flex flex-col gap-4 flex-1">
        
        {/* Mission Header */}
        <div className="flex flex-col gap-1 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 font-black text-xs">M</span>
            <span className="uppercase text-[11px] font-bold tracking-widest text-[#a1a1a1] flex-1">Current Mission</span>
          </div>
          <h2 className="text-[20px] font-extrabold text-slate-800 leading-tight">
            {currentMission.title}
          </h2>
          <p className="text-[13px] text-slate-500 leading-relaxed font-medium">
            {currentMission.description}
          </p>
        </div>

        {/* Learning Objectives block */}
        <div className="rounded-lg bg-orange-50/60 p-3 border border-orange-100/50 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-orange-600">
              <BookOpen className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Learning</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {currentMission.learningObjectives.map((obj, i) => (
                <span key={i} className="text-[11px] font-semibold text-orange-700 bg-orange-100/70 px-2.5 py-1 rounded-md">
                  {obj}
                </span>
              ))}
            </div>
        </div>

        {/* Steps Checklists */}
        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center justify-between text-[#888888]">
            <span className="text-[12px] font-bold uppercase tracking-widest">Tasks</span>
            <span className="text-[12px] font-black tracking-widest text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">{completedSteps} / {totalSteps}</span>
          </div>
          
          <ul className="flex flex-col gap-2">
            {currentMission.steps.map((step) => {
              const count = missionProgress[step.id] || 0;
              const isChecked = count >= step.target;

              return (
                <li
                  key={step.id}
                  className={`relative flex flex-col gap-1 overflow-hidden rounded-xl border p-3 transition-all ${
                    isChecked
                      ? 'border-[#a7deb0] bg-[#eefae8] opacity-70 cursor-default'
                      : 'border-slate-300 bg-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.03)] hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start gap-3 relative z-10">
                    <button type="button" className={`mt-0.5 shrink-0 transition-colors ${isChecked ? 'text-[#58cc02]' : 'text-slate-300'}`} disabled>
                      {isChecked ? <CheckCircle className="h-[18px] w-[18px] fill-current text-white" /> : <Circle className="h-[18px] w-[18px] stroke-[2.5]" />}
                    </button>
                    <div className="flex flex-col gap-[2px] w-full">
                      <span className={`text-[14px] font-bold leading-tight ${isChecked ? 'text-[#3a7d0a]' : 'text-slate-700'}`}>
                        {step.description}
                      </span>
                      {step.target > 1 && (
                        <div className="mt-1 w-full flex items-center gap-2">
                           <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${isChecked ? 'bg-[#58cc02]' : 'bg-blue-400'} rounded-full transition-all`} 
                                style={{ width: `${Math.min(100, (count / step.target) * 100)}%` }} 
                              />
                           </div>
                           <span className={`text-[11px] font-black ${isChecked ? 'text-[#3a7d0a]' : 'text-blue-500'} tabular-nums`}>
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
        
        {/* AI Hint Section - Optional AI coach */}
        <div className="mt-auto pt-4 pb-2 border-t border-slate-200">
        {!isCheckedAll && activeStep ? (
              <div className="rounded-xl flex gap-3 p-3 border border-purple-100 bg-gradient-to-br from-[#f8f5fd] to-white shadow-[0_2px_10px_rgba(100,20,200,0.02)] items-start">
                 <div className="bg-purple-100 p-1.5 rounded-lg shrink-0 mt-0.5">
                    <BrainCircuit className="w-4 h-4 text-purple-600" />
                 </div>
                 <div className="flex flex-col gap-1">
                    <span className="text-[12px] font-bold text-purple-700 tracking-wider">AI COACH</span>
                    <span className="text-[13px] font-medium text-purple-900/80 leading-snug">{aiHint}</span>
                 </div>
              </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
