import React from 'react';
import { Flame, Star } from 'lucide-react';
import { useGamification } from '../hooks/useGamification';
import { getXpForLevel } from '../gamification/levels';

export default function GamificationHUD() {
  const { userProgress, notification } = useGamification();

  const currentLevelXp = getXpForLevel(userProgress.level);
  const nextLevelXp = getXpForLevel(userProgress.level + 1);
  const xpIntoLevel = userProgress.total_xp - currentLevelXp;
  const xpNeededForNext = nextLevelXp - currentLevelXp;
  const progressPercent = xpNeededForNext > 0 ? (xpIntoLevel / xpNeededForNext) * 100 : 100;

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Level pill — compact */}
        <div className="flex items-center gap-1.5 rounded-full border border-[#d6eec2] bg-[#f0fbe4] px-3 py-1 text-[12px] font-bold text-[#3a7d0a]">
          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
          <span className="tracking-wide">Lv {userProgress.level}</span>
          <div className="h-1 w-12 overflow-hidden rounded-full bg-[#d6eec2] ml-0.5">
            <div 
              className="h-full rounded-full bg-[#58cc02] transition-all duration-500 ease-out" 
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }} 
            />
          </div>
        </div>

        {/* XP counter — compact */}
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-bold text-slate-600">
          <Flame className="h-3 w-3 text-orange-400 fill-orange-400" />
          {userProgress.total_xp}
        </div>
      </div>

      {notification && (
        <div className="fixed top-16 right-6 z-50 animate-bounce-in">
          <div className={`px-4 py-3 rounded-xl shadow-lg border w-72 backdrop-blur-md flex flex-col gap-0.5 transition-all
            ${notification.type === 'levelup' ? 'bg-gradient-to-br from-yellow-100/90 to-amber-50/90 border-yellow-300' :
              notification.type === 'achievement' ? 'bg-gradient-to-br from-purple-100/90 to-fuchsia-50/90 border-purple-300' :
              'bg-gradient-to-br from-blue-100/90 to-cyan-50/90 border-blue-300'}`}
          >
            <span className={`font-bold text-[15px] 
              ${notification.type === 'levelup' ? 'text-yellow-700' :
                notification.type === 'achievement' ? 'text-purple-700' :
                'text-blue-700'}`}
            >
              {notification.title}
            </span>
            <p className="text-[12px] font-medium text-slate-600 whitespace-pre-wrap">{notification.message}</p>
          </div>
        </div>
      )}
    </>
  );
}
