// Start script that changes to frontend directory before launching Next.js
const path = require('path');
const frontendDir = path.join(__dirname, 'frontend');
process.chdir(frontendDir);
process.argv = [process.argv[0], 'dev', '-p', '3000'];
require(path.join(frontendDir, 'node_modules', 'next', 'dist', 'bin', 'next'));
