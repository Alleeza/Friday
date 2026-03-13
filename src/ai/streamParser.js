/**
 * parseSSEStream — parses a Server-Sent Events stream from the Claude API.
 *
 * Reads the response body as a stream, buffers partial lines, and fires
 * onChunk for every text delta from `content_block_delta` events.
 *
 * @param {Response} response - fetch Response with a readable body stream
 * @param {(delta: string) => void} onChunk - called for each text fragment
 * @returns {Promise<string>} resolves with the full assembled text
 */
export async function parseSSEStream(response, onChunk) {
  if (!response.body) throw new Error('Response body is not readable');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last (possibly incomplete) line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return fullText;

        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          // Skip malformed SSE events
          continue;
        }

        if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
          const chunk = parsed.delta.text ?? '';
          fullText += chunk;
          onChunk(chunk);
        }

        // Handle message_stop as end signal
        if (parsed.type === 'message_stop') {
          return fullText;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText;
}
