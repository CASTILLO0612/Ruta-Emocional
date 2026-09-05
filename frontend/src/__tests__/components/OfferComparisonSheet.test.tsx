import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { OfferComparisonSheet } from '../../components/shared/OfferComparisonSheet';
import type { Offer } from '../../models/Offer';
import type { ActiveRequest } from '../../models/ActiveRequest';

describe('OfferComparisonSheet', () => {
  const mockRequest: ActiveRequest = {
    id: 'req-1',
    modality: 'chat',
    proposedBudget: 500,
    currencyCode: 'NIO',
    status: 'bidding',
    expiresAt: new Date(),
    createdAt: new Date(),
  };

  const mockOfferWithRating: Offer = {
    id: 'off-1',
    requestId: 'req-1',
    psychologistId: 'psy-1',
    psychologistName: 'Dra. María Morales',
    psychologistSpecialty: 'Terapia Cognitivo Conductual',
    psychologistRating: 4.9,
    amount: 600,
    currencyCode: 'NIO',
    message: 'Hola, tengo disponibilidad inmediata para atenderte.',
    status: 'pending',
    createdAt: new Date(),
  };

  const mockOfferWithoutRating: Offer = {
    id: 'off-2',
    requestId: 'req-1',
    psychologistId: 'psy-2',
    psychologistName: 'Lic. Juan Pérez',
    psychologistRating: 0,
    amount: 450,
    currencyCode: 'NIO',
    status: 'pending',
    createdAt: new Date(),
  };

  it('muestra la comparación monetaria exacta y los detalles de la oferta', async () => {
    const onAccept = jest.fn();
    const onClose = jest.fn();
    const onViewProfile = jest.fn();

    const { getByText } = await render(
      <OfferComparisonSheet
        visible={true}
        offer={mockOfferWithRating}
        request={mockRequest}
        onAccept={onAccept}
        onClose={onClose}
        onViewProfile={onViewProfile}
      />
    );

    expect(getByText('Dra. María Morales')).toBeTruthy();
    expect(getByText('Terapia Cognitivo Conductual')).toBeTruthy();
    expect(getByText('Hola, tengo disponibilidad inmediata para atenderte.')).toBeTruthy();
    expect(getByText('C$ 500.00')).toBeTruthy();
    expect(getByText('C$ 600.00')).toBeTruthy();
    expect(getByText('+C$ 100.00')).toBeTruthy();
    expect(getByText('4.9')).toBeTruthy();
  });

  it('no muestra valoración de estrellas si el rating es 0', async () => {
    const { queryByText, getByText } = await render(
      <OfferComparisonSheet
        visible={true}
        offer={mockOfferWithoutRating}
        request={mockRequest}
        onAccept={jest.fn()}
        onClose={jest.fn()}
        onViewProfile={jest.fn()}
      />
    );

    expect(getByText('Lic. Juan Pérez')).toBeTruthy();
    expect(queryByText('0.0')).toBeNull();
    expect(queryByText('0')).toBeNull();
  });

  it('ejecuta onAccept con la oferta seleccionada', async () => {
    const onAccept = jest.fn();
    const { getByText } = await render(
      <OfferComparisonSheet
        visible={true}
        offer={mockOfferWithRating}
        request={mockRequest}
        onAccept={onAccept}
        onClose={jest.fn()}
        onViewProfile={jest.fn()}
      />
    );

    fireEvent.press(getByText('Aceptar oferta'));
    expect(onAccept).toHaveBeenCalledWith(mockOfferWithRating);
  });
});
