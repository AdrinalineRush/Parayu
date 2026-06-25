const { notarize } = require('@electron/notarize');
const path = require('path');

module.exports = async function (context) {
  const { electronPlatformName, appOutDir } = context;  
  if (electronPlatformName !== 'darwin') return;

  // Skip notarization if credentials are not provided
  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.log('Skipping macOS notarization: APPLE_ID, APPLE_ID_PASSWORD, or APPLE_TEAM_ID environment variables are not set.');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`Notarizing ${appPath} with Apple ID ${process.env.APPLE_ID}...`);

  await notarize({
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });

  console.log('Notarization complete!');
};
