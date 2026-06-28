// Deletes ELECTRON_RUN_AS_NODE before spawning Electron so it always launches as a GUI app.
delete process.env.ELECTRON_RUN_AS_NODE;

const { spawn } = require('child_process');
const electron  = require('electron');

const child = spawn(String(electron), ['.'], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
