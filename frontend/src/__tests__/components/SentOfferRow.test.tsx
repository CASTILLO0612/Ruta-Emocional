import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { SentOfferRow } from '../../components/psychologist/SentOfferRow';
import type { OwnOffer } from '../../repositories/OfferRepository';

const pendingOffer: OwnOffer = {
  offer: {
    id: 'offer-1',
    requestId: 'request-1',
    psychologistId: 'profile-1',
    psychologistName: 'Diana Castillo',
    psychologistRating: 4.8,
    amount: 500,
    currencyCode: 'NIO',
    status: 'pending',
    createdAt: new Date('2026-10-06T12:00:00.000Z'),
  },
  request: {
    modality: 'call',
    primaryNeed: 'Manejo de ansiedad',
    proposedBudget: 450,
    currencyCode: 'NIO',
    status: 'BIDDING',
    scheduledFor: null,
    expiresAt: new Date('2026-10-07T12:00:00.000Z'),
  },
};

describe('SentOfferRow', () => {
  it('permite retirar únicamente una oferta pendiente', async () => {
    const onWithdraw = jest.fn();
    const view = await render(
      <SentOfferRow item={pendingOffer} isWithdrawing={false} onWithdraw={onWithdraw} />
    );

    await fireEvent.press(view.getByRole('button', { name: 'Retirar oferta' }));
    expect(onWithdraw).toHaveBeenCalledWith(pendingOffer);
  });

  it('oculta la acción cuando la oferta ya fue aceptada', async () => {
    const view = await render(
      <SentOfferRow
        item={{ ...pendingOffer, offer: { ...pendingOffer.offer, status: 'accepted' } }}
        isWithdrawing={false}
        onWithdraw={jest.fn()}
      />
    );

    expect(view.queryByRole('button', { name: 'Retirar oferta' })).toBeNull();
    expect(view.getByText('Llamada · Aceptada')).toBeTruthy();
  });
});
