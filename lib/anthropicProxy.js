const ANTHROPIC_API_BASE_URL = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';

function getAnthropicApiKey() {
  return String(process.env.ANTHROPIC_API_KEY || '').trim();
}

export async function proxyAnthropicRequest(req, res, { upstreamPath }) {
  const apiKey = getAnthropicApiKey();

  if (!apiKey) {
    res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not configured on the server.',
    });
    return;
  }

  const init = {
    method: req.method,
    headers: {
      'anthropic-version': ANTHROPIC_VERSION,
      'x-api-key': apiKey,
    },
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}));
  }

  const upstreamResponse = await fetch(`${ANTHROPIC_API_BASE_URL}${upstreamPath}`, init);
  const contentType = upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8';

  res.status(upstreamResponse.status);
  res.setHeader('Content-Type', contentType);

  const requestId = upstreamResponse.headers.get('request-id');
  if (requestId) {
    res.setHeader('request-id', requestId);
  }

  const retryAfter = upstreamResponse.headers.get('retry-after');
  if (retryAfter) {
    res.setHeader('retry-after', retryAfter);
  }

  if (contentType.includes('text/event-stream')) {
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const reader = upstreamResponse.body?.getReader();
    if (!reader) {
      res.end();
      return;
    }

    const encoder = new TextEncoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
    return;
  }

  const text = await upstreamResponse.text();
  res.send(text);
}
