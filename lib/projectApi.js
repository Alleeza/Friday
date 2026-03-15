import {
  loadGamificationProgress,
  loadProject,
  loadPublishedProject,
  publishProject,
  saveGamificationProgress,
  saveProject,
} from './supabaseStorage.js';

function requireProjectId(projectId) {
  if (!projectId) {
    const error = new Error('Missing projectId.');
    error.statusCode = 400;
    throw error;
  }
}

function requireUserId(userId) {
  if (!userId) {
    const error = new Error('Missing userId.');
    error.statusCode = 400;
    throw error;
  }
}

export async function getProjectState(projectId) {
  requireProjectId(projectId);
  return {
    statusCode: 200,
    payload: {
      project: await loadProject(projectId),
    },
  };
}

export async function putProjectState(projectId, project) {
  requireProjectId(projectId);
  return {
    statusCode: 200,
    payload: {
      project: await saveProject(projectId, project || {}),
    },
  };
}

export async function postPublishedProject(projectId) {
  requireProjectId(projectId);
  const publication = await publishProject(projectId);
  return {
    statusCode: 200,
    payload: {
      publication: {
        ...publication,
        sharePath: `/play/gamemakeSession/${publication.projectId}/${publication.shareId}`,
      },
    },
  };
}

export async function getPublishedProject(projectId, shareId) {
  requireProjectId(projectId);
  const publication = shareId ? await loadPublishedProject(projectId, shareId) : null;
  if (!publication) {
    return {
      statusCode: 404,
      payload: { error: 'Shared game not found.' },
    };
  }

  return {
    statusCode: 200,
    payload: { publication },
  };
}

export async function getGamificationProgress(userId) {
  requireUserId(userId);
  return {
    statusCode: 200,
    payload: {
      progress: await loadGamificationProgress(userId),
    },
  };
}

export async function putGamificationProgress(userId, progress) {
  requireUserId(userId);
  return {
    statusCode: 200,
    payload: {
      progress: await saveGamificationProgress(userId, progress || {}),
    },
  };
}
