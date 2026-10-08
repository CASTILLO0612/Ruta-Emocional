import { OPEN_STREET_MAP_EMBED_BASE_URL } from '../config/mapProvider';

export interface MapCoordinate {
  readonly latitude: number;
  readonly longitude: number;
}

export interface MapRegion extends MapCoordinate {
  readonly latitudeDelta: number;
  readonly longitudeDelta: number;
}

interface OpenStreetMapEmbedInput {
  readonly region: MapRegion;
  readonly routeStart?: MapCoordinate;
  readonly routeEnd?: MapCoordinate;
}

function formatCoordinate(value: number): string {
  return String(Number(value.toFixed(6)));
}

export function buildOpenStreetMapEmbedUrl({
  region,
  routeStart,
  routeEnd,
}: OpenStreetMapEmbedInput): string {
  const routeCoordinates = routeStart && routeEnd
    ? [routeStart, routeEnd]
    : null;
  const minimumLatitude = routeCoordinates
    ? Math.min(...routeCoordinates.map(({ latitude }) => latitude))
    : region.latitude - region.latitudeDelta / 2;
  const maximumLatitude = routeCoordinates
    ? Math.max(...routeCoordinates.map(({ latitude }) => latitude))
    : region.latitude + region.latitudeDelta / 2;
  const minimumLongitude = routeCoordinates
    ? Math.min(...routeCoordinates.map(({ longitude }) => longitude))
    : region.longitude - region.longitudeDelta / 2;
  const maximumLongitude = routeCoordinates
    ? Math.max(...routeCoordinates.map(({ longitude }) => longitude))
    : region.longitude + region.longitudeDelta / 2;
  const padding = routeCoordinates ? 0.01 : 0;
  const boundingBox = [
    minimumLongitude - padding,
    minimumLatitude - padding,
    maximumLongitude + padding,
    maximumLatitude + padding,
  ].map(formatCoordinate).join(',');
  const parameters = new URLSearchParams({
    bbox: boundingBox,
    layer: 'mapnik',
    marker: `${formatCoordinate(region.latitude)},${formatCoordinate(region.longitude)}`,
  });

  return `${OPEN_STREET_MAP_EMBED_BASE_URL}?${parameters.toString()}`;
}
