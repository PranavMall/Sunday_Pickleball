# Pickle-Ballers — Release 11 readiness: ownership and native SDKs

Answers to the pre-Release 11 questions, plus the ownership rules every release from 11 onward follows. Nothing in this document has been built yet.
Release 10.2 is approved, so Release 11 can start once this plan is approved.

## Who it's for
The Pickle-Ballers team (Pranav and the owners), who keep every account, ID and key for the app.

## Core features and experience (the answers)

1. **SDK support on Expo SDK 57**
   - `@react-native-firebase/app`, `/analytics` and `/crashlytics`: supported. v27.x is the current line, and its Expo config plugins work on SDK 57. Pin all three Firebase packages to the same exact version, and keep `expo` at 57.0.23 or later, because earlier 57.x builds had a prebuild bug with the plugin. v27 is SPM-only on iOS and needs `expo-build-properties` with dynamic frameworks. This only matters once there is an iOS build.
   - `react-native-purchases` (RevenueCat): supports SDK 54 and later, including 57. It needs no config plugin.
   - Version pinning: the versions `npx expo install` picks get pinned exactly (no `^`), and they only change in a release that says so.
2. **Preview, Expo Go and headless tests after adding them**
   - The web preview and Expo Go keep running, but Firebase does nothing in them, because neither contains that native code. RevenueCat switches itself to a mock "Preview API Mode" in Expo Go, and it only works there with a RevenueCat Test Store key. A real `goog_` key throws an error in Expo Go.
   - Guard: one small wrapper for analytics and crash reporting, and one for purchases. Each wrapper loads its SDK only when the app runs as a real native build. On web, in Expo Go or under Node it does nothing (or returns "no purchases available"). Game screens only ever call the wrappers.
   - Headless tests (`run.ts`, `b3Report.ts`, `shotMix.ts`) only import the simulation, which never touches these wrappers. They keep running unchanged, and both MD5 hashes are re-checked every release.
3. **Commits made on GitHub by someone else**: the workspace does not sync on its own. It sees outside commits only after a "Pull from GitHub" import. If a push meets newer commits on main, it fails with "Conflict detected". It does not quietly overwrite them. The safe way to work is to push to a release branch and merge on GitHub.
4. **Changing package, slug and scheme**: this does not affect the web preview or Expo Go. Besides `android.package` and `ios.bundleIdentifier`, the ID shows up in Expo's `owner`, `extra.eas.projectId` and `updates.url` (which get replaced by yours), and in `google-services.json`, whose package name must equal `com.pickleballers.game`. No generated `android/` or `ios/` folders are committed, so nothing else holds the old ID. Google Play treats a new package as a new app, but that doesn't matter here because the old ID was never published.
5. **Keystore download from the Play Store publish flow**: the platform's documentation doesn't mention any way to download the upload keystore or its passwords. For a definite answer, email support@emergent.sh with the job ID. This doesn't apply going forward: your own Expo account will create and hold your keystore.
6. **Handing over keys**: as chosen, attach `google-services.json` and the RevenueCat Android public key to the Release 11 brief. Both are safe to keep in the repo (the RevenueCat key is the public SDK key, not a secret key). The file goes in the project root, and the key goes in app config.
7. **Frame rate, app size and Expo Go**
   - Frame rate: no noticeable effect. Both SDKs work in the background and nothing runs in the game loop. Analytics events stay at menu and match boundaries only.
   - App size: about +3–5 MB for Firebase Analytics and Crashlytics, and about +1–2 MB for RevenueCat (Android download, approximate).
   - Not in Expo Go: Firebase Analytics, Crashlytics and real purchases. Testing them needs your own development build. The game itself and all menus still work in Expo Go.

## User flow (from Release 11 on)
1. You attach `google-services.json`, the RevenueCat public key and your Expo project ID to the brief.
2. The release is committed and pushed to a branch. You merge it on GitHub.
3. You build and upload with your own Expo account. Emergent's Publish button is never used for this app.

## UI/UX feel
No visible change from this work. Gameplay stays byte-identical.

## Implementation phases
- **Phase 1 (Release 11, MVP)**:
  - Switch to the new IDs (`com.pickleballers.game`, slug `pickle-ballers`, scheme `pickleballers`) and add your Expo project ID.
  - Add the Firebase Analytics and Crashlytics wrappers, and send the existing analytics events through them.
  - Add the RevenueCat wrapper, set up only, with no store screens.
  - Confirm that no Emergent services or `emergentintegrations` code are in anything the app uses.
- **Phase 2**: RevenueCat products and the purchase or restore flow inside the app.
- **Phase 3 (Release 12)**: AdMob, and a link to your privacy policy page in Settings.

## Assumptions
- Android first. The iOS-only Firebase settings are added but not tested until there is an iOS build.
- The template's unused backend folder stays in the repo but is not part of the app and is never called. If you prefer, it can be deleted in Release 11.
- Analytics stays switched off in the web preview and Expo Go, so test sessions don't pollute your Firebase data.
- Crash reporting stays on in release builds, with no opt-out setting for now.
- Sizes and version notes come from public documentation (June 2026) and should be checked against your first real build.
