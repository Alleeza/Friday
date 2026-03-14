import { getProjectState, putProjectState } from '../lib/projectApi.js';
import { formatErrorPayload } from '../lib/temporaryDiagnostics.js';
import { getBody, getProjectId, sendJson } from '../lib/vercelApi.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const result = await getProjectState(getProjectId(req));
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    if (req.method === 'PUT') {
      const body = getBody(req);
      const result = await putProjectState(
        body.projectId || getProjectId(req),
        body.project,
      );
      sendJson(res, result.statusCode, result.payload);
      return;
    }

    res.setHeader('Allow', 'GET, PUT');
    sendJson(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    sendJson(res, error.statusCode || 500, formatErrorPayload(error, 'Unable to handle project state.'));
  }
}
