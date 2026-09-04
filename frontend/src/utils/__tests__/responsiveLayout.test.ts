import { getResponsiveRadarWidth, shouldStackInteractiveContent } from '../responsiveLayout';

describe('responsiveLayout', () => {
  it('apila acciones con pantalla estrecha o texto ampliado', () => {
    expect(shouldStackInteractiveContent(359, 1)).toBe(true);
    expect(shouldStackInteractiveContent(390, 1.3)).toBe(true);
    expect(shouldStackInteractiveContent(390, 1)).toBe(false);
  });

  it('limita el radar en web y respeta el ancho disponible en móvil', () => {
    expect(getResponsiveRadarWidth(320)).toBe(320);
    expect(getResponsiveRadarWidth(390)).toBe(390);
    expect(getResponsiveRadarWidth(1200)).toBe(480);
  });
});
