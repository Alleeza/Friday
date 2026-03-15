import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { calculateLevel, levelUnlocks } from '../gamification/levels';
import { achievementsData } from '../gamification/achievements';
import { missionsData } from '../gamification/missions';
import {
  getGamificationUserId,
  loadGamificationProgress,
  saveGamificationProgress,
} from '../api/gamificationProgress';

const GamificationContext = createContext(null);

const LOCAL_STORAGE_KEY = 'gamification_progress';
const MAX_EVENTS_HISTORY = 500;

function createDefaultUserProgress() {
  return {
    userId: getGamificationUserId(),
    total_xp: 0,
    level: 1,
    current_mission: 'mission_1',
    completed_missions: [],
    achievements: [],
    unlocked_items: [],
    unlocked_events: [],
    unlocked_actions: [],
    unlocked_skins: [],
    mission_progress: {},
  };
}

function normalizeUserProgress(progress = {}) {
  const base = createDefaultUserProgress();
  const totalXp = Number.isFinite(progress.total_xp) ? progress.total_xp : base.total_xp;

  return {
    ...base,
    ...progress,
    userId: progress.userId || base.userId,
    total_xp: totalXp,
    level: Number.isFinite(progress.level) ? progress.level : calculateLevel(totalXp),
    completed_missions: Array.isArray(progress.completed_missions) ? progress.completed_missions : base.completed_missions,
    achievements: Array.isArray(progress.achievements) ? progress.achievements : base.achievements,
    unlocked_items: Array.isArray(progress.unlocked_items) ? progress.unlocked_items : base.unlocked_items,
    unlocked_events: Array.isArray(progress.unlocked_events) ? progress.unlocked_events : base.unlocked_events,
    unlocked_actions: Array.isArray(progress.unlocked_actions) ? progress.unlocked_actions : base.unlocked_actions,
    unlocked_skins: Array.isArray(progress.unlocked_skins) ? progress.unlocked_skins : base.unlocked_skins,
    mission_progress: progress.mission_progress && typeof progress.mission_progress === 'object'
      ? progress.mission_progress
      : base.mission_progress,
  };
}

function normalizeEventsHistory(eventsHistory) {
  if (!Array.isArray(eventsHistory)) return [];

  return eventsHistory
    .filter((event) => event && typeof event === 'object')
    .map((event) => ({
      ...event,
      timestamp: Number.isFinite(event.timestamp) ? event.timestamp : Date.now(),
    }))
    .slice(-MAX_EVENTS_HISTORY);
}

function createPersistedSnapshot(userProgress, eventsHistory) {
  return {
    userProgress,
    eventsHistory: normalizeEventsHistory(eventsHistory),
  };
}

function normalizePersistedSnapshot(saved = {}) {
  if (saved?.userProgress || saved?.eventsHistory) {
    return {
      userProgress: normalizeUserProgress(saved.userProgress),
      eventsHistory: normalizeEventsHistory(saved.eventsHistory),
    };
  }

  return {
    userProgress: normalizeUserProgress(saved),
    eventsHistory: [],
  };
}

function applyLevelUnlocks(progress, nextLevel) {
  const newItems = new Set(progress.unlocked_items);
  const newEvents = new Set(progress.unlocked_events);
  const newActions = new Set(progress.unlocked_actions);
  const newSkins = new Set(progress.unlocked_skins);

  for (let level = progress.level + 1; level <= nextLevel; level += 1) {
    const unlocks = levelUnlocks[level];
    if (!unlocks) continue;
    (unlocks.items || []).forEach((item) => newItems.add(item));
    (unlocks.events || []).forEach((item) => newEvents.add(item));
    (unlocks.actions || []).forEach((item) => newActions.add(item));
    (unlocks.skins || []).forEach((item) => newSkins.add(item));
  }

  return {
    ...progress,
    level: nextLevel,
    unlocked_items: Array.from(newItems),
    unlocked_events: Array.from(newEvents),
    unlocked_actions: Array.from(newActions),
    unlocked_skins: Array.from(newSkins),
  };
}

