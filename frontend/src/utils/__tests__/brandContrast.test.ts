import { BrandColors, Colors } from '../../theme/colors';

function channelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const channels = hex.match(/[\da-f]{2}/gi)?.map((channel) => Number.parseInt(channel, 16));
  if (!channels || channels.length !== 3) throw new Error(`Color HEX inválido: ${hex}`);

  const [red, green, blue] = channels.map(channelToLinear);
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('brand color contrast', () => {
  test.each([
    ['texto inverso sobre primario', Colors.textInverse, Colors.primary],
    ['primario sobre celeste', Colors.primary, BrandColors.lightBlue],
    ['primario sobre lima', Colors.primary, BrandColors.lime],
    ['texto principal sobre superficie', Colors.textPrimary, Colors.surface],
    ['texto secundario sobre superficie', Colors.textSecondary, Colors.surface],
    ['texto terciario sobre superficie', Colors.textTertiary, Colors.surface],
    ['error sobre su superficie', Colors.error, Colors.errorSurface],
    ['éxito sobre su superficie', Colors.success, Colors.successSurface],
    ['advertencia sobre su superficie', Colors.warning, Colors.warningSurface],
  ])('%s alcanza WCAG AA para texto normal', (_label, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
