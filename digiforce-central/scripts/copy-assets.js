// Copies EJS views and static assets into dist/ so the compiled server can
// resolve them via `path.join(__dirname, 'views' | 'public')` at runtime.
//
// Runs as part of `npm run build` (after `tsc`). Plain Node, no deps — keeps
// the build pipeline working on Render / any vanilla Node 18+ environment.

const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true });
}

const projectRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(projectRoot, 'src');
const distRoot = path.join(projectRoot, 'dist');

copyDir(path.join(srcRoot, 'views'), path.join(distRoot, 'views'));
copyDir(path.join(srcRoot, 'public'), path.join(distRoot, 'public'));

console.log('[copy-assets] copied src/views → dist/views, src/public → dist/public');
