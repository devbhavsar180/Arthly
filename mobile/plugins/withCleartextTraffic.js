const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Enables Android cleartext traffic so personal users can connect their APK
 * to a self-hosted LAN FastAPI backend (e.g. http://192.168.x.x:8000/api/v1)
 * in addition to HTTPS production servers.
 */
module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app && app.$) {
      app.$["android:usesCleartextTraffic"] = "true";
      app.$["android:extractNativeLibs"] = "true";
    }
    return cfg;
  });
};
