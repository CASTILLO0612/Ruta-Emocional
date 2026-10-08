import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  if (!config.name || !config.slug) {
    throw new Error('Expo name and slug must be defined in app.json.');
  }

  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const navigationApiKey = process.env.GOOGLE_NAVIGATION_API_KEY?.trim() || googleMapsApiKey;
  const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  const googleServicesFile = process.env.GOOGLE_SERVICES_FILE?.trim();

  if (process.env.EAS_BUILD_PROFILE && !navigationApiKey) {
    throw new Error(
      'GOOGLE_NAVIGATION_API_KEY must be injected for every native EAS build.'
    );
  }
  if (navigationApiKey && !/^AIza[0-9A-Za-z_-]{30,}$/.test(navigationApiKey)) {
    throw new Error('GOOGLE_NAVIGATION_API_KEY does not have a valid Google API key format.');
  }

  return {
    ...config,
    name: config.name,
    slug: config.slug,
    extra: {
      ...config.extra,
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
    ios: {
      ...config.ios,
      ...(navigationApiKey
        ? {
          config: {
            ...config.ios?.config,
            googleMapsApiKey: navigationApiKey,
          },
        }
        : {}),
    },
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
      config: {
        ...config.android?.config,
        ...(navigationApiKey
          ? { googleMaps: { apiKey: navigationApiKey } }
          : {}),
      },
    },
  };
};
