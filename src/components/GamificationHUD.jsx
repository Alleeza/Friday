import React from 'react';
import { Flame, Star, Trophy, X } from 'lucide-react';
import { useGamification } from '../hooks/useGamification';
import { getXpForLevel } from '../gamification/levels';

export default function GamificationHUD() {
  const { userProgress, notification, showNotification } = useGamification();

  const currentLevelXp = getXpForLevel(userProgress.level);
  const nextLevelXp = getXpForLevel(userProgress.level + 1);
  const xpIntoLevel = userProgress.total_xp - currentLevelXp;
  const xpNeededForNext = nextLevelXp - currentLevelXp;
  const progressPercent = xpNeededForNext > 0 ? (xpIntoLevel / xpNeededForNext) * 100 : 100;

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.2)] bg-white/50 backdrop-blur-sm px-4 py-1.5 text-[14px] font-bold text-[#3a7d0a] shadow-sm">
          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          <span className="text-slate-800 tracking-wide">Level {userProgress.level}</span>
          <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200/80 ml-1 border border-slate-300">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500 ease-out" 
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }} 
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/60 px-3.5 py-1.5 text-[14px] font-bold text-slate-700 shadow-sm backdrop-blur-sm">
          <Flame className="h-4 w-4 text-orange-500 fill-orange-500" />
          {userProgress.total_xp} XP
        </div>
      </div>

      {notification && (
        <div className="fixed top-20 right-6 z-50 animate-bounce-in">
          <div className={`p-4 rounded-xl shadow-lg border w-80 backdrop-blur-md flex flex-col gap-1 transition-all
            ${notification.type === 'levelup' ? 'bg-gradient-to-br from-yellow-100/90 to-amber-50/90 border-yellow-300' :
              notification.type === 'achievement' ? 'bg-gradient-to-br from-purple-100/90 to-fuchsia-50/90 border-purple-300' :
              'bg-gradient-to-br from-blue-100/90 to-cyan-50/90 border-blue-300'}`}
          >
            <div className="flex justify-between items-start">
              <span className={`font-bold text-lg 
                ${notification.type === 'levelup' ? 'text-yellow-700' :
                  notification.type === 'achievement' ? 'text-purple-700' :
                  'text-blue-700'}`}
              >
                {notification.title}
              </span>
              {/* Could add a close button, but timeout hides it */}
            </div>
            <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{notification.message}</p>
          </div>
        </div>
      )}
    </>
  );
}
