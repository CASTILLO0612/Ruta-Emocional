import React from 'react';

import { LegalNoticesScreen } from '../../screens/shared/LegalNoticesScreen';
import { renderWithStackNavigation } from '../helpers/renderWithNavigation';

describe('Legal notices screen', () => {
  it('expone las atribuciones de navegación desde una pantalla independiente', async () => {
    const view = await renderWithStackNavigation({
      screens: [{ name: 'LegalNotices', component: LegalNoticesScreen }],
      initialRouteName: 'LegalNotices',
    });

    expect(view.getByText('Avisos legales')).toBeTruthy();
    expect(view.getByLabelText('Atribuciones y licencias de navegación')).toBeTruthy();
  });
});
