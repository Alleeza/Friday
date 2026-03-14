const PROJECT_STATE_ENDPOINT = '/api/project-state';
const PUBLISHED_PROJECT_ENDPOINT = '/api/published-project';
const PROJECT_ID_STORAGE_KEY = 'friday-codequest-project-id';

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function createProjectId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `project-${Date.now()}`;
}

function getProjectId() {
  if (!canUseLocalStorage()) {
    return createProjectId();
  }

  const existingProjectId = window.localStorage.getItem(PROJECT_ID_STORAGE_KEY);
  if (existingProjectId) return existingProjectId;

  const nextProjectId = createProjectId();
  window.localStorage.setItem(PROJECT_ID_STORAGE_KEY, nextProjectId);
  return nextProjectId;
}

export async function loadProjectState() {
  const response = await fetch(`${PROJECT_STATE_ENDPOINT}?projectId=${encodeURIComponent(getProjectId())}`);

  if (!response.ok) {
    throw new Error(`Load failed with status ${response.status}`);
  }

  const payload = await response.json();
  return payload.project || null;
}

export async function saveProjectState(project) {
  const response = await fetch(PROJECT_STATE_ENDPOINT, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId: getProjectId(),
      project,
    }),
  });

  if (!response.ok) {
    throw new Error(`Save failed with status ${response.status}`);
  }

  const payload = await response.json();
  return payload.project || null;
}

export async function publishSavedProject() {
  const response = await fetch(PUBLISHED_PROJECT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId: getProjectId(),
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Publish failed with status ${response.status}`);
  }

  const payload = await response.json();
  return payload.publication || null;
}

export async function loadPublishedProject(shareId) {
  const response = await fetch(`${PUBLISHED_PROJECT_ENDPOINT}/${encodeURIComponent(shareId)}`);

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Load failed with status ${response.status}`);
  }

  const payload = await response.json();
  return payload.publication || null;
}
