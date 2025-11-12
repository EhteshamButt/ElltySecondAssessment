// Generate Prisma client using Node.js directly to avoid binary permission issues
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Try to find Prisma CLI
let prismaPath;
try {
  prismaPath = require.resolve('prisma/build/index.js');
} catch (error) {
  // Fallback: try alternative path
  const altPath = path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js');
  if (fs.existsSync(altPath)) {
    prismaPath = altPath;
  } else {
    console.error('Could not find Prisma CLI');
    process.exit(1);
  }
}

console.log('Generating Prisma Client...');
const proc = spawn('node', [prismaPath, 'generate'], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  shell: false,
  env: { ...process.env },
});

proc.on('error', (error) => {
  console.error('Error spawning Prisma generate:', error.message);
  process.exit(1);
});

proc.on('close', (code) => {
  if (code !== 0) {
    console.error(`Prisma generate exited with code ${code}`);
    process.exit(code);
  }
  console.log('Prisma Client generated successfully');
});

