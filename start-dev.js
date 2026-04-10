// Start script that changes to frontend directory before launching Next.js
const path = require('path');
const frontendDir = path.join(__dirname, 'frontend');
process.chdir(frontendDir);
const port = process.env.PORT || '3000';
process.argv = [process.argv[0], 'dev', '-p', port];
// Fall back to main repo node_modules if worktree doesn't have its own
const nextBin = path.join(frontendDir, 'node_modules', 'next', 'dist', 'bin', 'next');
const mainNextBin = path.join('C:\\Users\\afksm\\finma\\frontend', 'node_modules', 'next', 'dist', 'bin', 'next');
const fs = require('fs');
require(fs.existsSync(nextBin) ? nextBin : mainNextBin);
