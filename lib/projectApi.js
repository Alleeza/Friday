import {
  loadProject,
  loadPublishedProject,
  publishProject,
  saveProject,
} from './supabaseStorage.js';

function requireProjectId(projectId) {
  if (!projectId) {
    const error = new Error('Missing projectId.');
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
        sharePath: `/play/${publication.shareId}`,
      },
    },
  };
}

export async function getPublishedProject(shareId) {
  const publication = shareId ? await loadPublishedProject(shareId) : null;
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
