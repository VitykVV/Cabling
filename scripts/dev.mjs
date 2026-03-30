import { spawn } from 'node:child_process';

const children = [];

function run(label, command, args) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`${label} exited with code ${code}`);
      shutdown(code);
    }
  });

  children.push(child);
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('backend', 'npm', ['run', 'dev:backend']);
run('frontend', 'npm', ['run', 'dev:frontend']);
