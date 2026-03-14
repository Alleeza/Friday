import { postPublishedProject } from '../../lib/projectApi.js';
import { getBody, getProjectId, sendJson } from '../../lib/vercelApi.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }

    const body = getBody(req);
    const result = await postPublishedProject(body.projectId || getProjectId(req));
    sendJson(res, result.statusCode, result.payload);
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error.message || 'Unable to publish project.',
    });
  }
}
