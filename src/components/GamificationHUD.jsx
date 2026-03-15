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
        <div className="flex min-w-[390px] items-center gap-3 rounded-[999px] border border-[#EEF2F7] bg-white px-4 py-2 shadow-[0_3px_14px_rgba(148,163,184,0.12)]">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[3px] border-[#F4C24D] bg-[#FFF7D6] text-[#B7791F] shadow-[inset_0_-2px_0_rgba(244,194,77,0.24)]">
            <span className="text-[19px] font-black leading-none">{userProgress.level}</span>
            <span className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border border-[#F4C24D] bg-[#FFF7D6]">
              <Star className="h-2.5 w-2.5 fill-[#F4C24D] text-[#F4C24D]" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A3AEC2]">Level {userProgress.level}</p>
                <p className="truncate text-[14px] font-black leading-[1.05] text-[#49556B]">{levelTitle}</p>
              </div>
              <span className="shrink-0 pt-0.5 text-[12px] font-black text-[#F0A640]">
                {xpIntoLevel} / {Math.max(xpNeededForNext, 1)} XP
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E9EEF5]">
              <div
                className="h-full rounded-full bg-[#F5B347] transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenAchievements}
          className={`flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-[#F4D48B] bg-[#FFF8E1] text-[#A16207] shadow-[0_3px_10px_rgba(244,212,139,0.22)] transition hover:brightness-[0.98] ${onOpenAchievements ? 'cursor-pointer' : 'cursor-default'}`}
          aria-label="Open badges"
          title={`${unlockedAchievements}/${totalAchievements} badges`}
        >
          <Trophy className="h-4.5 w-4.5" />
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
