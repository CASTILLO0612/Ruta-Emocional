import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ProfessionalOfferSheet } from '../../components/psychologist/ProfessionalOfferSheet';
import type { ActiveRequest } from '../../models/ActiveRequest';

const request: ActiveRequest = {
  id: 'request-1',
  modality: 'call',
  primaryNeed: 'Manejo del estrés',
  proposedBudget: 500,
  currencyCode: 'NIO',
  status: 'pending',
  expiresAt: new Date(Date.now() + 60_000),
  createdAt: new Date(),
};

describe('ProfessionalOfferSheet', () => {
  it('valida el importe y compara una propuesta válida', async () => {
    const onSubmit = jest.fn();
    const onAmountChange = jest.fn();
    const commonProps = {
      request,
      minimumAmount: 300,
      maximumAmount: 1200,
      isSubmitting: false,
      onAmountChange,
      onSubmit,
      onClose: jest.fn(),
    };
    const view = await render(
      <ProfessionalOfferSheet {...commonProps} amountInput="100" />
    );

    expect(view.getByText('Ingresa un importe entre C$ 300.00 y C$ 1,200.00.'))
      .toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Enviar propuesta' }));
    expect(onSubmit).not.toHaveBeenCalled();

    await view.rerender(<ProfessionalOfferSheet {...commonProps} amountInput="600" />);
    expect(view.getByText('C$ 500.00')).toBeTruthy();
    expect(view.getByText('C$ 600.00')).toBeTruthy();

    await fireEvent.changeText(view.getByLabelText('Importe de la oferta'), '650');
    await fireEvent.press(view.getByLabelText('Enviar propuesta por C$ 600.00'));

    expect(onAmountChange).toHaveBeenCalledWith('650');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
