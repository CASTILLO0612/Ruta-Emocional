import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  if (!config.name || !config.slug) {
    throw new Error('Expo name and slug must be defined in app.json.');
  }
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (process.env.EAS_BUILD_PROFILE === 'production' && !googleMapsApiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY must be injected for the production EAS build.');
  }

  return {
    ...config,
    name: config.name,
    slug: config.slug,
    ios: {
      ...config.ios,
      ...(googleMapsApiKey
        ? {
          config: {
            ...config.ios?.config,
            googleMapsApiKey,
          },
        }
        : {}),
    },
    android: {
      ...config.android,
      ...(googleMapsApiKey
        ? {
          config: {
            ...config.android?.config,
            googleMaps: { apiKey: googleMapsApiKey },
          },
        }
        : {}),
    },
  };
};
