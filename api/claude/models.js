import { proxyAnthropicRequest } from '../../lib/anthropicProxy.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    await proxyAnthropicRequest(req, res, { upstreamPath: '/v1/models' });
  } catch (error) {
    res.status(500).json({
      error: error?.message || 'Unable to reach Anthropic.',
    });
  }
}
