const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

exports.default = async function(context) {
  // Only process macOS builds
  if (context.electronPlatformName !== 'darwin') {
    console.log('Skipping for platform:', context.electronPlatformName);
    return;
  }

  // Map electron-builder arch enum to string
  const archMap = { 0: 'ia32', 1: 'x64', 2: 'armv7l', 3: 'arm64' };
  const targetArch = archMap[context.arch] || 'x64';

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  const unpackedDir = path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked');
  const sqlite3UnpackedDir = path.join(unpackedDir, 'node_modules', 'sqlite3');
  const sqlite3BinaryDir = path.join(sqlite3UnpackedDir, 'build', 'Release');
  const sqlite3BinaryPath = path.join(sqlite3BinaryDir, 'node_sqlite3.node');

  // --- Ensure sqlite3 native binary exists and matches target arch ---
  let needsInstall = false;

  if (fs.existsSync(sqlite3BinaryPath)) {
    const fileInfo = execSync(`file "${sqlite3BinaryPath}"`, { encoding: 'utf-8' });
    const isCorrectArch =
      (targetArch === 'x64' && fileInfo.includes('x86_64')) ||
      (targetArch === 'arm64' && fileInfo.includes('arm64'));

    if (!isCorrectArch) {
      console.log(`[afterPack] sqlite3 binary arch mismatch for ${targetArch}: ${fileInfo.trim()}`);
      needsInstall = true;
    } else {
      console.log(`[afterPack] sqlite3 binary matches ${targetArch}, no rebuild needed`);
    }
  } else {
    console.log(`[afterPack] sqlite3 binary not found at ${sqlite3BinaryPath}`);
    needsInstall = true;
  }

  if (needsInstall) {
    console.log(`[afterPack] Installing sqlite3 prebuilt binary for ${targetArch}...`);
    await installSqlite3Prebuilt(targetArch, sqlite3UnpackedDir, sqlite3BinaryDir, sqlite3BinaryPath);
  }

  // --- Rebuild sharp for target architecture ---
  const sharpUnpackedDir = path.join(unpackedDir, 'node_modules', 'sharp');
  if (fs.existsSync(sharpUnpackedDir)) {
    console.log(`[afterPack] Rebuilding sharp for ${targetArch}...`);
    await rebuildSharp(targetArch, sharpUnpackedDir);
  }

  // --- Sign the app ---
  console.log('Signing macOS app with ad-hoc identity:', appPath);
  try {
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
    console.log('App signed successfully');
    execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' });
    console.log('Quarantine attribute removed');
  } catch (error) {
    console.error('Error signing app:', error);
    // Don't fail the build, just warn
  }
};

async function installSqlite3Prebuilt(targetArch, sqlite3UnpackedDir, sqlite3BinaryDir, destBinaryPath) {
  const projectRoot = process.cwd();
  const sqlite3Src = path.join(projectRoot, 'node_modules', 'sqlite3');
  const tmpDir = path.join(os.tmpdir(), `sqlite3_prebuild_${targetArch}_${Date.now()}`);

  try {
    // Copy sqlite3 package to a temp directory (no spaces in path — avoids node-gyp/make bug)
    fs.mkdirSync(tmpDir, { recursive: true });
    execSync(`cp -R "${sqlite3Src}" "${tmpDir}/sqlite3"`, { stdio: 'inherit' });

    const tmpSqlite3 = path.join(tmpDir, 'sqlite3');

    // Use prebuild-install to download the correct pre-built binary
    console.log(`[afterPack] Running prebuild-install for darwin/${targetArch}...`);
    execSync(
      `npx prebuild-install -r napi --platform darwin --arch ${targetArch}`,
      { cwd: tmpSqlite3, stdio: 'inherit' }
    );

    // Find the downloaded binary
    const rebuiltBinary = path.join(tmpSqlite3, 'build', 'Release', 'node_sqlite3.node');
    if (fs.existsSync(rebuiltBinary)) {
      // Ensure destination directory exists
      fs.mkdirSync(sqlite3BinaryDir, { recursive: true });
      fs.copyFileSync(rebuiltBinary, destBinaryPath);

      const verifyInfo = execSync(`file "${destBinaryPath}"`, { encoding: 'utf-8' });
      console.log(`[afterPack] sqlite3 prebuilt installed: ${verifyInfo.trim()}`);
    } else {
      console.error('[afterPack] prebuild-install did not produce node_sqlite3.node');
    }
  } catch (error) {
    console.error(`[afterPack] Failed to install sqlite3 prebuilt for ${targetArch}:`, error.message);
  } finally {
    // Clean up temp directory
    try {
      execSync(`rm -rf "${tmpDir}"`, { stdio: 'ignore' });
    } catch (e) { /* ignore cleanup errors */ }
  }
}

async function rebuildSharp(targetArch, sharpUnpackedDir) {
  const unpackedNodeModules = path.dirname(sharpUnpackedDir);
  const imgDir = path.join(unpackedNodeModules, '@img');
  const bindingPkg = `sharp-darwin-${targetArch}`;
  const libvipsPkg = `sharp-libvips-darwin-${targetArch}`;

  try {
    // Check if platform-specific binding exists
    const bindingDir = path.join(imgDir, bindingPkg);
    const libvipsDir = path.join(imgDir, libvipsPkg);

    const needsBinding = !fs.existsSync(bindingDir);
    const needsLibvips = !fs.existsSync(libvipsDir);

    if (!needsBinding && !needsLibvips) {
      console.log(`[afterPack] sharp packages for darwin-${targetArch} already present`);
      return;
    }

    // Install missing platform-specific packages into unpacked node_modules
    const tmpDir = path.join(os.tmpdir(), `sharp_install_${targetArch}_${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const packagesToInstall = [];
    if (needsBinding) packagesToInstall.push(`@img/${bindingPkg}`);
    if (needsLibvips) packagesToInstall.push(`@img/${libvipsPkg}`);

    console.log(`[afterPack] Installing sharp platform packages for ${targetArch}: ${packagesToInstall.join(', ')}`);
    execSync(`npm install --no-save --force --prefix "${tmpDir}" ${packagesToInstall.join(' ')}`, {
      stdio: 'inherit',
    });

    // Copy installed packages to unpacked node_modules/@img/
    fs.mkdirSync(imgDir, { recursive: true });

    for (const pkg of packagesToInstall) {
      const pkgName = pkg.replace('@img/', '');
      const srcDir = path.join(tmpDir, 'node_modules', '@img', pkgName);
      const destDir = path.join(imgDir, pkgName);
      if (fs.existsSync(srcDir)) {
        execSync(`cp -R "${srcDir}" "${destDir}"`, { stdio: 'inherit' });
        console.log(`[afterPack] Installed ${pkg} -> ${destDir}`);
      }
    }

    // Clean up
    try { execSync(`rm -rf "${tmpDir}"`, { stdio: 'ignore' }); } catch (e) { /* ignore */ }

    console.log(`[afterPack] sharp platform packages installed for ${targetArch}`);
  } catch (error) {
    console.error(`[afterPack] Failed to install sharp packages for ${targetArch}:`, error.message);
  }
}
