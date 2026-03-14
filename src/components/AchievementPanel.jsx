import React from 'react';
import { Trophy, Lock } from 'lucide-react';
import { useGamification } from '../hooks/useGamification';
import { achievementsData } from '../gamification/achievements';

export default function AchievementPanel() {
  const { userProgress } = useGamification();

  return (
    <div className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white h-full">
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 border-b border-slate-100 px-4 py-3 flex items-center gap-2">
        <div className="bg-yellow-100 p-1.5 rounded-lg text-yellow-600">
          <Trophy className="w-4 h-4" />
        </div>
        <h2 className="text-[16px] font-extrabold text-slate-800">Achievements</h2>
      </div>

      {/* Achievement Cards */}
      <div className="p-3 flex flex-col gap-2.5">
        {achievementsData.map(ach => {
          const isUnlocked = userProgress.achievements.includes(ach.id);

          return (
            <div
              key={ach.id}
              className={`flex gap-3 p-3 rounded-xl border transition-all ${
                isUnlocked
                  ? 'bg-gradient-to-br from-yellow-50/80 to-white border-yellow-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
                  : 'bg-slate-50/50 border-slate-100 opacity-60'
              }`}
            >
              {/* Badge Icon */}
              <div className="shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  isUnlocked
                    ? 'bg-yellow-100 border-yellow-400 text-yellow-600'
                    : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}>
                  {isUnlocked
                    ? <Trophy className="w-5 h-5" />
                    : <Lock className="w-4 h-4" />
                  }
                </div>
              </div>

              {/* Content */}
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <span className={`text-[13px] font-bold leading-tight ${
                    isUnlocked ? 'text-slate-800' : 'text-slate-500'
                  }`}>
                    {ach.name}
                  </span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                    isUnlocked
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    +{ach.reward_xp} XP
                  </span>
                </div>
                <p className={`text-[11px] font-medium leading-snug ${
                  isUnlocked ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  {ach.description}
                </p>
                {isUnlocked && (
                  <span className="text-[10px] font-bold text-green-600 mt-0.5">✓ Unlocked</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
