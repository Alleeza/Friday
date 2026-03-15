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
import {
  getGamificationUserId,
  loadGamificationProgress,
  saveGamificationProgress,
} from '../api/gamificationProgress';

const GamificationContext = createContext(null);

const LOCAL_STORAGE_KEY = 'gamification_progress';

function createDefaultUserProgress() {
  return {
    userId: getGamificationUserId(),
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
  const defaults = createDefaultUserProgress();
  const progress = {
    ...defaults,
    ...rawProgress,
    userId: rawProgress?.userId || defaults.userId,
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

function normalizeUserProgress(progress = {}) {
  return finalizeUserProgress({
    ...createDefaultUserProgress(),
    ...progress,
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
    const saved = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? normalizeUserProgress(JSON.parse(saved)) : createDefaultUserProgress();
  } catch (error) {
    console.error('Failed to parse gamification progress', error);
    return createDefaultUserProgress();
  }
}

export function GamificationProvider({ children }) {
  const [userProgress, setUserProgress] = useState(() => loadSavedUserProgress());
  const [isHydrated, setIsHydrated] = useState(false);
  const [notification, setNotification] = useState(null);
  const [eventsHistory, setEventsHistory] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateProgress() {
      try {
        const remote = await loadGamificationProgress();
        if (!cancelled && remote?.progress) {
          setUserProgress(normalizeUserProgress(remote.progress));
        }
      } catch (error) {
        console.error('Failed to load gamification progress from API', error);
      } finally {
        if (!cancelled) {
          setIsHydrated(true);
        }
      }
    }

    hydrateProgress();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userProgress));
  }, [userProgress]);

  useEffect(() => {
    if (!isHydrated) return;

    let cancelled = false;
    saveGamificationProgress(userProgress).catch((error) => {
      if (!cancelled) {
        console.error('Failed to save gamification progress to API', error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isHydrated, userProgress]);

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
    setEventsHistory((prevHistory) => {
      const newHistory = [...prevHistory, { ...event, timestamp: Date.now() }];

      setUserProgress((prev) => {
        let next = { ...prev };
        let stateChanged = false;
        const notificationsToFire = [];

        if (next.progress_mode !== 'plan' && next.current_mission && !next.completed_missions.includes(next.current_mission)) {
          const mData = missionsData.find((mission) => mission.id === next.current_mission);
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

              const allDone = mData.steps.every((step) => (mProg[step.id] || 0) >= step.target);
              if (allDone) {
                next.completed_missions = [...next.completed_missions, mData.id];
                notificationsToFire.push({ type: 'mission', title: '⭐ Mission Complete!', message: `${mData.title} completed` });

                const missionIndex = missionsData.findIndex((mission) => mission.id === mData.id);
                if (missionIndex < missionsData.length - 1) {
                  next.current_mission = missionsData[missionIndex + 1].id;
                } else {
                  next.current_mission = null;
                }
              }
            }
          }
        }

        achievementsData.forEach((achievement) => {
          if (!next.achievements.includes(achievement.id) && achievement.condition(newHistory, next)) {
            next.achievements = [...next.achievements, achievement.id];
            notificationsToFire.push({
              type: 'achievement',
              title: `🏆 Achievement Unlocked: ${achievement.name}`,
              message: achievement.description,
            });
            stateChanged = true;
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
    }}
    >
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
