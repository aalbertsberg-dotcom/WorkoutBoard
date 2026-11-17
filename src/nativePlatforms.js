// Shared capability check for the two native WorkSet shells. The web/PWA
// intentionally continues using its separate foreground geolocation fallback.
export function supportsNativeBackgroundGps(nativePlatform, platform) {
  return Boolean(nativePlatform) && (platform==='android'||platform==='ios')
}
export function nativeGpsPlatformLabel(nativePlatform,platform) {
  return supportsNativeBackgroundGps(nativePlatform,platform)
    ? (platform==='ios'?'iPhone':'Android')
    : 'Browser'
}
