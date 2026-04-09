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
