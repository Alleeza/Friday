import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { calculateLevel, levelUnlocks } from '../gamification/levels';
import { achievementsData } from '../gamification/achievements';
import { missionsData } from '../gamification/missions';
import { buildPlanMissionView } from '../gamification/planProgress';
import {
  calculateAchievementXp,
  collectUnlocksForLevel,
  distributeStepRewards,
  sumNumericValues,
} from '../gamification/progressUtils';

const GamificationContext = createContext(null);

function createDefaultUserProgress() {
  return {
    userId: 'questy_user_1',
    progress_mode: 'legacy',
    bonus_xp: 0,
    total_xp: 0,
    level: 1,
    current_mission: 'mission_1',
    completed_missions: [],
    achievements: [],
    legacy_step_xp: {},
    plan_step_xp: {},
    unlocked_items: [],
    unlocked_events: [],
    unlocked_actions: [],
    unlocked_skins: [],
    mission_progress: {},
  };
}

function normalizeXpMap(rawMap) {
  if (!rawMap || typeof rawMap !== 'object') return {};
  return Object.fromEntries(
    Object.entries(rawMap)
      .map(([key, value]) => [key, Math.max(0, Number(value) || 0)])
      .filter(([, value]) => value > 0),
  );
}

function finalizeUserProgress(rawProgress) {
  const progress = {
    ...createDefaultUserProgress(),
    ...rawProgress,
    progress_mode: rawProgress?.progress_mode === 'plan' ? 'plan' : 'legacy',
    completed_missions: Array.isArray(rawProgress?.completed_missions) ? rawProgress.completed_missions : [],
    achievements: Array.isArray(rawProgress?.achievements) ? rawProgress.achievements : [],
    mission_progress: rawProgress?.mission_progress && typeof rawProgress.mission_progress === 'object'
      ? rawProgress.mission_progress
      : {},
  };
  const bonusXp = Math.max(0, Number(progress.bonus_xp) || 0);
  const legacyStepXp = normalizeXpMap(progress.legacy_step_xp);
  const planStepXp = normalizeXpMap(progress.plan_step_xp);
  const missionXp = progress.progress_mode === 'plan'
    ? sumNumericValues(planStepXp)
    : sumNumericValues(legacyStepXp);
  const totalXp = bonusXp
    + missionXp
    + calculateAchievementXp(progress.achievements);
  const level = calculateLevel(totalXp);
  const unlocks = collectUnlocksForLevel(levelUnlocks, level);

  return {
    ...progress,
    bonus_xp: bonusXp,
    legacy_step_xp: legacyStepXp,
    plan_step_xp: planStepXp,
    total_xp: totalXp,
    level,
    unlocked_items: unlocks.items,
    unlocked_events: unlocks.events,
    unlocked_actions: unlocks.actions,
    unlocked_skins: unlocks.skins,
  };
}

function normalizeUserProgress(savedProgress) {
  const defaults = createDefaultUserProgress();
  return finalizeUserProgress({
    ...defaults,
    ...savedProgress,
  });
}

function queueNotifications(notifications, showNotification) {
  if (!notifications.length) return;
  setTimeout(() => {
    notifications.forEach((notification, index) => {
      setTimeout(() => showNotification(notification.type, notification.title, notification.message), index * 2000);
    });
  }, 0);
}

function haveSameXpMap(left, right) {
  const leftKeys = Object.keys(left || {});
  const rightKeys = Object.keys(right || {});
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => (left[key] || 0) === (right[key] || 0));
}

function loadSavedUserProgress() {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return createDefaultUserProgress();
  }

  try {
    const saved = window.localStorage.getItem('gamification_progress');
    return saved ? normalizeUserProgress(JSON.parse(saved)) : createDefaultUserProgress();
  } catch (error) {
    console.error('Failed to parse gamification progress', error);
    return createDefaultUserProgress();
  }
}

