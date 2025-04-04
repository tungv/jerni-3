#!/usr/bin/env bun

import { execSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Clean dist directory
console.log('Cleaning dist directory...');
try {
  rmSync(join(ROOT, 'dist'), { recursive: true, force: true });
} catch (err) {
  // ignore
}

// Create dist directory
mkdirSync(join(ROOT, 'dist'), { recursive: true });

// Compile TypeScript library files
console.log('Compiling TypeScript library files...');
execSync('bunx tsc --project tsconfig.build.json', { stdio: 'inherit', cwd: ROOT });

// Build CLI with bun
console.log('Building CLI with bun...');
execSync(
  'bun build ./src/cli.ts --outfile ./dist/cli.js --target node --format esm',
  { stdio: 'inherit', cwd: ROOT }
);

// Copy package.json and update it
console.log('Preparing package.json...');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

// The package.json in the published package should point to compiled files
pkg.main = './createJourney.js';
pkg.types = './createJourney.d.ts';
pkg.bin = {
  jerni: './cli.js'
};
pkg.engines = {
  bun: "1.2.8"
};

// Update exports to point to compiled files
const newExports = {};
for (const [key, value] of Object.entries(pkg.exports)) {
  const defaultPath = value.default.replace('./dist/', './');
  const typesPath = value.types.replace('./dist/', './');

  newExports[key] = {
    types: typesPath,
    default: defaultPath
  };
}
pkg.exports = newExports;

// Write the updated package.json
writeFileSync(join(ROOT, 'dist/package.json'), JSON.stringify(pkg, null, 2));

// Make CLI file executable
console.log('Making CLI file executable...');
chmodSync(join(ROOT, 'dist/cli.js'), '755');

// Copy README and license if they exist
try {
  copyFileSync(join(ROOT, 'README.md'), join(ROOT, 'dist/README.md'));
} catch (err) {
  console.warn('No README.md found');
}

try {
  copyFileSync(join(ROOT, 'LICENSE'), join(ROOT, 'dist/LICENSE'));
} catch (err) {
  console.warn('No LICENSE found');
}

console.log('Build completed successfully!')