// Start script that changes to frontend directory before launching Next.js
const path = require('path');
const fs   = require('fs');

const frontendDir     = path.join(__dirname, 'frontend');
const mainFrontendDir = 'C:\\Users\\afksm\\finma\\frontend';

// Symlink node_modules from main repo into worktree so Turbopack can find them
const worktreeModules = path.join(frontendDir, 'node_modules');
const mainModules     = path.join(mainFrontendDir, 'node_modules');

if (!fs.existsSync(worktreeModules) && fs.existsSync(mainModules)) {
  try {
    fs.symlinkSync(mainModules, worktreeModules, 'junction');
    console.log('[start-dev] Symlinked node_modules from main repo.');
  } catch (e) {
    console.warn('[start-dev] Could not symlink node_modules:', e.message);
  }
}

process.chdir(frontendDir);

const port = process.env.PORT || '3000';
process.argv = [process.argv[0], 'dev', '-p', port];

const nextBin = path.join(frontendDir, 'node_modules', 'next', 'dist', 'bin', 'next');
const mainNextBin = path.join(mainFrontendDir, 'node_modules', 'next', 'dist', 'bin', 'next');
require(fs.existsSync(nextBin) ? nextBin : mainNextBin);
