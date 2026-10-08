import { MapColorScheme } from '@googlemaps/react-native-navigation-sdk';

export const GOOGLE_ROAD_MAP_PRESENTATION = {
  mapColorScheme: MapColorScheme.LIGHT,
  mapToolbarEnabled: false,
  indoorEnabled: false,
  indoorLevelPickerEnabled: false,
  buildingsEnabled: true,
  trafficEnabled: true,
} as const;

export const GOOGLE_DIRECTORY_MAP_PRESENTATION = {
  ...GOOGLE_ROAD_MAP_PRESENTATION,
  trafficEnabled: false,
} as const;
