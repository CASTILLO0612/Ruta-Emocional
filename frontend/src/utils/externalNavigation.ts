import { Linking } from 'react-native';

export type NavigationProvider = 'GOOGLE_MAPS' | 'WAZE';

export interface NavigationDestination {
  readonly latitude: number;
  readonly longitude: number;
}

const GOOGLE_MAPS_DIRECTIONS_URL = 'https://www.google.com/maps/dir/';
const WAZE_NAVIGATION_URL = 'https://waze.com/ul';

function assertCoordinate(value: number, minimum: number, maximum: number): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error('La ubicación del consultorio no es válida.');
  }
}

export function buildExternalNavigationUrl(
  provider: NavigationProvider,
  destination: NavigationDestination
): string {
  assertCoordinate(destination.latitude, -90, 90);
  assertCoordinate(destination.longitude, -180, 180);
  const coordinates = `${destination.latitude},${destination.longitude}`;
  if (provider === 'WAZE') {
    const parameters = new URLSearchParams({
      ll: coordinates,
      navigate: 'yes',
      utm_source: 'ruta_emocional',
    });
    return `${WAZE_NAVIGATION_URL}?${parameters.toString()}`;
  }
  const parameters = new URLSearchParams({ api: '1', destination: coordinates });
  return `${GOOGLE_MAPS_DIRECTIONS_URL}?${parameters.toString()}`;
}

export function openExternalNavigation(
  provider: NavigationProvider,
  destination: NavigationDestination
): Promise<void> {
  return Linking.openURL(buildExternalNavigationUrl(provider, destination));
}
