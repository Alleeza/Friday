import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const storageDir = path.join(projectRoot, 'server', 'storage');
const legacyStorageFile = path.join(storageDir, 'project-state.json');
const databaseFile = path.join(storageDir, 'friday.db');
const distDir = path.join(projectRoot, 'dist');
const port = Number(process.env.PORT || 3001);
const projectId = 'default';

const defaultProjectState = {
  setupData: null,
  scene: {
    placedAssets: [],
    selectedPlacedAssetKey: null,
    backdropState: null,
  },
  scriptsByInstanceKey: {},
};

function normalizeProjectState(projectState) {
  return {
    setupData: projectState?.setupData || null,
    scene: {
      ...defaultProjectState.scene,
      ...(projectState?.scene || {}),
    },
    scriptsByInstanceKey: projectState?.scriptsByInstanceKey || {},
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  };

  res.writeHead(200, {
    'Content-Type': contentTypes[extension] || 'application/octet-stream',
  });
  createReadStream(filePath).pipe(res);
}

async function ensureStorage() {
  await mkdir(storageDir, { recursive: true });
}

await ensureStorage();

const db = new DatabaseSync(databaseFile);
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    project_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS published_projects (
    project_id TEXT PRIMARY KEY,
    share_id TEXT NOT NULL UNIQUE,
    project_json TEXT NOT NULL,
    source_updated_at TEXT NOT NULL,
    published_at TEXT NOT NULL
  )
`);

const selectProjectStatement = db.prepare(`
  SELECT project_json, updated_at
  FROM projects
  WHERE id = ?
`);

const upsertProjectStatement = db.prepare(`
  INSERT INTO projects (id, project_json, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    project_json = excluded.project_json,
    updated_at = excluded.updated_at
`);

const selectPublishedProjectByProjectIdStatement = db.prepare(`
  SELECT share_id, project_json, source_updated_at, published_at
  FROM published_projects
  WHERE project_id = ?
`);

const selectPublishedProjectByShareIdStatement = db.prepare(`
  SELECT project_json, source_updated_at, published_at
  FROM published_projects
  WHERE share_id = ?
`);

const upsertPublishedProjectStatement = db.prepare(`
  INSERT INTO published_projects (project_id, share_id, project_json, source_updated_at, published_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(project_id) DO UPDATE SET
    share_id = excluded.share_id,
    project_json = excluded.project_json,
    source_updated_at = excluded.source_updated_at,
    published_at = excluded.published_at
`);

async function importLegacyProjectIfNeeded() {
  const existing = selectProjectStatement.get(projectId);
  if (existing) return;
  if (!existsSync(legacyStorageFile)) return;

  try {
    const raw = await readFile(legacyStorageFile, 'utf8');
    const parsed = JSON.parse(raw);
    const normalized = normalizeProjectState(parsed);
    const timestamp = parsed?.updatedAt || new Date().toISOString();
    upsertProjectStatement.run(projectId, JSON.stringify(normalized), timestamp);
  } catch {
    // Ignore malformed legacy data and start from a clean default.
  }
}

await importLegacyProjectIfNeeded();

function readProjectState() {
  const row = selectProjectStatement.get(projectId);
  if (!row) return defaultProjectState;

  const parsed = JSON.parse(row.project_json);
  return {
    ...normalizeProjectState(parsed),
    updatedAt: row.updated_at,
  };
}

function writeProjectState(projectState) {
  const normalized = normalizeProjectState(projectState);
  const updatedAt = new Date().toISOString();
  upsertProjectStatement.run(projectId, JSON.stringify(normalized), updatedAt);
  return {
    ...normalized,
    updatedAt,
  };
}

function publishProjectState() {
  const savedProjectRow = selectProjectStatement.get(projectId);
  if (!savedProjectRow) {
    throw new Error('Save the project before generating a share link.');
  }

  const existingPublished = selectPublishedProjectByProjectIdStatement.get(projectId);
  const shareId = existingPublished?.share_id || crypto.randomBytes(9).toString('base64url');
  const publishedAt = new Date().toISOString();
  const normalized = normalizeProjectState(JSON.parse(savedProjectRow.project_json));

  upsertPublishedProjectStatement.run(
    projectId,
    shareId,
    JSON.stringify(normalized),
    savedProjectRow.updated_at,
    publishedAt,
  );

  return {
    shareId,
    publishedAt,
    sourceUpdatedAt: savedProjectRow.updated_at,
    project: normalized,
  };
}

function readPublishedProject(shareId) {
  const row = selectPublishedProjectByShareIdStatement.get(shareId);
  if (!row) return null;

  return {
    shareId,
    project: normalizeProjectState(JSON.parse(row.project_json)),
    sourceUpdatedAt: row.source_updated_at,
    publishedAt: row.published_at,
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (requestUrl.pathname === '/api/project-state' && req.method === 'GET') {
    try {
      const project = readProjectState();
      sendJson(res, 200, { project });
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'Unable to load project state.' });
    }
    return;
  }

  if (requestUrl.pathname === '/api/project-state' && req.method === 'PUT') {
    try {
      const rawBody = await readBody(req);
      const parsed = rawBody ? JSON.parse(rawBody) : {};
      const project = writeProjectState(parsed?.project || {});
      sendJson(res, 200, { project });
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Unable to save project state.' });
    }
    return;
  }

  if (requestUrl.pathname === '/api/published-project' && req.method === 'POST') {
    try {
      const publication = publishProjectState();
      sendJson(res, 200, {
        publication: {
          ...publication,
          sharePath: `/play/${publication.shareId}`,
        },
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Unable to publish project.' });
    }
    return;
  }

  if (requestUrl.pathname.startsWith('/api/published-project/') && req.method === 'GET') {
    try {
      const shareId = requestUrl.pathname.split('/').pop();
      const publication = shareId ? readPublishedProject(shareId) : null;
      if (!publication) {
        sendJson(res, 404, { error: 'Shared game not found.' });
        return;
      }
      sendJson(res, 200, { publication });
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'Unable to load shared game.' });
    }
    return;
  }

  if (!existsSync(distDir)) {
    sendJson(res, 404, { error: 'Frontend build not found. Run "npm run build" first.' });
    return;
  }

  const requestedPath = requestUrl.pathname === '/'
    ? path.join(distDir, 'index.html')
    : path.join(distDir, requestUrl.pathname.replace(/^\/+/, ''));

  if (existsSync(requestedPath) && !requestedPath.endsWith(path.sep)) {
    sendFile(res, requestedPath);
    return;
  }

  sendFile(res, path.join(distDir, 'index.html'));
});

server.listen(port, () => {
  process.stdout.write(`Friday backend listening on http://localhost:${port}\n`);
});
