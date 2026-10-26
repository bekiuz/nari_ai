# Nari AI Android APK wrapper

This module opens the existing Nari AI web app inside an Android WebView.

## Build

The GitHub Actions workflow `.github/workflows/build-nari-apk.yml` builds a debug APK with Android SDK 35 and Java 17. The resulting file is:

`android-wrapper/app/build/outputs/apk/debug/app-debug.apk`

The APK is uploaded as the `nari-ai-debug-apk` workflow artifact.

## Notes

- App ID: `com.bekiuz.nari`
- App name: `Nari AI`
- The web app must be reachable at `https://nari-ai.ai.studio/`.
- Microphone and file upload permission requests are handled by the wrapper.
- This is a WebView wrapper, not a fully offline/native rewrite. Internet access is required.
- This is a debug APK for testing, not a signed Play Store release.
