# Parayu Platform Dev Testing Notes

This project is still in dev testing. These commands are for internal checks and tester builds, not public launch distribution.

macOS is already handled by the existing dev DMG flow:

```bash
npm run dist && ./seal-dmg-background.sh
```

## Windows Dev Testing

Local smoke package from macOS:

```bash
npm run test:win
```

Installer test on Windows:

```bash
npm run dist:win
```

Outputs:

```text
dist/*.exe
dist/*.zip
```

Production signing is intentionally not required for dev testing. Only add these later when preparing a real public Windows launch:

```text
WIN_CSC_LINK
WIN_CSC_KEY_PASSWORD
```

## iOS Dev Testing

This repo contains the Swift package iOS app in `Parayu.swiftpm`.

Compile check only:

```bash
npm run test:ios
```

Local builds require full Xcode, not only Command Line Tools:

```bash
sudo xcode-select -s /Applications/Xcode.app
```

For TestFlight or the App Store later, add your Apple Team ID in `Parayu.swiftpm/Package.swift` and archive/sign from Xcode or CI with provisioning configured.

## Android Dev Testing

The Android target is in `android/`.

Debug APK build:

```bash
npm run test:android
```

Local builds require Java 17, Android SDK, and Gradle. The GitHub Actions workflow installs those automatically and uploads the debug APK from:

```text
android/app/build/outputs/apk/debug/*.apk
```

## Doctor

Check local platform readiness:

```bash
npm run doctor:platforms
```
