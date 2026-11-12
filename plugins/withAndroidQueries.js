const { withAndroidManifest } = require('expo/config-plugins');

const QUERY_INTENTS = [
  { action: 'android.intent.action.VIEW', scheme: 'geo' },
  { action: 'android.intent.action.VIEW', scheme: 'google.navigation' },
  { action: 'android.intent.action.VIEW', scheme: 'https' },
  { action: 'android.intent.action.VIEW', scheme: 'http' },
  { action: 'android.intent.action.VIEW', scheme: 'mailto' },
];

/**
 * Adds Android 11+ <queries> intent entries so Linking.canOpenURL / openURL
 * can resolve map navigation, external web links, and email clients in release builds.
 */
module.exports = function withAndroidQueries(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    if (!Array.isArray(manifest.queries)) {
      manifest.queries = [{}];
    } else if (manifest.queries.length === 0) {
      manifest.queries.push({});
    }

    const queriesNode = manifest.queries[0];
    const existingIntents = Array.isArray(queriesNode.intent) ? queriesNode.intent : [];

    for (const spec of QUERY_INTENTS) {
      const alreadyExists = existingIntents.some((entry) => {
        const actionMatch = entry?.action?.[0]?.$?.['android:name'] === spec.action;
        const schemeMatch = entry?.data?.[0]?.$?.['android:scheme'] === spec.scheme;
        return actionMatch && schemeMatch;
      });

      if (!alreadyExists) {
        existingIntents.push({
          action: [{ $: { 'android:name': spec.action } }],
          data: [{ $: { 'android:scheme': spec.scheme } }],
        });
      }
    }

    queriesNode.intent = existingIntents;
    return modConfig;
  });
};
