import { Layout } from '../theme/layout';

export function shouldStackInteractiveContent(width: number, fontScale: number): boolean {
  return width < Layout.compactWidth || fontScale >= Layout.largeTextScale;
}

export function getResponsiveRadarWidth(width: number): number {
  return Math.min(Math.max(width, 0), Layout.maxRadarWidth);
}
