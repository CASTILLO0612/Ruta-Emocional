import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ContextSuggestionCard } from '../../components/shared/ContextSuggestionCard';

describe('ContextSuggestionCard', () => {
  it('presenta una sugerencia compacta y ejecuta una única acción contextual', async () => {
    const onAction = jest.fn();
    const view = await render(
      <ContextSuggestionCard
        text="Prepara tu próxima consulta con una guía personalizada."
        actionLabel="Preparar consulta"
        onAction={onAction}
      />
    );

    expect(view.getByText('MENTA')).toBeTruthy();
    expect(view.getByText('Prepara tu próxima consulta con una guía personalizada.')).toBeTruthy();

    fireEvent.press(
      view.getByLabelText(
        'MENTA. Prepara tu próxima consulta con una guía personalizada. Preparar consulta'
      )
    );

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
