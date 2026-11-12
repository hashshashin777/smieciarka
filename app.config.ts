import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const androidMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY;

  return {
    ...config,
    name: config.name ?? 'Śmieciarka',
    slug: config.slug ?? 'smieciarka',
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        ...(androidMapsApiKey
          ? {
              googleMaps: {
                apiKey: androidMapsApiKey,
              },
            }
          : {}),
      },
    },
  };
};
