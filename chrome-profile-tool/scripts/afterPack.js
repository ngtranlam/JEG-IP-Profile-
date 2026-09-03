const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// electron-builder Arch enum -> string
const ARCH_MAP = { 0: 'ia32', 1: 'x64', 2: 'armv7l', 3: 'arm64', 4: 'universal' };
// Node arch -> Mach-O arch name reported by lipo/file
const MACHO_ARCH = { x64: 'x86_64', arm64: 'arm64' };

// Paths that hold binaries for other platforms — never verified against the mac target arch
const FOREIGN_PLATFORM = /(linuxmusl|linux|win32|windows|android|wasm)/i;

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') {
    console.log('[afterPack] Skipping for platform:', context.electronPlatformName);
    return;
  }

  const targetArch = ARCH_MAP[context.arch];
  if (!targetArch) {
    throw new Error(`[afterPack] Unrecognized electron-builder arch: ${context.arch}`);
  }
  if (targetArch === 'universal') {
    // The universal target is assembled from the already-processed x64 + arm64 apps
    console.log('[afterPack] Universal target: per-arch apps already processed, skipping');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  const unpackedModules = path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked', 'node_modules');

  // Host arch matters: whatever `npm ci` compiled lands in node_modules, so a host
  // that differs from the target is exactly the case that must be cross-installed.
  console.log(`[afterPack] Host arch: ${process.arch} | Target arch: ${targetArch} (${MACHO_ARCH[targetArch]})`);
  console.log(`[afterPack] App: ${appPath}`);

  ensureSqlite3(targetArch, unpackedModules);
  ensureSharp(targetArch, unpackedModules);
  verifyNativeBinaries(targetArch, unpackedModules);

  // Sign last so every binary swapped in above is covered
  signApp(appPath);
};

/**
 * Architectures contained in a Mach-O file, e.g. ['x86_64'] or ['x86_64', 'arm64'].
 * Returns [] when the file is not Mach-O.
 *
 * NOTE: never use plain `file <path>` here — its output embeds the path, and paths
 * such as `release/mac-arm64/...` then match the arch we are looking for, which
 * silently hides architecture mismatches. `lipo -archs` prints only the arch list,
 * and `file -b` (brief) omits the filename.
 */
function archsOf(binaryPath) {
  try {
    const out = execSync(`lipo -archs "${binaryPath}"`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim().split(/\s+/).filter(Boolean);
  } catch (e) {
    // lipo missing, or not a Mach-O file
  }

  try {
    const out = execSync(`file -b "${binaryPath}"`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (!/Mach-O/.test(out)) return [];
    const archs = [];
    if (/x86_64/.test(out)) archs.push('x86_64');
    if (/\barm64\b/.test(out)) archs.push('arm64');
    return archs;
  } catch (e) {
    return [];
  }
}

function hasArch(binaryPath, targetArch) {
  return archsOf(binaryPath).includes(MACHO_ARCH[targetArch]);
}

// --- sqlite3 -----------------------------------------------------------------

function ensureSqlite3(targetArch, unpackedModules) {
  const sqlite3Dir = path.join(unpackedModules, 'sqlite3');
  if (!fs.existsSync(sqlite3Dir)) {
    console.log('[afterPack] sqlite3 not present in app.asar.unpacked, skipping');
    return;
  }

  const binaryDir = path.join(sqlite3Dir, 'build', 'Release');
  const binaryPath = path.join(binaryDir, 'node_sqlite3.node');

  if (fs.existsSync(binaryPath) && hasArch(binaryPath, targetArch)) {
    console.log(`[afterPack] sqlite3 binary already ${targetArch} (${archsOf(binaryPath).join(', ')})`);
  } else {
    const found = fs.existsSync(binaryPath) ? archsOf(binaryPath).join(', ') || 'unknown' : 'missing';
    console.log(`[afterPack] sqlite3 binary needs replacing (found: ${found}, need: ${targetArch})`);
    installSqlite3Prebuilt(targetArch, binaryDir, binaryPath);
  }

  // `bindings` probes several locations; drop wrong-arch prebuilt copies so it
  // can never resolve one of them ahead of build/Release.
  pruneWrongArchBindings(sqlite3Dir, targetArch);
}

function installSqlite3Prebuilt(targetArch, destDir, destBinaryPath) {
  const source = path.join(process.cwd(), 'node_modules', 'sqlite3');
  if (!fs.existsSync(source)) {
    throw new Error(`[afterPack] Cannot find sqlite3 in node_modules at ${source}`);
  }

  // node-gyp/prebuild-install choke on paths containing spaces, so work in a temp dir
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `sqlite3-${targetArch}-`));
  const workDir = path.join(tmpDir, 'sqlite3');

  try {
    execSync(`cp -R "${source}" "${workDir}"`, { stdio: 'inherit' });
    // Remove any host-arch build so the downloaded binary is the only candidate
    execSync(`rm -rf "${path.join(workDir, 'build')}"`, { stdio: 'ignore' });

    const localBin = path.join(process.cwd(), 'node_modules', '.bin', 'prebuild-install');
    const runner = fs.existsSync(localBin) ? `"${localBin}"` : 'npx --yes prebuild-install';

    console.log(`[afterPack] Downloading sqlite3 prebuild for darwin/${targetArch}...`);
    execSync(`${runner} -r napi --platform darwin --arch ${targetArch}`, {
      cwd: workDir,
      stdio: 'inherit',
    });

    const expected = path.join(workDir, 'build', 'Release', 'node_sqlite3.node');
    const downloaded = fs.existsSync(expected) ? expected : findFile(workDir, 'node_sqlite3.node');
    if (!downloaded) {
      throw new Error(`[afterPack] prebuild-install produced no node_sqlite3.node for ${targetArch}`);
    }
    if (!hasArch(downloaded, targetArch)) {
      throw new Error(
        `[afterPack] Downloaded sqlite3 binary is ${archsOf(downloaded).join(', ') || 'unknown'}, expected ${targetArch}`
      );
    }

    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(downloaded, destBinaryPath);
    console.log(`[afterPack] sqlite3 binary installed: ${archsOf(destBinaryPath).join(', ')}`);
  } finally {
    try {
      execSync(`rm -rf "${tmpDir}"`, { stdio: 'ignore' });
    } catch (e) { /* ignore cleanup errors */ }
  }
}

