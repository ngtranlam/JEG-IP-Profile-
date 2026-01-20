const { spawn } = require('child_process');
const path = require('path');

// Start the application
const electronPath = path.join(__dirname, 'node_modules', '.bin', 'electron');
const mainPath = path.join(__dirname, 'dist', 'main', 'main.js');

console.log('Starting Chrome Profile Tool...');
console.log('Electron path:', electronPath);
console.log('Main path:', mainPath);

const app = spawn(electronPath, [mainPath], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

app.on('close', (code) => {
  console.log(`Application exited with code ${code}`);
});

app.on('error', (err) => {
  console.error('Failed to start application:', err);
});
