#!/usr/bin/env node
/**
 * Regenerate PNG brand assets from assets/images/logo.svg
 * Usage: node scripts/generate-brand-assets.mjs
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = path.join(root, 'assets/images/logo.svg');
const cli = path.join(root, 'node_modules', '.bin', 'resvg-js');

const outputs = [
  ['--fit-width', '1024', svg, path.join(root, 'assets/images/icon.png')],
  ['--fit-width', '1024', svg, path.join(root, 'assets/images/logo.png')],
  ['--fit-width', '1024', svg, path.join(root, 'assets/images/splash-icon.png')],
  ['--fit-width', '1024', svg, path.join(root, 'assets/images/android-icon-foreground.png')],
  ['--fit-width', '192', svg, path.join(root, 'assets/images/favicon.png')],
];

for (const args of outputs) {
  execFileSync('npx', ['-y', '@resvg/resvg-js-cli', ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
}

console.log('Brand PNG assets updated from logo.svg');
