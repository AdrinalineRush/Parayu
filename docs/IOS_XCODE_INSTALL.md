# Parayu iOS Xcode Install

This package contains the native iOS version of Parayu plus the Parayu keyboard extension.

## What Is Included

- SwiftUI iOS app: Dashboard, Transcribe, History, Settings, Dictionary, Snippets
- Parayu iOS keyboard extension
- Malayalam to English / Malayalam transcription toggle
- Bundled Small multilingual Whisper model for offline Malayalam dictation
- Optional model downloader for other Whisper models
- Local vendored Whisper engine, so Xcode does not need a remote `whisper.cpp` Swift package product

## Install On iPhone From Xcode

1. Install the full Xcode app from the Mac App Store, then open Xcode once.
2. Open `Parayu.xcodeproj`.
3. Select the `Parayu` project in the left sidebar.
4. For both targets, `Parayu` and `ParayuKeyboard`, open **Signing & Capabilities**.
5. Select your Apple Developer Team.
6. Keep the bundle IDs as:
   - App: `com.parayu.app`
   - Keyboard: `com.parayu.app.keyboard`
7. Make sure App Groups is enabled for both targets with:
   - `group.com.parayu.app`
8. Connect your iPhone, select it as the run destination, then press Run.

## Enable The Keyboard On iPhone

1. Open iPhone Settings.
2. Go to **General > Keyboard > Keyboards > Add New Keyboard**.
3. Select **ParayuKeyboard**.
4. Open any text field, switch to the Parayu keyboard, and tap the mic area to hand off dictation to the Parayu app.

## Create An IPA Later

An `.ipa` requires Apple signing from Xcode:

1. In Xcode, select **Any iOS Device** as destination.
2. Choose **Product > Archive**.
3. In Organizer, choose **Distribute App**.
4. Pick Development, Ad Hoc, TestFlight, or App Store depending on your Apple account.

## Notes

- This terminal environment does not have full Xcode installed, so the package was prepared and validated, but not compiled here.
- The included project uses automatic signing. Xcode may ask you to update the Team or bundle IDs for your Apple account.
- The bundled model makes the app large, but it lets Malayalam dictation work offline after install.
