// Traces the STATIC import graph from every Expo Router route file (which the
// router eagerly requires at launch) and reports which native packages end up
// executing during startup. Dynamic import() is deliberately not followed.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const EXTS = ['.tsx', '.ts', '.native.tsx', '.native.ts', '.android.tsx', '.android.ts', '.jsx', '.js'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', '.expo', 'supabase'].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

function resolveLocal(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null;

  // Prefer platform-specific Android resolution, mirroring Metro.
  for (const ext of ['.android.tsx', '.android.ts', '.native.tsx', '.native.ts', ...EXTS]) {
    if (fs.existsSync(base + ext)) return base + ext;
  }
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const ext of EXTS) {
      const idx = path.join(base, 'index' + ext);
      if (fs.existsSync(idx)) return idx;
    }
  }
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  return null;
}

// Static imports/re-exports only. Skips `import type`, skips dynamic import().
function staticImports(code) {
  const specs = new Set();
  const re = /(?:^|\n)\s*(?:import|export)\s+(?!type\s)(?:[\s\S]*?\sfrom\s*)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(code))) specs.add(m[1]);
  const bare = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
  while ((m = bare.exec(code))) specs.add(m[1]);
  return [...specs];
}

const nativeCache = new Map();
function isNativePackage(pkgName) {
  if (nativeCache.has(pkgName)) return nativeCache.get(pkgName);
  const dir = path.join(ROOT, 'node_modules', pkgName);
  let result = false;
  if (fs.existsSync(dir)) {
    const hasExpoModule = fs.existsSync(path.join(dir, 'expo-module.config.json'));
    const hasAndroid = fs.existsSync(path.join(dir, 'android'));
    let hasCodegen = false;
    try {
      hasCodegen = !!require(path.join(dir, 'package.json')).codegenConfig;
    } catch {}
    result = hasExpoModule || hasAndroid || hasCodegen;
  }
  nativeCache.set(pkgName, result);
  return result;
}

function pkgNameOf(spec) {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

const routeFiles = walk(path.join(ROOT, 'app'));
const visited = new Set();
const nativeHits = new Map(); // pkg -> Set of importing files

function visit(file, chain) {
  if (visited.has(file)) return;
  visited.add(file);
  let code;
  try {
    code = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const spec of staticImports(code)) {
    const local = resolveLocal(spec, file);
    if (local) {
      visit(local, [...chain, path.relative(ROOT, file)]);
      continue;
    }
    if (spec.startsWith('.') || spec.startsWith('@/')) continue;
    const pkg = pkgNameOf(spec);
    if (isNativePackage(pkg)) {
      if (!nativeHits.has(pkg)) nativeHits.set(pkg, new Set());
      nativeHits.get(pkg).add(path.relative(ROOT, file));
    }
  }
}

for (const f of routeFiles) visit(f, []);

const sorted = [...nativeHits.entries()].sort((a, b) => a[0].localeCompare(b[0]));
console.log(`Route files scanned: ${routeFiles.length}`);
console.log(`Modules reached via static imports: ${visited.size}\n`);
console.log('NATIVE PACKAGES EXECUTED AT STARTUP');
console.log('='.repeat(70));
for (const [pkg, importers] of sorted) {
  const list = [...importers].slice(0, 3);
  console.log(`\n${pkg}`);
  for (const i of list) console.log(`    <- ${i}`);
  if (importers.size > 3) console.log(`    ... +${importers.size - 3} more`);
}
