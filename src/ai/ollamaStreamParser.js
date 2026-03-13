/**
 * parseOllamaStream - parses Ollama's newline-delimited JSON stream.
 *
 * Each line is a JSON object. Text arrives in `message.content` chunks until
 * a final object with `done: true` is emitted.
 *
 * @param {Response} response
 * @param {(delta: string) => void} onChunk
 * @returns {Promise<string>}
 */
export async function parseOllamaStream(response, onChunk) {
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
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let parsed;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          continue;
        }

        const chunk = parsed.message?.content ?? '';
        if (chunk) {
          fullText += chunk;
          onChunk(chunk);
        }

        if (parsed.done) {
          return fullText;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (buffer.trim()) {
    try {
      const parsed = JSON.parse(buffer.trim());
      const chunk = parsed.message?.content ?? '';
      if (chunk) {
        fullText += chunk;
        onChunk(chunk);
      }
    } catch {
      // Ignore a malformed trailing buffer.
    }
  }

  return fullText;
}
