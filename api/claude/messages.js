import { proxyAnthropicRequest } from '../../lib/anthropicProxy.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    await proxyAnthropicRequest(req, res, { upstreamPath: '/v1/messages' });
  } catch (error) {
    res.status(500).json({
      error: error?.message || 'Unable to reach Anthropic.',
    });
  }
}
