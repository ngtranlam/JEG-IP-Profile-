/**
 * Ensures sharp's platform-specific @img packages for BOTH macOS architectures
 * exist in node_modules before electron-builder packs.
 *
 * Problem: sharp ships its native binary in optional deps that npm installs only
 * for the host platform/arch. On an arm64 CI runner, `npm ci` installs
 * @img/sharp-darwin-arm64 only, so the x64 build has nothing to load and fails
 * at startup with `Could not load the "sharp" module using the darwin-x64 runtime`.
 *
 * Why this must happen BEFORE packing (and cannot be fixed in afterPack):
 * Electron resolves requires inside app.asar through the archive header. A file
 * that has no header entry yields MODULE_NOT_FOUND — Electron never falls back
 * to scanning app.asar.unpacked. So copying a package into app.asar.unpacked
 * after packing makes it present on disk yet still unresolvable. The package has
 * to be in node_modules while electron-builder builds the asar index.
 *
 * Solution: install the missing packages into a temp prefix (npm refuses
 * cpu/os-mismatched packages without --force) and copy them into node_modules.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ARCHES = ['x64', 'arm64'];

const projectRoot = path.dirname(__dirname);
const nodeModules = path.join(projectRoot, 'node_modules');
const imgDir = path.join(nodeModules, '@img');

function main() {
  const sharpPkgPath = path.join(nodeModules, 'sharp', 'package.json');
  if (!fs.existsSync(sharpPkgPath)) {
    console.log('[ensureSharp] sharp is not installed, nothing to do');
    return;
  }

  // Pin to the exact versions sharp itself declares, so the binary always
  // matches the JS wrapper that loads it.
  const { optionalDependencies = {} } = JSON.parse(fs.readFileSync(sharpPkgPath, 'utf-8'));

  const missing = [];
  for (const arch of ARCHES) {
    for (const name of [`@img/sharp-darwin-${arch}`, `@img/sharp-libvips-darwin-${arch}`]) {
      if (fs.existsSync(path.join(nodeModules, name))) continue;

      const version = optionalDependencies[name];
      if (!version) {
        throw new Error(`[ensureSharp] sharp ${sharpVersion()} does not declare ${name}`);
      }
      missing.push({ name, spec: `${name}@${version}` });
    }
  }

  if (missing.length === 0) {
    console.log(`[ensureSharp] darwin packages present for: ${ARCHES.join(', ')}`);
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sharp-darwin-'));
  try {
    console.log(`[ensureSharp] Installing ${missing.map((m) => m.spec).join(', ')}`);
    // --force: npm skips optional deps whose cpu/os do not match the host
    execSync(
      `npm install --no-save --force --prefix "${tmpDir}" ${missing.map((m) => m.spec).join(' ')}`,
      { stdio: 'inherit' }
    );

    fs.mkdirSync(imgDir, { recursive: true });
    for (const { name } of missing) {
      const src = path.join(tmpDir, 'node_modules', name);
      if (!fs.existsSync(src)) {
        throw new Error(`[ensureSharp] npm did not install ${name}`);
      }
      copyDir(src, path.join(nodeModules, name));
      console.log(`[ensureSharp] Installed ${name}`);
    }
  } finally {
    rmrf(tmpDir);
  }
}

function sharpVersion() {
  return JSON.parse(fs.readFileSync(path.join(nodeModules, 'sharp', 'package.json'), 'utf-8')).version;
}

function copyDir(src, dest) {
  rmrf(dest);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, dereference: true });
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
