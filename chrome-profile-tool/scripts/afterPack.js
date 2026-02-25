const { execSync } = require('child_process');
const path = require('path');

exports.default = async function(context) {
  // Only sign on macOS
  if (context.electronPlatformName !== 'darwin') {
    console.log('Skipping signing for platform:', context.electronPlatformName);
    return;
  }
  
  const appPath = context.appOutDir + '/' + context.packager.appInfo.productFilename + '.app';
  
  console.log('Signing macOS app with ad-hoc identity:', appPath);
  
  try {
    // Sign with ad-hoc identity to bypass Gatekeeper
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
    console.log('App signed successfully');
    
    // Remove quarantine attribute
    execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' });
    console.log('Quarantine attribute removed');
  } catch (error) {
    console.error('Error signing app:', error);
    // Don't fail the build, just warn
  }
};
