import {
  loadProject,
  loadPublishedProject,
  publishProject,
  saveProject,
} from './supabaseStorage.js';
import { attachDiagnostic, createDiagnosticError } from './temporaryDiagnostics.js';

function requireProjectId(projectId) {
  if (!projectId) {
    throw createDiagnosticError('Missing projectId.', { step: 'request.validate-project-id' }, 400);
  }
}

export async function getProjectState(projectId) {
  requireProjectId(projectId);
  let project;
  try {
    project = await loadProject(projectId);
  } catch (error) {
    throw attachDiagnostic(error, { route: 'getProjectState', projectId });
  }
  return {
    statusCode: 200,
    payload: {
      project,
    },
  };
}

export async function putProjectState(projectId, project) {
  requireProjectId(projectId);
  let savedProject;
  try {
    savedProject = await saveProject(projectId, project || {});
  } catch (error) {
    throw attachDiagnostic(error, { route: 'putProjectState', projectId });
  }
  return {
    statusCode: 200,
    payload: {
      project: savedProject,
    },
  };
}

export async function postPublishedProject(projectId) {
  requireProjectId(projectId);
  let publication;
  try {
    publication = await publishProject(projectId);
  } catch (error) {
    throw attachDiagnostic(error, { route: 'postPublishedProject', projectId });
  }
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
  let publication = null;
  try {
    publication = shareId ? await loadPublishedProject(shareId) : null;
  } catch (error) {
    throw attachDiagnostic(error, { route: 'getPublishedProject', shareId: shareId || null });
  }
  if (!publication) {
    return {
      statusCode: 404,
      payload: {
        error: 'Shared game not found.',
        diagnostic: {
          step: 'published.load',
          route: 'getPublishedProject',
          shareId: shareId || null,
          publicationFound: false,
        },
      },
    };
  }

  return {
    statusCode: 200,
    payload: { publication },
  };
}
