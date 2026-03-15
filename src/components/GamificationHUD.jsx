import React from 'react';
import { Star, Trophy } from 'lucide-react';
import { useGamification } from '../hooks/useGamification';
import { getXpForLevel } from '../gamification/levels';
import { achievementsData } from '../gamification/achievements';

const LEVEL_TITLES = {
  1: 'Beginner',
  2: 'Builder',
  3: 'Creator',
  4: 'Inventor',
  5: 'Master',
};

export default function GamificationHUD({ className = '', onOpenAchievements = null }) {
  const { userProgress, notification } = useGamification();

  const currentLevelXp = getXpForLevel(userProgress.level);
  const nextLevelXp = getXpForLevel(userProgress.level + 1);
  const xpIntoLevel = userProgress.total_xp - currentLevelXp;
  const xpNeededForNext = nextLevelXp - currentLevelXp;
  const progressPercent = xpNeededForNext > 0 ? (xpIntoLevel / xpNeededForNext) * 100 : 100;
  const unlockedAchievements = userProgress.achievements.length;
  const totalAchievements = achievementsData.length;
  const levelTitle = LEVEL_TITLES[userProgress.level] || 'Adventurer';

  return (
    <>
      <div className={`flex flex-wrap items-center justify-end gap-2 ${className}`.trim()}>
        <div className="flex min-w-[340px] items-center gap-2.5 rounded-[999px] border border-[#EEF3F8] bg-white/98 px-3.5 py-1.5 shadow-[0_2px_10px_rgba(148,163,184,0.10)]">
          <div className="relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border-[3px] border-[#F4C04E] bg-[#FFF8DD] text-[#B7791F] shadow-[inset_0_-2px_0_rgba(244,192,78,0.20)]">
            <span className="text-[17px] font-black leading-none">{userProgress.level}</span>
            <span className="absolute -bottom-1 -right-1 flex h-[16px] w-[16px] items-center justify-center rounded-full border border-[#F4C04E] bg-[#FFF8DD] shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
              <Star className="h-[9px] w-[9px] fill-[#F4C04E] text-[#F4C04E]" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#B3BDCC]">Level {userProgress.level}</p>
                <p className="truncate text-[12px] font-black leading-[1.05] text-[#4E5B73]">{levelTitle}</p>
              </div>
              <span className="shrink-0 pt-0.5 text-[10px] font-black tracking-[0.01em] text-[#F2A63A]">
                {xpIntoLevel} / {Math.max(xpNeededForNext, 1)} XP
              </span>
            </div>
            <div className="mt-1.5 h-[7px] overflow-hidden rounded-full bg-[#EAEFF5]">
              <div
                className="h-full rounded-full bg-[#F4B347] shadow-[inset_0_-1px_0_rgba(209,135,33,0.22)] transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenAchievements}
          className={`flex h-[42px] w-[42px] items-center justify-center rounded-full border-[3px] border-[#F4D48B] bg-[#FFF8E1] text-[#A16207] shadow-[0_2px_10px_rgba(244,212,139,0.18)] transition hover:brightness-[0.98] ${onOpenAchievements ? 'cursor-pointer' : 'cursor-default'}`}
          aria-label="Open badges"
          title={`${unlockedAchievements}/${totalAchievements} badges`}
        >
          <Trophy className="h-4 w-4" />
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
