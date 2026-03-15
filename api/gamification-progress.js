import { getGamificationProgress, putGamificationProgress } from '../lib/projectApi.js';
import { getBody, sendJson } from '../lib/vercelApi.js';

function getUserId(req, body = null) {
  return req.query?.userId || req.headers['x-user-id'] || body?.userId || null;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const result = await getGamificationProgress(getUserId(req));
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === 'PUT') {
      const body = getBody(req);
      const result = await putGamificationProgress(getUserId(req, body), body.progress);
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    res.setHeader('Allow', 'GET, PUT');
    sendJson(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error.message || 'Unable to handle gamification progress.',
    });
  }
}
