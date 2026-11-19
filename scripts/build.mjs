// Bundles each entry point into dist/ and copies static files.
// Content scripts can't be ES modules, so everything is built as IIFE.
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const watch = process.argv.includes('--watch');

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('static', 'dist', { recursive: true });

// Reader fonts (OFL-1.1), served to pages as web-accessible resources.
const FONTS = {
  'atkinson-hyperlegible': ['latin-400-normal', 'latin-700-normal', 'latin-400-italic'],
  opendyslexic: ['latin-400-normal', 'latin-700-normal', 'latin-400-italic'],
};
mkdirSync('dist/fonts', { recursive: true });
for (const [pkg, variants] of Object.entries(FONTS)) {
  for (const v of variants) {
    const file = `${pkg}-${v}.woff2`;
    cpSync(`node_modules/@fontsource/${pkg}/files/${file}`, `dist/fonts/${file}`);
  }
}

const options = {
  entryPoints: {
    background: 'src/background/index.ts',
    content: 'src/content/entry.ts',
    auto: 'src/content/auto.ts',
    popup: 'src/popup/index.ts',
    options: 'src/options/index.ts',
  },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'chrome114',
  sourcemap: 'linked',
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('Watching for changes. Reload the extension in chrome://extensions after each rebuild.');
} else {
  await esbuild.build(options);
}
