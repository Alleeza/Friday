function normalizeBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

export function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

export function getProjectId(req) {
  return req.query?.projectId || req.headers['x-project-id'] || null;
}

export function getBody(req) {
  return normalizeBody(req.body);
}
