import React from 'react';
import { render } from '@testing-library/react-native';

import { BrandLogo } from '../../components/common/BrandLogo';
import { BrandSymbol } from '../../components/common/BrandSymbol';

describe('Brand identity', () => {
  it('expone el logotipo positivo sin deformarlo ni invertir sus colores', async () => {
    const view = await render(<BrandLogo size="hero" variant="positive" />);
    const logo = view.getByRole('image', { name: 'Ruta Emocional' });

    expect(logo.props.resizeMode).toBe('contain');
    expect(logo.props.accessibilityIgnoresInvertColors).toBe(true);
  });

  it('expone una fuente distinta para la aplicación negativa', async () => {
    const positiveView = await render(<BrandLogo variant="positive" />);
    const negativeView = await render(<BrandLogo variant="negative" />);
    const positive = positiveView.getByRole('image', { name: 'Ruta Emocional' });
    const negative = negativeView.getByRole('image', { name: 'Ruta Emocional' });

    expect(positive.props.source).not.toEqual(negative.props.source);
  });

  it('permite que el logotipo y el isotipo sean decorativos', async () => {
    const logo = await render(<BrandLogo decorative />);
    const symbol = await render(<BrandSymbol decorative />);

    expect(logo.queryByLabelText('Ruta Emocional')).toBeNull();
    expect(symbol.queryByLabelText('Símbolo de Ruta Emocional')).toBeNull();
  });
});
