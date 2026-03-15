import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
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

  return {
    ...base,
    ...progress,
    userId: progress.userId || base.userId,
    total_xp: Number.isFinite(progress.total_xp) ? progress.total_xp : base.total_xp,
    level: Number.isFinite(progress.level) ? progress.level : calculateLevel(Number.isFinite(progress.total_xp) ? progress.total_xp : base.total_xp),
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

export function GamificationProvider({ children }) {
  const [userProgress, setUserProgress] = useState(() => createDefaultUserProgress());
  const [isHydrated, setIsHydrated] = useState(false);

  const [notification, setNotification] = useState(null);
  const [eventsHistory, setEventsHistory] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateProgress() {
      let fallbackProgress = null;
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          try {
            fallbackProgress = normalizeUserProgress(JSON.parse(saved));
          } catch (error) {
            console.error('Failed to parse gamification progress', error);
          }
        }
      }

      if (fallbackProgress && !cancelled) {
        setUserProgress(fallbackProgress);
      }

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
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userProgress));
    }
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
      const nextXp = prev.total_xp + amount;
      const nextLevel = calculateLevel(nextXp);
      
      const newItems = new Set(prev.unlocked_items);
      const newEvents = new Set(prev.unlocked_events);
      const newActions = new Set(prev.unlocked_actions);
      const newSkins = new Set(prev.unlocked_skins);

      if (nextLevel > prev.level) {
        for (let l = prev.level + 1; l <= nextLevel; l++) {
          const u = levelUnlocks[l];
          if (u) {
            (u.items || []).forEach(x => newItems.add(x));
            (u.events || []).forEach(x => newEvents.add(x));
            (u.actions || []).forEach(x => newActions.add(x));
            (u.skins || []).forEach(x => newSkins.add(x));
          }
        }
        setTimeout(() => showNotification('levelup', '🎉 Level Up!', `Welcome to Level ${nextLevel}!`), 0);
      }

      return {
        ...prev,
        total_xp: nextXp,
        level: nextLevel,
        unlocked_items: Array.from(newItems),
        unlocked_events: Array.from(newEvents),
        unlocked_actions: Array.from(newActions),
        unlocked_skins: Array.from(newSkins)
      };
    });
  }, [showNotification]);

  const processGamificationEvent = useCallback((event) => {
    setEventsHistory(prevHistory => {
      const newHistory = [...prevHistory, { ...event, timestamp: Date.now() }];
      
      setUserProgress(prev => {
        let xpGained = 0;
        let next = { ...prev };
        let stateChanged = false;
        const notificationsToFire = [];
        
        // 1. Mission Progress
        if (next.current_mission && !next.completed_missions.includes(next.current_mission)) {
          const mData = missionsData.find(m => m.id === next.current_mission);
          if (mData) {
            const mProg = { ...(next.mission_progress[mData.id] || {}) };
            let stepAdvanced = false;
            
            mData.steps.forEach(step => {
              const currentVal = mProg[step.id] || 0;
              if (currentVal < step.target) {
                const match = step.check(event);
                if (match) {
                  const amt = typeof match === 'number' ? match : 1;
                  mProg[step.id] = Math.min(step.target, currentVal + amt);
                  stepAdvanced = true;
                  xpGained += 5; // Step reward
                }
              }
            });
            
            if (stepAdvanced) {
              next.mission_progress = { ...next.mission_progress, [mData.id]: mProg };
              stateChanged = true;
              
              // check complete
              const allDone = mData.steps.every(s => (mProg[s.id] || 0) >= s.target);
              if (allDone) {
                next.completed_missions = [...next.completed_missions, mData.id];
                xpGained += mData.reward_xp;
                notificationsToFire.push({ type: 'mission', title: '⭐ Mission Complete!', msg: `${mData.title} completed`});
                
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
              xpGained += ach.reward_xp;
              notificationsToFire.push({ type: 'achievement', title: `🏆 Achievement Unlocked: ${ach.name}`, msg: ach.description });
              stateChanged = true;
            }
          }
        });
        
        if (xpGained > 0) {
          next.total_xp += xpGained;
          const newLevel = calculateLevel(next.total_xp);
          
          if (newLevel > next.level) {
            const newItems = new Set(next.unlocked_items);
            const newEvents = new Set(next.unlocked_events);
            const newActions = new Set(next.unlocked_actions);
            const newSkins = new Set(next.unlocked_skins);
            
            for (let l = next.level + 1; l <= newLevel; l++) {
              const u = levelUnlocks[l];
              if (u) {
                (u.items || []).forEach(x => newItems.add(x));
                (u.events || []).forEach(x => newEvents.add(x));
                (u.actions || []).forEach(x => newActions.add(x));
                (u.skins || []).forEach(x => newSkins.add(x));
              }
            }
            
            next.unlocked_items = Array.from(newItems);
            next.unlocked_events = Array.from(newEvents);
            next.unlocked_actions = Array.from(newActions);
            next.unlocked_skins = Array.from(newSkins);
            next.level = newLevel;
            
            notificationsToFire.push({ type: 'levelup', title: '🎉 Level Up!', msg: `Welcome to Level ${newLevel}!` });
          }
          stateChanged = true;
        }

        // Fire notifications (setTimeout to avoid doing it inside setState exactly)
        if (notificationsToFire.length > 0) {
          setTimeout(() => {
            notificationsToFire.forEach((n, idx) => {
               setTimeout(() => showNotification(n.type, n.title, n.msg), idx * 2000); // Stagger
            });
          }, 0);
        }

        return stateChanged ? next : prev;
      });
      
      return newHistory;
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
