import net from 'node:net';
import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const apiPort = Number(process.env.PORT || 3001);
const children = [];
let shuttingDown = false;

function assertSupportedNodeVersion() {
  const [majorRaw] = String(process.versions.node || '').split('.');
  const major = Number.parseInt(majorRaw, 10);
  if (Number.isNaN(major) || major >= 20) return;

  process.stderr.write(
    `[dev] Node ${process.versions.node} detected. This project requires Node 20+.\n`,
  );
  process.stderr.write('[dev] Run: nvm install 20 && nvm use 20\n');
  process.exit(1);
}

function isPortInUse(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });

    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });

    socket.once('error', (error) => {
      if (error.code === 'ECONNREFUSED') {
        resolve(false);
        return;
      }
      reject(error);
    });
  });
}

function startProcess(name, command) {
  const child = spawn(command, {
    cwd: process.cwd(),
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on('exit', (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    stopAll();
    process.exit(code ?? 0);
  });

  children.push(child);
  return child;
}

function stopAll() {
  children.forEach((child) => {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  });
}

async function main() {
  assertSupportedNodeVersion();

  const portInUse = await isPortInUse(apiPort);

  if (portInUse) {
    process.stdout.write(`[api] Reusing existing backend on http://localhost:${apiPort}\n`);
  } else {
    startProcess('api', isWindows ? 'node server\\index.js' : 'node server/index.js');
  }

  startProcess('vite', isWindows ? 'npm.cmd run dev:vite' : 'npm run dev:vite');
}

process.on('SIGINT', () => {
  if (shuttingDown) return;
  shuttingDown = true;
  stopAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (shuttingDown) return;
  shuttingDown = true;
  stopAll();
  process.exit(0);
});

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
