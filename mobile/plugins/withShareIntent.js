const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Adds Android Share Sheet (ACTION_SEND for image/*) intent filter so users
 * can share UPI payment screenshots from Google Pay, PhonePe, Paytm, or Gallery
 * directly into Arthly.
 */
module.exports = function withShareIntent(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    const mainActivity = app?.activity?.find(
      (a) => a.$?.["android:name"] === ".MainActivity"
    );
    if (!mainActivity) return cfg;

    mainActivity["intent-filter"] = mainActivity["intent-filter"] || [];
    const hasShare = mainActivity["intent-filter"].some((f) =>
      f.action?.some((act) => act.$?.["android:name"] === "android.intent.action.SEND")
    );
    if (!hasShare) {
      mainActivity["intent-filter"].push({
        action: [{ $: { "android:name": "android.intent.action.SEND" } }],
        category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
        data: [{ $: { "android:mimeType": "image/*" } }],
      });
    }
    return cfg;
  });
};
