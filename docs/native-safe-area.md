# WorkSet native system bars and iPhone Duo

WorkSet 2.7.18 keeps browser/PWA styling unchanged. Native platforms add an html class (workset-native-android or workset-native-ios). Native CSS is scoped to those classes.

Android 15+ uses a Java WindowInsets listener in assets/native/android/MainActivity.java. GitHub's APK workflow copies it into the generated Capacitor project after cap sync. The activity passes actual navigation and mandatory gesture inset values as CSS px; fixed WorkSet tabs sit ABOVE those values. On Android <=14, native bottom inset is zero where the OS fits the WebView. A 32px native-only CSS fallback protects initial startup before the actual value arrives. Avoid applying whole-body bottom safe-area padding too, which would double count.

iOS sets contentInset=never, leaving safe area positioning to CSS env() independently for left/right/bottom. The layout responds to narrow cover screen, inner portrait, landscape rails, and split-view resized windows; do not rely on fixed device dimensions. Playwright tests simulate multiple fold layouts and asymmetric insets, but a generic iOS simulator compile is NOT physical iPhone Duo device validation.

Do not uninstall a debug APK while workouts are offline/unsynced. APK filename stays WorkSet.apk; app version now 2.7.18.
