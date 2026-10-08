import { buildOpenStreetMapEmbedUrl } from '../openStreetMapEmbed';

const region = {
  latitude: 12.1328,
  longitude: -86.2904,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

test('OpenStreetMap embed URL represents the visible region and current location', () => {
  const url = new URL(buildOpenStreetMapEmbedUrl({ region }));

  expect(url.origin).toBe('https://www.openstreetmap.org');
  expect(url.pathname).toBe('/export/embed.html');
  expect(url.searchParams.get('layer')).toBe('mapnik');
  expect(url.searchParams.get('marker')).toBe('12.1328,-86.2904');
  expect(url.searchParams.get('bbox')).toBe('-86.3104,12.1128,-86.2704,12.1528');
});

test('OpenStreetMap embed URL includes both endpoints when a route is present', () => {
  const url = new URL(buildOpenStreetMapEmbedUrl({
    region,
    routeStart: { latitude: 12.1, longitude: -86.3 },
    routeEnd: { latitude: 12.2, longitude: -86.2 },
  }));

  expect(url.searchParams.get('bbox')).toBe('-86.31,12.09,-86.19,12.21');
});