export function GamificationProvider({ children }) {
  const [userProgress, setUserProgress] = useState(() => createDefaultUserProgress());
  const [isHydrated, setIsHydrated] = useState(false);
  const [notification, setNotification] = useState(null);
  const [eventsHistory, setEventsHistory] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateProgress() {
      let fallbackSnapshot = null;
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          try {
            fallbackSnapshot = normalizePersistedSnapshot(JSON.parse(saved));
          } catch (error) {
            console.error('Failed to parse gamification progress', error);
          }
        }
      }

      if (fallbackSnapshot && !cancelled) {
        setUserProgress(fallbackSnapshot.userProgress);
        setEventsHistory(fallbackSnapshot.eventsHistory);
      }

      try {
        const remote = await loadGamificationProgress();
        if (!cancelled && remote) {
          const normalized = normalizePersistedSnapshot(remote.progress ?? remote);
          setUserProgress(normalized.userProgress);
          setEventsHistory(normalized.eventsHistory);
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
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify(createPersistedSnapshot(userProgress, eventsHistory)),
      );
    }
  }, [eventsHistory, userProgress]);

  useEffect(() => {
    if (!isHydrated) return;

    let cancelled = false;
    saveGamificationProgress(createPersistedSnapshot(userProgress, eventsHistory)).catch((error) => {
      if (!cancelled) {
        console.error('Failed to save gamification progress to API', error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [eventsHistory, isHydrated, userProgress]);

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
      const nextXp = prev.total_xp + amount;
      const nextLevel = calculateLevel(nextXp);
      const nextProgress = nextLevel > prev.level
        ? applyLevelUnlocks({ ...prev, total_xp: nextXp }, nextLevel)
        : { ...prev, total_xp: nextXp, level: nextLevel };

      if (nextLevel > prev.level) {
        setTimeout(() => showNotification('levelup', 'Level Up!', `Welcome to Level ${nextLevel}!`), 0);
      }

      return nextProgress;
    });
  }, [showNotification]);

  const processGamificationEvent = useCallback((event) => {
    setEventsHistory((prevHistory) => {
      const timestamp = Date.now();
      const incomingEvents = [{ ...event, timestamp }];

      setUserProgress((prev) => {
        let xpGained = 0;
        let next = { ...prev };
        let stateChanged = false;
        const notificationsToFire = [];
        const missionCompletionEvents = [];

        if (next.current_mission && !next.completed_missions.includes(next.current_mission)) {
          const mission = missionsData.find((item) => item.id === next.current_mission);
          if (mission) {
            const missionProgress = { ...(next.mission_progress[mission.id] || {}) };
            let stepAdvanced = false;

            mission.steps.forEach((step) => {
              const currentValue = missionProgress[step.id] || 0;
              if (currentValue >= step.target) return;

              const match = step.check(event);
              if (!match) return;

              const amount = typeof match === 'number' ? match : 1;
              missionProgress[step.id] = Math.min(step.target, currentValue + amount);
              stepAdvanced = true;
              xpGained += 5;
            });

            if (stepAdvanced) {
              next.mission_progress = { ...next.mission_progress, [mission.id]: missionProgress };
              stateChanged = true;

              const allDone = mission.steps.every((step) => (missionProgress[step.id] || 0) >= step.target);
              if (allDone) {
                next.completed_missions = [...next.completed_missions, mission.id];
                xpGained += mission.reward_xp;
                notificationsToFire.push({
                  type: 'mission',
                  title: 'Mission Complete!',
                  msg: `${mission.title} completed`,
                });
                missionCompletionEvents.push({
                  type: 'MissionCompleted',
                  payload: {
                    missionId: mission.id,
                    title: mission.title,
                    timeTaken: Number.isFinite(event?.payload?.timeTaken) ? event.payload.timeTaken : undefined,
                  },
                  timestamp,
                });

                const missionIndex = missionsData.findIndex((item) => item.id === mission.id);
                next.current_mission = missionIndex < missionsData.length - 1
                  ? missionsData[missionIndex + 1].id
                  : null;
              }
            }
          }
        }

        const combinedHistory = normalizeEventsHistory([...prevHistory, ...incomingEvents, ...missionCompletionEvents]);

        achievementsData.forEach((achievement) => {
          if (next.achievements.includes(achievement.id)) return;
          if (!achievement.condition(combinedHistory, next)) return;

          next.achievements = [...next.achievements, achievement.id];
          xpGained += achievement.reward_xp;
          notificationsToFire.push({
            type: 'achievement',
            title: `Achievement Unlocked: ${achievement.name}`,
            msg: achievement.description,
          });
          stateChanged = true;
        });

        if (xpGained > 0) {
          next.total_xp += xpGained;
          const newLevel = calculateLevel(next.total_xp);
          if (newLevel > next.level) {
            next = applyLevelUnlocks(next, newLevel);
            notificationsToFire.push({
              type: 'levelup',
              title: 'Level Up!',
              msg: `Welcome to Level ${newLevel}!`,
            });
          } else {
            next.level = newLevel;
          }
          stateChanged = true;
        }

        if (notificationsToFire.length > 0) {
          setTimeout(() => {
            notificationsToFire.forEach((notificationItem, idx) => {
              setTimeout(() => {
                showNotification(notificationItem.type, notificationItem.title, notificationItem.msg);
              }, idx * 2000);
            });
          }, 0);
        }

        return stateChanged ? next : prev;
      });

      return normalizeEventsHistory([...prevHistory, ...incomingEvents]);
    });
  }, [showNotification]);

  return (
    <GamificationContext.Provider value={{ userProgress, processEvent: processGamificationEvent, notification, showNotification, addXp }}>
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
