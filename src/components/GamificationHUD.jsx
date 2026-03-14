import React from 'react';
import { Star, Flame } from 'lucide-react';
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
      {/* Level + XP in top nav */}
      <div className="hidden items-center gap-2 sm:flex">
        {/* Level indicator */}
        <div className="flex items-center gap-2 rounded-full border border-[#d6eec2] bg-[#f0fbe4] px-4 py-1.5 text-[13px] font-bold text-[#3a7d0a]">
          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
          Level {userProgress.level}
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#d6eec2]">
            <div
              className="h-full rounded-full bg-[#58cc02] transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        </div>

        {/* Total XP */}
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-bold text-slate-600">
          <Flame className="h-3.5 w-3.5 text-orange-400" />
          {userProgress.total_xp} XP
        </div>
      </div>

      {/* Notification Popup */}
      {notification && (
        <div className="fixed top-20 right-6 z-[60] animate-bounce-in">
          <div className={`p-4 rounded-2xl shadow-xl border w-80 backdrop-blur-md flex flex-col gap-1 transition-all
            ${notification.type === 'levelup'
              ? 'bg-gradient-to-br from-yellow-50/95 to-amber-50/95 border-yellow-300'
              : notification.type === 'achievement'
              ? 'bg-gradient-to-br from-purple-50/95 to-fuchsia-50/95 border-purple-300'
              : 'bg-gradient-to-br from-blue-50/95 to-cyan-50/95 border-blue-300'}`}
          >
            <span className={`font-bold text-base
              ${notification.type === 'levelup' ? 'text-yellow-700' :
                notification.type === 'achievement' ? 'text-purple-700' :
                'text-blue-700'}`}
            >
              {notification.type === 'levelup' ? '🎉 ' : notification.type === 'achievement' ? '🏆 ' : ''}
              {notification.title}
            </span>
            <p className="text-[13px] font-medium text-slate-600 whitespace-pre-wrap">{notification.message}</p>
          </div>
        </div>
      )}
    </>
  );
}
