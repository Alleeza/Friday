const PROJECT_STATE_ENDPOINT = '/api/project-state';
const PUBLISHED_PROJECT_ENDPOINT = '/api/published-project';
const LOCAL_STORAGE_KEY = 'friday-codequest-project-state';

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readLocalProjectState() {
  if (!canUseLocalStorage()) return null;
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

function writeLocalProjectState(project) {
  if (!canUseLocalStorage()) return project;
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(project));
  return project;
}

export async function loadProjectState() {
  try {
    const response = await fetch(PROJECT_STATE_ENDPOINT);
    if (!response.ok) {
      throw new Error(`Load failed with status ${response.status}`);
    }
    const payload = await response.json();
    const project = payload.project || null;
    if (project) writeLocalProjectState(project);
    return project;
  } catch {
    return readLocalProjectState();
  }
}

export async function saveProjectState(project) {
  try {
    const response = await fetch(PROJECT_STATE_ENDPOINT, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ project }),
    });

    if (!response.ok) {
      throw new Error(`Save failed with status ${response.status}`);
    }

    const payload = await response.json();
    const savedProject = payload.project || null;
    if (savedProject) writeLocalProjectState(savedProject);
    return savedProject;
  } catch {
    return writeLocalProjectState(project);
  }
}

export async function publishSavedProject() {
  const response = await fetch(PUBLISHED_PROJECT_ENDPOINT, {
    method: 'POST',
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
