# WorkSet Android APK updates

The web/PWA and Android APK have different update mechanisms. Web uses
`version.json` and Refresh WorkSet. Android must install a newer signed APK
through Android's installer, with explicit user approval.

## Test APK

The workflow **Build WorkSet Android (testing)** uploads an artifact named
`WorkSet-Android-Test`. It contains exactly one file, `WorkSet.apk`.
Debug-signed artifacts may have a different signing certificate on every
GitHub runner. They cannot always replace an installed debug APK.

Sync data before removing an old debug install. Unsynced local entries may
be lost if uninstalling becomes necessary.

## Stable signed APK channel

Use the workflow **Publish WorkSet Android (signed release)**. Keep the same
Android signing key forever; never place it in GitHub source or this chat.

Configure these four repository Actions secrets:
- `WORKSET_ANDROID_KEYSTORE_BASE64` — JKS keystore Base64
- `WORKSET_ANDROID_KEYSTORE_PASSWORD` — keystore password
- `WORKSET_ANDROID_KEY_ALIAS` — alias
- `WORKSET_ANDROID_KEY_PASSWORD` — private key password

Generate a signing key on your own PC using Java's `keytool`:

    keytool -genkeypair -v -keystore WorkSet-release.jks -alias workset -keyalg RSA -keysize 3072 -validity 10000

Encode locally with PowerShell, then paste the output only into the GitHub
secret input:

    [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Secure\WorkSet-release.jks"))

Keep a secure backup of the original key and both passwords. The workflow
refuses to publish unless all secrets are configured. It creates a signed,
verified GitHub Release with exactly one APK asset: `WorkSet.apk`.

## In-app Android updates

Me → **Check APK updates** checks the latest published release. If its
Android version code is newer, the button **Download & install** appears.
The updater accepts only the official WorkSet GitHub APK URL, requires the
GitHub-provided SHA-256 digest, verifies the downloaded file, and opens
Android's installer. Android may request "Allow from this source" first.
No silent installation, no automatic deletion of training data.

The old debug APK may require one-time uninstall/reinstall to switch to the
persistent release signature. Sync/backup data first. Thereafter, the same
package ID `com.workset.mobile` and signing key allow in-place updates.

## Native system bar fix and rollback

`scripts/prepare-android-native.mjs` restores native Java/plugin/manifest
changes every time Capacitor generates the Android project. Samsung's
system-navigation inset is measured in native code and applied to the bottom
navigation and content. The web and iPhone layouts are unchanged.

Test Today, Me, Plan, Board, Food, keyboard, three-button system navigation,
gesture navigation, and landscape rotation on an actual Samsung.

For rollback, restore source from the snapshot branch and publish a **newer**
signed Android build; Android does not accept older version codes as updates.
