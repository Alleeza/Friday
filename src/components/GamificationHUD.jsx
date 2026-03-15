import React from 'react';
import { Flame, Star, Trophy } from 'lucide-react';
import { useGamification } from '../hooks/useGamification';
import { getXpForLevel } from '../gamification/levels';
import { achievementsData } from '../gamification/achievements';

export default function GamificationHUD({ className = '', onOpenAchievements = null }) {
  const { userProgress, notification } = useGamification();

  const currentLevelXp = getXpForLevel(userProgress.level);
  const nextLevelXp = getXpForLevel(userProgress.level + 1);
  const xpIntoLevel = userProgress.total_xp - currentLevelXp;
  const xpNeededForNext = nextLevelXp - currentLevelXp;
  const progressPercent = xpNeededForNext > 0 ? (xpIntoLevel / xpNeededForNext) * 100 : 100;
  const unlockedAchievements = userProgress.achievements.length;
  const totalAchievements = achievementsData.length;

  return (
    <>
      <div className={`flex flex-wrap items-center justify-end gap-2 ${className}`.trim()}>
        <div className="flex items-center gap-2 rounded-full border border-[#d6eec2] bg-[#f0fbe4] px-4 py-2 text-[13px] font-bold text-[#3a7d0a]">
          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
          Level {userProgress.level}
        </div>

        <div className="min-w-[200px] rounded-[20px] border border-slate-200 bg-white px-4 py-2.5 shadow-[0_2px_0_rgba(148,163,184,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-slate-500">
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              XP Progress
            </span>
            <span className="text-[12px] font-extrabold text-slate-700">
              {xpIntoLevel}/{Math.max(xpNeededForNext, 1)}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#58cc02] transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenAchievements}
          className={`flex items-center gap-2 rounded-full border border-[#f4d48b] bg-[#fff8e1] px-4 py-2 text-[12px] font-bold text-[#a16207] transition hover:brightness-[0.98] ${onOpenAchievements ? 'cursor-pointer' : 'cursor-default'}`}
          aria-label="Open badges"
        >
          <Trophy className="h-3.5 w-3.5" />
          {unlockedAchievements}/{totalAchievements} badges
        </button>
      </div>

      {notification && (
        <div className="fixed right-6 top-24 z-[60] animate-bounce-in">
          <div className={`p-4 rounded-2xl shadow-xl border w-80 backdrop-blur-md flex flex-col gap-1 transition-all
            ${notification.type === 'levelup'
              ? 'bg-gradient-to-br from-yellow-50/95 to-amber-50/95 border-yellow-300'
              : notification.type === 'achievement'
              ? 'bg-gradient-to-br from-[#fff8e1]/95 to-[#fffbeb]/95 border-[#f4d48b]'
              : 'bg-gradient-to-br from-blue-50/95 to-cyan-50/95 border-blue-300'}`}
          >
            <span className={`font-bold text-base
              ${notification.type === 'levelup' ? 'text-yellow-700' :
                notification.type === 'achievement' ? 'text-[#a16207]' :
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
