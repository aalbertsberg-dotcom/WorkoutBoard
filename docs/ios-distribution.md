# WorkSet iPhone builds and TestFlight

WorkSet shares the same React workout tracker, Supabase accounts, and training history on web, Android and iOS. Background GPS uses the existing native Capacitor location plugin; activity recording still requires testing on real iPhones.

## Build verification (no Apple account required)

GitHub Actions → **Build WorkSet iOS (simulator validation)** uses macOS/Xcode to build an unsigned simulator app. This verifies that the iOS wrapper, permissions and dependencies compile. The simulator artifact **cannot be installed on a real iPhone**.

## To invite friends through TestFlight

1. Enroll in the Apple Developer Program and open App Store Connect. Register an app using the bundle ID from `capacitor.config.json` (currently `com.workset.mobile`). If unavailable in your account, change it **before** distributing builds and keep the provisioning profile consistent.
2. Generate an **Apple Distribution** certificate (export as encrypted `.p12`) and an App Store provisioning profile for that same bundle identifier.
3. Create an **App Store Connect API key** authorized to upload builds.
4. In the GitHub repository, set these **Actions secrets**:
   - `APPLE_TEAM_ID`: Apple Developer team ID
   - `IOS_DISTRIBUTION_P12_BASE64`: base64-encoded Apple Distribution certificate/private-key `.p12`
   - `IOS_DISTRIBUTION_P12_PASSWORD`: password used to export the `.p12`
   - `IOS_APPSTORE_PROFILE_BASE64`: base64-encoded App Store provisioning `.mobileprovision`
   - `APPSTORE_API_KEY_ID`: App Store Connect API key ID
   - `APPSTORE_ISSUER_ID`: App Store Connect API issuer ID
   - `APPSTORE_API_PRIVATE_KEY`: private-key `.p8` contents
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: existing public Supabase application key used by both mobile platforms
5. Run **Upload WorkSet to TestFlight (Apple signing required)** manually in Actions. The workflow creates a signed iOS archive, exports an IPA and uploads it. If your Apple account or Xcode signing setup differs, check the workflow and signing profile name before rerunning.
6. Wait for Apple to process the build. Invite internal testers, then request any required external beta review before sharing invitations.

The unsigned CI build should pass **before** attempting TestFlight. Never send Apple private keys in a chat, issue, pull request or source file; use GitHub encrypted secrets only.

## iPhone behavior

- Location is requested when the user starts an outdoor workout; iOS can continue delivering updates while a workout is active if permission permits.
- `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, `UIBackgroundModes=location`, motion and camera purpose strings are written to the generated `Info.plist` by `scripts/configure-ios.sh`.
- On iOS, background tracking is indicated by the system's location indicator rather than an Android notification.
- Native signup email confirmation/password reset opens the hosted WorkSet web URL; existing passwords work inside the app.
- Step estimates in the WebView are **not** yet a verified background iOS pedometer. Native step counting may be added after locked-screen GPS is validated.

The Android release is unchanged; avoid interpreting a simulator build as a real-device location test.
