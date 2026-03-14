import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex <= 0) return null;

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith('\'') && value.endsWith('\''))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

export function loadLocalEnv(projectRoot) {
  const envFiles = ['.env', '.env.local'];

  envFiles.forEach((fileName) => {
    const filePath = path.join(projectRoot, fileName);
    if (!existsSync(filePath)) return;

    const contents = readFileSync(filePath, 'utf8');
    contents.split(/\r?\n/).forEach((line) => {
      const entry = parseEnvLine(line);
      if (!entry || process.env[entry.key]) return;
      process.env[entry.key] = entry.value;
    });
  });
}
