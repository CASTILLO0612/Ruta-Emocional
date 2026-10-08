import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RequestSummary } from '../../components/wizard/RequestSummary';

describe('RequestSummary', () => {
  it('presenta una revisión breve y permite regresar al dato elegido', async () => {
    const onEditStep = jest.fn();
    const view = await render(
      <RequestSummary
        draft={{
          primaryNeed: 'Ansiedad y estrés',
          description: 'Necesito acompañamiento para manejar la presión laboral.',
          modality: 'in-person',
          timing: 'scheduled',
          scheduledFor: new Date('2026-09-30T16:00:00.000Z'),
          proposedBudgetInput: '500.00',
          currencyCode: 'NIO',
        }}
        onEditStep={onEditStep}
      />
    );

    expect(view.getByText('Confirma los datos antes de publicarla.')).toBeTruthy();
    expect(view.getByText('Solo profesionales verificados podrán verla.')).toBeTruthy();
    expect(view.queryByText(/No publicamos tus datos de contacto/)).toBeNull();

    fireEvent.press(view.getByLabelText('Editar horario de atención'));
    expect(onEditStep).toHaveBeenCalledWith(3);
  });
});
