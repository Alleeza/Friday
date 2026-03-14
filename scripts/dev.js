import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';

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

  return child;
}

const children = [];
let shuttingDown = false;

function stopAll() {
  children.forEach((child) => {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  });
}

children.push(startProcess('api', isWindows ? 'node server\\index.js' : 'node server/index.js'));
children.push(startProcess('vite', isWindows ? 'npm.cmd run dev:vite' : 'npm run dev:vite'));

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
