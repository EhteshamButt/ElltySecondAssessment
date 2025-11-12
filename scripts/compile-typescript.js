// Compile TypeScript using Node.js directly to avoid binary permission issues
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Try to find TypeScript compiler
let tscPath;
try {
  tscPath = require.resolve('typescript/lib/tsc.js');
} catch (error) {
  // Fallback: try alternative path
  const altPath = path.join(__dirname, '..', 'node_modules', 'typescript', 'lib', 'tsc.js');
  if (fs.existsSync(altPath)) {
    tscPath = altPath;
  } else {
    console.error('Could not find TypeScript compiler');
    process.exit(1);
  }
}

console.log('Compiling TypeScript...');
const proc = spawn('node', [tscPath], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  shell: false,
  env: { ...process.env },
});

proc.on('error', (error) => {
  console.error('Error spawning TypeScript compiler:', error.message);
  process.exit(1);
});

proc.on('close', (code) => {
  if (code !== 0) {
    console.error(`TypeScript compilation exited with code ${code}`);
    process.exit(code);
  }
  console.log('TypeScript compiled successfully');
});

