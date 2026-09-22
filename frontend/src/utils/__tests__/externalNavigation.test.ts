import { buildExternalNavigationUrl } from '../externalNavigation';

describe('buildExternalNavigationUrl', () => {
  it('crea una ruta universal de Google Maps sin clave de API', () => {
    const url = buildExternalNavigationUrl('GOOGLE_MAPS', {
      latitude: 12.114,
      longitude: -86.236,
    });

    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=12.114%2C-86.236'
    );
  });

  it('crea una ruta universal de Waze con navegación activa', () => {
    const url = buildExternalNavigationUrl('WAZE', {
      latitude: 12.114,
      longitude: -86.236,
    });

    expect(url).toContain('https://waze.com/ul?');
    expect(url).toContain('ll=12.114%2C-86.236');
    expect(url).toContain('navigate=yes');
    expect(url).toContain('utm_source=ruta_emocional');
  });

  it('rechaza coordenadas inválidas', () => {
    expect(() => buildExternalNavigationUrl('WAZE', {
      latitude: 120,
      longitude: -86.236,
    })).toThrow('La ubicación del consultorio no es válida.');
  });
});
