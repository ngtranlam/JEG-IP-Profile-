/**
 * Ensures the sqlite3 native binary exists in node_modules before electron-builder packs.
 * 
 * Problem: If the project path contains spaces, `npm install` fails to compile sqlite3
 * via node-gyp, leaving node_modules/sqlite3/build/Release/node_sqlite3.node missing.
 * Without this file, electron-builder can't include it in the asar, and at runtime
 * the `bindings` module can't find it — even in app.asar.unpacked.
 * 
 * Solution: Copy sqlite3 to a temp dir (no spaces) and use prebuild-install to 
 * download the pre-built binary for the host architecture.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const projectRoot = __dirname.replace('/scripts', '');
const sqlite3Dir = path.join(projectRoot, 'node_modules', 'sqlite3');
const binaryDir = path.join(sqlite3Dir, 'build', 'Release');
const binaryPath = path.join(binaryDir, 'node_sqlite3.node');

function main() {
  // Check if binary already exists
  if (fs.existsSync(binaryPath)) {
    const fileInfo = execSync(`file "${binaryPath}"`, { encoding: 'utf-8' }).trim();
    console.log(`[ensureSqlite3] Binary already exists: ${fileInfo}`);
    return;
  }

  console.log('[ensureSqlite3] sqlite3 native binary not found, downloading prebuilt...');

  const hostArch = process.arch; // 'arm64' or 'x64'
  const tmpDir = path.join(os.tmpdir(), `sqlite3_ensure_${Date.now()}`);

  try {
    // Copy sqlite3 to temp dir (path without spaces)
    fs.mkdirSync(tmpDir, { recursive: true });
    execSync(`cp -R "${sqlite3Dir}" "${tmpDir}/sqlite3"`, { stdio: 'inherit' });

    const tmpSqlite3 = path.join(tmpDir, 'sqlite3');

    // Download prebuilt binary for host architecture
    console.log(`[ensureSqlite3] Running prebuild-install for darwin/${hostArch}...`);
    execSync(
      `npx prebuild-install -r napi --platform darwin --arch ${hostArch}`,
      { cwd: tmpSqlite3, stdio: 'inherit' }
    );

    // Copy binary back to node_modules
    const downloadedBinary = path.join(tmpSqlite3, 'build', 'Release', 'node_sqlite3.node');
    if (fs.existsSync(downloadedBinary)) {
      fs.mkdirSync(binaryDir, { recursive: true });
      fs.copyFileSync(downloadedBinary, binaryPath);

      const fileInfo = execSync(`file "${binaryPath}"`, { encoding: 'utf-8' }).trim();
      console.log(`[ensureSqlite3] Binary installed: ${fileInfo}`);
    } else {
      console.error('[ensureSqlite3] prebuild-install did not produce a binary');
      process.exit(1);
    }
  } catch (error) {
    console.error('[ensureSqlite3] Failed:', error.message);
    process.exit(1);
  } finally {
    try {
      execSync(`rm -rf "${tmpDir}"`, { stdio: 'ignore' });
    } catch (e) { /* ignore */ }
  }
}

main();
