import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { RequestCard } from '../../components/psychologist/RequestCard';
import type { ActiveRequest } from '../../models/ActiveRequest';

const request: ActiveRequest = {
  id: 'request-1',
  modality: 'chat',
  primaryNeed: 'Ansiedad y estrés',
  description: 'Busco acompañamiento para manejar episodios recientes de ansiedad.',
  proposedBudget: 500,
  currencyCode: 'NIO',
  status: 'bidding',
  expiresAt: new Date(Date.now() + 60_000),
  createdAt: new Date(),
};

describe('RequestCard', () => {
  it('presenta solo el contexto necesario para decidir', async () => {
    const { getByText, queryByText } = await render(
      <RequestCard
        request={request}
        onOfferProposedAmount={jest.fn()}
        onAdjustRate={jest.fn()}
      />
    );

    expect(getByText('Ansiedad y estrés')).toBeTruthy();
    expect(getByText('Chat')).toBeTruthy();
    expect(getByText('Atención lo antes posible')).toBeTruthy();
    expect(getByText('C$ 500.00')).toBeTruthy();
    expect(getByText('Identidad protegida')).toBeTruthy();
    expect(queryByText('Solicitud de atención')).toBeNull();
    expect(queryByText(request.description!)).toBeNull();
  });

  it('separa la oferta directa del ajuste de tarifa', async () => {
    const onOfferProposedAmount = jest.fn();
    const onAdjustRate = jest.fn();
    const { getByLabelText, getByText } = await render(
      <RequestCard
        request={request}
        onOfferProposedAmount={onOfferProposedAmount}
        onAdjustRate={onAdjustRate}
      />
    );

    await fireEvent.press(getByLabelText('Enviar oferta por C$ 500.00'));
    await fireEvent.press(getByText('Cambiar tarifa'));

    expect(onOfferProposedAmount).toHaveBeenCalledWith(request);
    expect(onAdjustRate).toHaveBeenCalledWith(request);
  });
});
