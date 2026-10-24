// scripts/prepare.mjs
// Runs when the package is installed from git or packed: installs git hooks
// and compiles for contributors, but never breaks installs on machines
// without the dev toolchain (those use the committed `build/` output).

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const bin = (name) => `node_modules/.bin/${name}`;

const run = (command) => spawnSync(command, { stdio: 'inherit', shell: true });

// Install git hooks for contributors (husky needs the git directory).
if (existsSync('.git') && existsSync(bin('husky'))) {
  const hooks = run(`${bin('husky')} install config/husky`);
  if (hooks.status !== 0) process.exit(hooks.status ?? 1);
}

// Compile when the toolchain is available. Consumers installing from git
// don't have it, so they rely on the committed build output instead.
if (existsSync(bin('tsup'))) {
  const compile = run(`${bin('tsup')} ./source/main.ts`);
  if (compile.status !== 0) process.exit(compile.status ?? 1);
} else if (!existsSync('build/main.js')) {
  console.error(
    'The build toolchain is not installed and build/main.js is missing.',
  );
  process.exit(1);
}
