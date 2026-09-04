import React from 'react';
import { render } from '@testing-library/react-native';

import { MentaMessageContent } from '../../components/menta/MentaMessageContent';

describe('MentaMessageContent', () => {
  it('presenta títulos, viñetas y pasos sin exponer la sintaxis Markdown', async () => {
    const view = await render(
      <MentaMessageContent
        message={'### Próxima cita\n- **Fecha:** mañana\n1. Revisa los detalles'}
      />
    );

    expect(view.getByText('Próxima cita')).toBeTruthy();
    expect(view.getByText('•', { includeHiddenElements: true })).toBeTruthy();
    expect(view.getByText('1.', { includeHiddenElements: true })).toBeTruthy();
    expect(view.queryByText('### Próxima cita')).toBeNull();
  });
});
