# Parayu (Voice-to-Text Dictation App)

Parayu is a fast, offline, and private voice dictation application built for macOS and Windows. Speak, and Parayu automatically transcribes your speech using `whisper.cpp` locally on your device and pastes the text directly into whatever application you are using.

---

## Developer Guide

### Prerequisites
* Node.js (v20 or newer recommended)
* npm (v10 or newer)
* Platform-specific C++ build tools (required for compiling native bindings like `smart-whisper` and `uiohook-napi`):
  * **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  * **Windows**: Visual Studio Build Tools with C++ Desktop Development workload

### Installation
Clone the repository and install the dependencies:
```bash
npm install
```

### Running in Development Mode
To launch the application:
```bash
npm start
```
*Note: On macOS, running with physical hotkeys and pasting requires Accessibility permissions. If it fails, run with isolated user data:*
```bash
npm start -- --user-data-dir=/tmp/parayu-dev-userdata
```

---

## Build & Packaging Guide

We use `electron-builder` to package optimized, production-ready builds.

### 1. Build macOS DMG Installer (Local)
To package the app into a styled drag-to-Applications installer `.dmg` on macOS:
```bash
npm run dist && ./seal-dmg-background.sh
```
The packaged app (`Parayu.app`) and styled installer (`Parayu-0.1.0-arm64.dmg`) will be created in the `dist/` directory.

### 2. Build Windows EXE Installer (CI/CD or Windows Machine)
Due to native compiled modules (`smart-whisper` and `uiohook-napi`), the Windows installer `.exe` cannot be built directly on macOS. It must be packaged on a Windows machine or via the GitHub Actions runner.
To package it on a Windows machine:
```cmd
npm run dist
```
This produces a professional-grade NSIS installer `.exe` in the `dist/` directory.

---

## Code Signing & Notarization

Unsigned installers will trigger operating system warnings (macOS Gatekeeper blockages or Windows SmartScreen alerts). Follow these steps to sign and notarize the installers:

### macOS Signing & Notarization
To sign and notarize the macOS `.dmg`, you need an active Apple Developer Program account.

1. **Obtain Certificates**:
   * Generate a **Developer ID Application** certificate from the Apple Developer portal.
   * Export the certificate as a password-protected `.p12` file.
2. **Environment Variables**:
   Set the following environment variables on your local machine or in your CI secrets before running `npm run dist`:
   ```bash
   # Code Signing
   export CSC_LINK="path/to/developer_id_application.p12" # or base64-encoded file string
   export CSC_KEY_PASSWORD="your-certificate-password"

   # Notarization (via notarytool)
   export APPLE_ID="your-developer-apple-id@email.com"
   export APPLE_ID_PASSWORD="app-specific-password-generated-at-appleid.apple.com"
   export APPLE_TEAM_ID="your-10-character-team-id"
   ```
   *Note: Our custom `build/afterSign.js` script will automatically submit the app for notarization once the package build finishes if these variables are set.*

### Windows Authenticode Code Signing
To sign the Windows `.exe` installer:

1. **Obtain Certificate**:
   * Obtain a code-signing certificate (typically a `.pfx` file) from a trusted Certificate Authority (CA) like Sectigo or DigiCert.
2. **Environment Variables**:
   Set the following environment variables in your environment before building:
   ```cmd
   set CSC_LINK=path/to/certificate.pfx
   set CSC_KEY_PASSWORD=your-certificate-password
   ```

---

## CI/CD Pipeline (GitHub Actions)

We have configured an automated build workflow in `.github/workflows/build.yml`. On every push to the `main` branch, it builds installers for both macOS and Windows.

To enable automated code signing in the pipeline:
1. Go to your GitHub Repository Settings → **Secrets and variables** → **Actions**.
2. Add the following secrets matching the environment variables:
   * `MAC_CSC_LINK` (Base64-encoded content of your macOS `.p12` certificate)
   * `MAC_CSC_KEY_PASSWORD`
   * `APPLE_ID`
   * `APPLE_ID_PASSWORD`
   * `APPLE_TEAM_ID`
   * *(Optional)* `WIN_CSC_LINK` (Base64-encoded content of your Windows `.pfx` certificate)
   * *(Optional)* `WIN_CSC_KEY_PASSWORD`
