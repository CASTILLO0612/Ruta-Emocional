import React from 'react';
import { render } from '@testing-library/react-native';
import { processColor } from 'react-native';

import { GoogleLogo } from '../../components/auth/GoogleLogo';
import { ExternalBrandColors } from '../../theme/colors';

describe('GoogleLogo', () => {
  it('usa las cuatro tintas del identificador oficial de Google', async () => {
    const view = await render(<GoogleLogo />);

    const hidden = { includeHiddenElements: true };
    expect(view.getByTestId('google-logo-blue', hidden).props.fill.payload)
      .toBe(processColor(ExternalBrandColors.googleBlue));
    expect(view.getByTestId('google-logo-green', hidden).props.fill.payload)
      .toBe(processColor(ExternalBrandColors.googleGreen));
    expect(view.getByTestId('google-logo-yellow', hidden).props.fill.payload)
      .toBe(processColor(ExternalBrandColors.googleYellow));
    expect(view.getByTestId('google-logo-red', hidden).props.fill.payload)
      .toBe(processColor(ExternalBrandColors.googleRed));
  });
});
