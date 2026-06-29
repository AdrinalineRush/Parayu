# Parayu Android

This is the native Android dev-testing target for Parayu. It currently provides the mobile voice-to-text shell: microphone permission, Android speech input, transcript display, copy, and share.

Build on a machine with Java 17 and the Android SDK:

```bash
gradle :app:assembleDebug
```

The APK is written to:

```text
app/build/outputs/apk/debug/app-debug.apk
```

The GitHub Actions workflow in `.github/workflows/platform-builds.yml` installs Java, Android SDK tooling, and Gradle for CI builds.
