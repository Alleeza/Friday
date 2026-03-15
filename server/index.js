import { appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalEnv } from '../lib/loadLocalEnv.js';
import {
  getProjectState,
  getPublishedProject,
  postPublishedProject,
  putProjectState,
} from '../lib/projectApi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const plannerDebugDir = path.join(projectRoot, '.planner-debug');
const plannerDebugLogPath = path.join(plannerDebugDir, 'planner-runs.jsonl');
const plannerDebugLatestPath = path.join(plannerDebugDir, 'latest-planner-run.json');
const port = Number(process.env.PORT || 3001);

loadLocalEnv(projectRoot);

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Project-Id',
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, error, fallbackMessage, fallbackStatusCode = 500) {
  sendJson(res, error?.statusCode || fallbackStatusCode, {
    error: error?.message || fallbackMessage,
  });
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

function ensurePlannerDebugDir() {
  if (!existsSync(plannerDebugDir)) {
    mkdirSync(plannerDebugDir, { recursive: true });
  }
}

function writePlannerDebugRun(run) {
  ensurePlannerDebugDir();

  const payload = {
    ...run,
    receivedAt: new Date().toISOString(),
  };

  appendFileSync(plannerDebugLogPath, `${JSON.stringify(payload)}\n`, 'utf8');
  writeFileSync(plannerDebugLatestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  return {
    ok: true,
    logPath: path.relative(projectRoot, plannerDebugLogPath),
    latestPath: path.relative(projectRoot, plannerDebugLatestPath),
  };
}

function readPlannerDebugRuns(limit = 10) {
  if (!existsSync(plannerDebugLogPath)) return [];

  const lines = readFileSync(plannerDebugLogPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.slice(-Math.max(1, limit)).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return {
        parseError: 'Could not parse planner debug line',
        raw: line,
      };
    }
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Project-Id',
    });
    res.end();
    return;
  }

  if (requestUrl.pathname === '/api/project-state' && req.method === 'GET') {
    try {
      const result = await getProjectState(requestUrl.searchParams.get('projectId'));
      sendJson(res, result.statusCode, result.payload);
    } catch (error) {
      sendError(res, error, 'Unable to load project state.');
    }
    return;
  }

  if (requestUrl.pathname === '/api/project-state' && req.method === 'PUT') {
    try {
      const rawBody = await readBody(req);
      const parsed = rawBody ? JSON.parse(rawBody) : {};
      const result = await putProjectState(parsed?.projectId, parsed?.project);
      sendJson(res, result.statusCode, result.payload);
    } catch (error) {
      sendError(res, error, 'Unable to save project state.', 400);
    }
    return;
  }

  if (requestUrl.pathname === '/api/published-project' && req.method === 'POST') {
    try {
      const rawBody = await readBody(req);
      const parsed = rawBody ? JSON.parse(rawBody) : {};
      const result = await postPublishedProject(parsed?.projectId);
      sendJson(res, result.statusCode, result.payload);
    } catch (error) {
      sendError(res, error, 'Unable to publish project.', 400);
    }
    return;
  }

  if (requestUrl.pathname === '/api/planner-debug' && req.method === 'POST') {
    try {
      const rawBody = await readBody(req);
      const parsed = rawBody ? JSON.parse(rawBody) : {};
      const result = writePlannerDebugRun(parsed);
      sendJson(res, 200, result);
    } catch (error) {
      sendError(res, error, 'Unable to write planner debug log.', 400);
    }
    return;
  }

  if (requestUrl.pathname === '/api/planner-debug' && req.method === 'GET') {
    try {
      sendJson(res, 200, {
        logPath: path.relative(projectRoot, plannerDebugLogPath),
        latestPath: path.relative(projectRoot, plannerDebugLatestPath),
        runs: readPlannerDebugRuns(Number(requestUrl.searchParams.get('limit') || 10)),
      });
    } catch (error) {
      sendError(res, error, 'Unable to read planner debug logs.');
    }
    return;
  }

  if (requestUrl.pathname.startsWith('/api/published-project/') && req.method === 'GET') {
    try {
      const shareId = requestUrl.pathname.split('/').pop();
      const result = await getPublishedProject(requestUrl.searchParams.get('projectId'), shareId);
      sendJson(res, result.statusCode, result.payload);
    } catch (error) {
      sendError(res, error, 'Unable to load shared game.');
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