function pruneWrongArchBindings(sqlite3Dir, targetArch) {
  const bindingRoot = path.join(sqlite3Dir, 'lib', 'binding');
  if (!fs.existsSync(bindingRoot)) return;

  for (const entry of fs.readdirSync(bindingRoot)) {
    const binary = path.join(bindingRoot, entry, 'node_sqlite3.node');
    if (!fs.existsSync(binary)) continue;
    if (hasArch(binary, targetArch)) continue;

    execSync(`rm -rf "${path.join(bindingRoot, entry)}"`, { stdio: 'ignore' });
    console.log(`[afterPack] Removed wrong-arch sqlite3 binding: ${entry}`);
  }
}

// --- sharp -------------------------------------------------------------------

function ensureSharp(targetArch, unpackedModules) {
  if (!fs.existsSync(path.join(unpackedModules, 'sharp'))) {
    console.log('[afterPack] sharp not present in app.asar.unpacked, skipping');
    return;
  }

  const imgDir = path.join(unpackedModules, '@img');
  const required = [`sharp-darwin-${targetArch}`, `sharp-libvips-darwin-${targetArch}`];
  const missing = required.filter((pkg) => !fs.existsSync(path.join(imgDir, pkg)));

  if (missing.length === 0) {
    console.log(`[afterPack] sharp packages for darwin-${targetArch} already present`);
  } else {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `sharp-${targetArch}-`));
    try {
      const specs = missing.map((pkg) => `@img/${pkg}`);
      console.log(`[afterPack] Installing sharp packages: ${specs.join(', ')}`);
      // --force is required: npm refuses cpu/os-mismatched optional packages
      execSync(`npm install --no-save --force --prefix "${tmpDir}" ${specs.join(' ')}`, {
        stdio: 'inherit',
      });

      fs.mkdirSync(imgDir, { recursive: true });
      for (const pkg of missing) {
        const src = path.join(tmpDir, 'node_modules', '@img', pkg);
        if (!fs.existsSync(src)) {
          throw new Error(`[afterPack] npm did not install @img/${pkg}`);
        }
        execSync(`cp -R "${src}" "${path.join(imgDir, pkg)}"`, { stdio: 'inherit' });
        console.log(`[afterPack] Installed @img/${pkg}`);
      }
    } finally {
      try {
        execSync(`rm -rf "${tmpDir}"`, { stdio: 'ignore' });
      } catch (e) { /* ignore cleanup errors */ }
    }
  }

  // Drop the other macOS arch to keep the bundle lean and unambiguous
  const otherArch = targetArch === 'arm64' ? 'x64' : 'arm64';
  for (const pkg of [`sharp-darwin-${otherArch}`, `sharp-libvips-darwin-${otherArch}`]) {
    const dir = path.join(imgDir, pkg);
    if (!fs.existsSync(dir)) continue;
    execSync(`rm -rf "${dir}"`, { stdio: 'ignore' });
    console.log(`[afterPack] Removed wrong-arch sharp package: @img/${pkg}`);
  }
}

// --- verification ------------------------------------------------------------

/**
 * Safety net: walk every native binary that ships in the app and assert it can
 * run on the target architecture. Without this an arch mismatch only surfaces
 * as a runtime dlopen() crash on the user's machine.
 */
function verifyNativeBinaries(targetArch, unpackedModules) {
  if (!fs.existsSync(unpackedModules)) return;

  const wanted = MACHO_ARCH[targetArch];
  const mismatched = [];

  for (const file of walk(unpackedModules)) {
    if (!/\.(node|dylib|so)$/.test(file)) continue;
    if (FOREIGN_PLATFORM.test(path.relative(unpackedModules, file))) continue;

    const archs = archsOf(file);
    if (archs.length === 0) continue; // not Mach-O
    if (archs.includes(wanted)) continue;

    mismatched.push(`${path.relative(unpackedModules, file)} (${archs.join(', ')})`);
  }

  if (mismatched.length === 0) {
    console.log(`[afterPack] All native binaries verified for ${targetArch}`);
    return;
  }

  throw new Error(
    `[afterPack] ${mismatched.length} native binary/binaries do not support ${targetArch} (${wanted}):\n` +
      mismatched.map((m) => `  - ${m}`).join('\n')
  );
}

// --- helpers -----------------------------------------------------------------

function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

function findFile(dir, name) {
  for (const file of walk(dir)) {
    if (path.basename(file) === name) return file;
  }
  return null;
}

function signApp(appPath) {
  console.log('[afterPack] Signing app with ad-hoc identity:', appPath);
  try {
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
    execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' });
    console.log('[afterPack] App signed and quarantine attribute cleared');
  } catch (error) {
    // Ad-hoc signing is mandatory on Apple Silicon — an unsigned binary cannot be loaded
    throw new Error(`[afterPack] Failed to sign app: ${error.message}`);
  }
}
