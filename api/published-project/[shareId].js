import { getPublishedProject } from '../../lib/projectApi.js';
import { sendJson } from '../../lib/vercelApi.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }

    const result = await getPublishedProject(req.query?.projectId || null, req.query?.shareId || null);
    sendJson(res, result.statusCode, result.payload);
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error.message || 'Unable to load shared game.',
    });
  }
}
