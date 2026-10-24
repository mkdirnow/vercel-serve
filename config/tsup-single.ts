import { chmodSync } from 'node:fs';
import { defineConfig } from 'tsup';

// Bundles serve and every runtime dependency into one standalone file
// (dist/serve.mjs) for direct distribution outside the npm package,
// which keeps declaring its dependencies normally.
export default defineConfig({
  entry: { serve: './source/main.ts' },
  target: 'esnext',
  format: ['esm'],
  outDir: './dist/',
  noExternal: [/.*/],
  // The source uses top-level await, so the bundle must stay ESM;
  // the .mjs extension makes Node parse it as ESM without a package.json.
  outExtension: () => ({ js: '.mjs' }),
  // CommonJS dependencies (serve-handler) call require() at runtime,
  // which does not exist in an ES module.
  banner: {
    js: 'import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);',
  },
  onSuccess: async () => {
    chmodSync('./dist/serve.mjs', 0o755);
  },
});
