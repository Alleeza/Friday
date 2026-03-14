import { postPublishedProject } from '../../lib/projectApi.js';
import { getPublishedProject } from '../../lib/projectApi.js';
import { formatErrorPayload } from '../../lib/temporaryDiagnostics.js';
import { getBody, getProjectId, sendJson } from '../../lib/vercelApi.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const result = await getPublishedProject(req.query?.shareId || null);
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === 'POST') {
      const body = getBody(req);
      const result = await postPublishedProject(body.projectId || getProjectId(req));
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    sendJson(res, error.statusCode || 500, formatErrorPayload(error, 'Unable to handle published project request.'));
  }
}
