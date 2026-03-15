const GAMIFICATION_PROGRESS_ENDPOINT = '/api/gamification-progress';
const GAMIFICATION_USER_ID_STORAGE_KEY = 'friday-gamification-user-id';
const DEFAULT_USER_ID = 'questy_user_1';

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getGamificationUserId() {
  if (!canUseLocalStorage()) {
    return DEFAULT_USER_ID;
  }

  const existingUserId = window.localStorage.getItem(GAMIFICATION_USER_ID_STORAGE_KEY);
  if (existingUserId) return existingUserId;

  window.localStorage.setItem(GAMIFICATION_USER_ID_STORAGE_KEY, DEFAULT_USER_ID);
  return DEFAULT_USER_ID;
}

export async function loadGamificationProgress() {
  const response = await fetch(`${GAMIFICATION_PROGRESS_ENDPOINT}?userId=${encodeURIComponent(getGamificationUserId())}`);

  if (!response.ok) {
    throw new Error(`Load failed with status ${response.status}`);
  }

  const payload = await response.json();
  return payload.progress || null;
}

export async function saveGamificationProgress(progress) {
  const response = await fetch(GAMIFICATION_PROGRESS_ENDPOINT, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: getGamificationUserId(),
      progress,
    }),
  });

  if (!response.ok) {
    throw new Error(`Save failed with status ${response.status}`);
  }

  const payload = await response.json();
  return payload.progress || null;
}
