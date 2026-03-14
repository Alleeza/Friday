import React from 'react';
import { Trophy, Lock } from 'lucide-react';
import { useGamification } from '../hooks/useGamification';
import { achievementsData } from '../gamification/achievements';

export default function AchievementPanel() {
  const { userProgress } = useGamification();

  return (
    <div className="flex w-[320px] flex-col overflow-y-auto border-l border-slate-200 bg-slate-50 relative shadow-inner drop-shadow-sm h-full font-sans">
      <div className="sticky top-0 bg-slate-50 border-b border-slate-200 p-5 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="bg-purple-100/80 p-2 rounded-lg text-purple-600">
             <Trophy className="w-5 h-5" />
          </div>
          <h2 className="text-[18px] font-bold text-slate-800 tracking-tight">Achievements</h2>
        </div>
      </div>
      
      <div className="p-5 flex flex-col gap-4">
        {achievementsData.map(ach => {
          const isUnlocked = userProgress.achievements.includes(ach.id);
          
          return (
            <div key={ach.id} className={`flex gap-4 p-4 rounded-2xl border ${isUnlocked ? 'bg-gradient-to-br from-purple-50 to-white border-purple-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-70 grayscale-[0.5]'} transition-all`}>
              <div className="shrink-0 relative">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${isUnlocked ? 'bg-yellow-100 border-yellow-400 text-yellow-600' : 'bg-slate-200 border-slate-300 text-slate-400'}`}>
                  {isUnlocked ? <Trophy className="w-6 h-6 fill-current" /> : <Lock className="w-5 h-5" />}
                </div>
              </div>
              <div className="flex flex-col gap-1 w-full mt-0.5">
                <div className="flex items-start justify-between">
                  <span className={`text-[15px] font-bold ${isUnlocked ? 'text-purple-900' : 'text-slate-600'} leading-tight`}>{ach.name}</span>
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${isUnlocked ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200 text-slate-500'}`}>+{ach.reward_xp} XP</span>
                </div>
                <p className="text-[13px] text-slate-500 font-medium leading-snug">{ach.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
