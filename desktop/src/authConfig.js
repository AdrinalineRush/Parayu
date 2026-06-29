// Google OAuth client ID for the desktop sign-in flow. This is a *public*
// OAuth client identifier (safe to ship). There is intentionally NO client
// secret — the desktop loopback flow authenticates with PKCE instead.
//
// Fill this with the real client ID from Google Cloud Console:
//   APIs & Services → Credentials → OAuth client ID → application type
//   "Desktop app". Copy the ".apps.googleusercontent.com" value here.
//
// Until it is set, Google sign-in stays disabled and surfaces a clear error
// instead of silently failing against a broken placeholder.
module.exports = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || ''
};