export function GamificationProvider({ children }) {
  const [userProgress, setUserProgress] = useState(() => loadSavedUserProgress());

  const [notification, setNotification] = useState(null);
  const [eventsHistory, setEventsHistory] = useState([]);

  // Save to local storage on change
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
    window.localStorage.setItem('gamification_progress', JSON.stringify(userProgress));
  }, [userProgress]);

  const showNotification = useCallback((type, title, message, timeout = 5000) => {
    const id = Date.now();
    setNotification({ id, type, title, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.id === id ? null : prev));
    }, timeout);
  }, []);

  const addXp = useCallback((amount) => {
    if (amount <= 0) return;
    setUserProgress((prev) => {
      const next = finalizeUserProgress({
        ...prev,
        bonus_xp: (prev.bonus_xp || 0) + amount,
      });
      if (next.level > prev.level) {
        queueNotifications([
          { type: 'levelup', title: '🎉 Level Up!', message: `Welcome to Level ${next.level}!` },
        ], showNotification);
      }
      return next;
    });
  }, [showNotification]);

  const syncPlanProgress = useCallback((plan, workspaceState) => {
    const planMissionView = buildPlanMissionView(plan, workspaceState);
    const nextPlanStepXp = planMissionView?.completedStepXp || {};
    const nextProgressMode = planMissionView ? 'plan' : 'legacy';

    setUserProgress((prev) => {
      if (prev.progress_mode === nextProgressMode && haveSameXpMap(prev.plan_step_xp, nextPlanStepXp)) return prev;

      const newlyCompletedXp = Object.entries(nextPlanStepXp).reduce(
        (sum, [stepKey, xp]) => sum + (prev.plan_step_xp?.[stepKey] ? 0 : xp),
        0,
      );
      const notifications = [];
      const next = finalizeUserProgress({
        ...prev,
        progress_mode: nextProgressMode,
        plan_step_xp: nextPlanStepXp,
      });

      if (newlyCompletedXp > 0) {
        notifications.push({
          type: 'mission',
          title: '⭐ Progress Updated!',
          message: `You earned +${newlyCompletedXp} XP.`,
        });
      }
      if (next.level > prev.level) {
        notifications.push({
          type: 'levelup',
          title: '🎉 Level Up!',
          message: `Welcome to Level ${next.level}!`,
        });
      }
      queueNotifications(notifications, showNotification);
      return next;
    });
  }, [showNotification]);

  const processGamificationEvent = useCallback((event) => {
    setEventsHistory(prevHistory => {
      const newHistory = [...prevHistory, { ...event, timestamp: Date.now() }];
      
      setUserProgress(prev => {
        let next = { ...prev };
        let stateChanged = false;
        const notificationsToFire = [];
        
        // 1. Legacy mission progress (used only when a plan-based mission view is not available)
        if (next.progress_mode !== 'plan' && next.current_mission && !next.completed_missions.includes(next.current_mission)) {
          const mData = missionsData.find(m => m.id === next.current_mission);
          if (mData) {
            const mProg = { ...(next.mission_progress[mData.id] || {}) };
            const legacyStepXp = { ...(next.legacy_step_xp || {}) };
            const stepRewards = distributeStepRewards(mData.reward_xp, mData.steps.length);
            let stepAdvanced = false;
            
            mData.steps.forEach((step, stepIndex) => {
              const currentVal = mProg[step.id] || 0;
              if (currentVal < step.target) {
                const match = step.check(event);
                if (match) {
                  const amt = typeof match === 'number' ? match : 1;
                  const nextVal = Math.min(step.target, currentVal + amt);
                  mProg[step.id] = nextVal;
                  stepAdvanced = true;
                  if (currentVal < step.target && nextVal >= step.target) {
                    legacyStepXp[`${mData.id}:${step.id}`] = stepRewards[stepIndex] || 0;
                  }
                }
              }
            });
            
            if (stepAdvanced) {
              next.mission_progress = { ...next.mission_progress, [mData.id]: mProg };
              next.legacy_step_xp = legacyStepXp;
              stateChanged = true;
              
              const allDone = mData.steps.every(s => (mProg[s.id] || 0) >= s.target);
              if (allDone) {
                next.completed_missions = [...next.completed_missions, mData.id];
                notificationsToFire.push({ type: 'mission', title: '⭐ Mission Complete!', message: `${mData.title} completed`});
                
                const mIndex = missionsData.findIndex(m => m.id === mData.id);
                if (mIndex < missionsData.length - 1) {
                  next.current_mission = missionsData[mIndex + 1].id;
                } else {
                  next.current_mission = null;
                }
              }
            }
          }
        }
        
        // 2. Achievements
        achievementsData.forEach(ach => {
          if (!next.achievements.includes(ach.id)) {
            if (ach.condition(newHistory, next)) {
              next.achievements = [...next.achievements, ach.id];
              notificationsToFire.push({ type: 'achievement', title: `🏆 Achievement Unlocked: ${ach.name}`, message: ach.description });
              stateChanged = true;
            }
          }
        });
        
        if (!stateChanged) return prev;

        const finalized = finalizeUserProgress(next);
        if (finalized.level > prev.level) {
          notificationsToFire.push({
            type: 'levelup',
            title: '🎉 Level Up!',
            message: `Welcome to Level ${finalized.level}!`,
          });
        }
        queueNotifications(notificationsToFire, showNotification);

        return finalized;
      });
      
      return newHistory;
    });
  }, [showNotification]);

  return (
    <GamificationContext.Provider value={{
      userProgress,
      processEvent: processGamificationEvent,
      syncPlanProgress,
      notification,
      showNotification,
      addXp,
    }}>
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
}
