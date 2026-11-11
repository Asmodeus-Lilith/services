'use strict';

const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const serverRoot = path.join(root, 'server');
const node = process.execPath;
const children = [];

function prepareDatabase(scriptName, file) {
  console.log(`\n[dev] ${scriptName}...`);
  const result = spawnSync(node, [path.join(serverRoot, 'src', file)], {
    cwd: root,
    env: process.env,
    stdio: 'inherit'
  });

  if (result.error || result.status !== 0) {
    console.error(`\n[dev] Could not complete ${scriptName}. Make sure PostgreSQL is running and server/.env has the correct DATABASE_URL, then run npm run dev again.`);
    process.exit(result.status || 1);
  }
}

prepareDatabase('updating database schema', 'migrate.js');
prepareDatabase('preparing the local catalogue', 'seed.js');

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', (error) => {
      if (error.code === 'EADDRINUSE' && startPort < 65535) {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(error);
      }
    });
    probe.listen(startPort, '127.0.0.1', () => {
      probe.close((error) => error ? reject(error) : resolve(startPort));
    });
  });
}

let stopping = false;
function stop(signal = 'SIGTERM', exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill(signal);
  }
  const fallback = setTimeout(() => process.exit(exitCode), 4000);
  fallback.unref();
}

async function start() {
  const requestedPort = Number(process.env.FRONTEND_PORT || 3000);
  if (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65535) {
    throw new Error('FRONTEND_PORT must be an integer between 1 and 65535');
  }
  const frontendPort = await findAvailablePort(requestedPort);
  if (frontendPort !== requestedPort) {
    console.log(`[dev] Port ${requestedPort} is busy; using port ${frontendPort}.`);
  }
  const apiPort = Number(process.env.PORT || 4000);
  try {
    await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.unref();
      probe.once('error', reject);
      probe.listen(apiPort, '127.0.0.1', () => {
        probe.close((err) => (err ? reject(err) : resolve()));
      });
    });
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.warn(`\n[dev] Warning: API port ${apiPort} is already in use by another process. If you have an older ServiceHub process running, please stop it first.`);
    }
  }

  console.log(`\n[dev] Starting API and frontend. Open http://127.0.0.1:${frontendPort}`);

  const api = spawn(node, ['--watch', 'src/index.js'], {
    cwd: serverRoot,
    env: process.env,
    stdio: 'inherit'
  });
  children.push(api);

  const vite = spawn(node, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit'
  });
  children.push(vite);

  for (const child of children) {
    child.on('error', (error) => {
      console.error(`[dev] Could not start a development process: ${error.message}`);
      stop('SIGTERM', 1);
    });
    child.on('exit', (code, signal) => {
      if (!stopping) {
        console.error(`[dev] A development process stopped${signal ? ` (${signal})` : ` with code ${code}`}. Stopping the other process.`);
        stop('SIGTERM', code || 1);
      }
    });
  }
}

process.once('SIGINT', () => stop('SIGINT', 0));
process.once('SIGTERM', () => stop('SIGTERM', 0));

start().catch((error) => {
  console.error(`[dev] Could not select a frontend port: ${error.message}`);
  process.exitCode = 1;
});
