import crypto from 'node:crypto';
import { defaultProjectState, normalizeProjectState } from './projectState.js';

const editorProjectsTable = 'editor_projects';
const publishedProjectsTable = 'published_projects';

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return {
    baseUrl: `${supabaseUrl.replace(/\/+$/, '')}/rest/v1`,
    serviceRoleKey,
  };
}

async function supabaseRequest(pathname, { method = 'GET', body = null, prefer = '' } = {}) {
  const { baseUrl, serviceRoleKey } = getSupabaseConfig();
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  if (body !== null) {
    headers['Content-Type'] = 'application/json';
  }

  if (prefer) {
    headers.Prefer = prefer;
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body === null ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `Supabase request failed with status ${response.status}.`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function createFilter(value) {
  return `eq.${encodeURIComponent(value)}`;
}

export async function loadProject(projectId) {
  const rows = await supabaseRequest(
    `/${editorProjectsTable}?id=${createFilter(projectId)}&select=project_json,updated_at`,
  );

  const row = rows?.[0];
  if (!row) return null;

  return {
    ...normalizeProjectState(row.project_json),
    updatedAt: row.updated_at,
  };
}

export async function saveProject(projectId, projectState) {
  const normalized = normalizeProjectState(projectState);
  const updatedAt = new Date().toISOString();
  const rows = await supabaseRequest(`/${editorProjectsTable}?on_conflict=id`, {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: [{
      id: projectId,
      project_json: normalized,
      updated_at: updatedAt,
    }],
  });

  const row = rows?.[0];
  return {
    ...normalizeProjectState(row?.project_json || normalized),
    updatedAt: row?.updated_at || updatedAt,
  };
}

export async function publishProject(projectId) {
  const savedProject = await loadProject(projectId);
  if (!savedProject) {
    throw new Error('Save the project before generating a share link.');
  }

  const shareId = crypto.randomBytes(9).toString('base64url');
  const publishedAt = new Date().toISOString();
  const normalizedProject = normalizeProjectState(savedProject);

  const rows = await supabaseRequest(`/${publishedProjectsTable}`, {
    method: 'POST',
    prefer: 'return=representation',
    body: [{
      project_id: projectId,
      share_id: shareId,
      project_json: normalizedProject,
      source_updated_at: savedProject.updatedAt || publishedAt,
      published_at: publishedAt,
    }],
  });

  const row = rows?.[0];
  return {
    shareId: row?.share_id || shareId,
    publishedAt: row?.published_at || publishedAt,
    sourceUpdatedAt: row?.source_updated_at || savedProject.updatedAt || publishedAt,
    project: normalizeProjectState(row?.project_json || normalizedProject),
  };
}

export async function loadPublishedProject(shareId) {
  const rows = await supabaseRequest(
    `/${publishedProjectsTable}?share_id=${createFilter(shareId)}&select=project_json,source_updated_at,published_at`,
  );

  const row = rows?.[0];
  if (!row) return null;

  return {
    shareId,
    project: normalizeProjectState(row.project_json),
    sourceUpdatedAt: row.source_updated_at,
    publishedAt: row.published_at,
  };
}

export { defaultProjectState };
