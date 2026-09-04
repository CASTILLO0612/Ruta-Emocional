import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { AcceptedOfferScreen } from '../../screens/patient/AcceptedOfferScreen';
import { renderWithStackNavigation } from '../helpers/renderWithNavigation';
import { Text, View } from 'react-native';

const MockConsultationScreen = () => (
  <View>
    <Text>Consultation Room Content</Text>
  </View>
);

describe('AcceptedOfferScreen', () => {
  const baseSnapshot = {
    requestId: 'req-1',
    offerId: 'off-1',
    careRelationshipId: 'rel-1',
    conversationId: 'conv-123',
    psychologistId: 'psy-1',
    psychologistName: 'Dra. Elena Ramos',
    psychologistSpecialty: 'Psicología Clínica',
    psychologistRating: 4.9,
    amountDecimal: '650.00',
    currencyCode: 'NIO',
    modality: 'chat' as const,
  };

  it('muestra los datos del snapshot y el botón de iniciar conversación para chat inmediato', async () => {
    const { getByText, findByText } = await renderWithStackNavigation({
      screens: [
        {
          name: 'AcceptedOffer',
          component: AcceptedOfferScreen,
          initialParams: baseSnapshot,
        },
        {
          name: 'Consultation',
          component: MockConsultationScreen,
        },
      ],
      initialRouteName: 'AcceptedOffer',
    });

    expect(getByText('Dra. Elena Ramos')).toBeTruthy();
    expect(getByText('Psicología Clínica')).toBeTruthy();
    expect(getByText('C$ 650.00')).toBeTruthy();
    expect(getByText('Iniciar conversación ahora')).toBeTruthy();

    await fireEvent.press(getByText('Iniciar conversación ahora'));
    expect(await findByText('Consultation Room Content')).toBeTruthy();
  });

  it('prioriza volver al inicio y deja el chat como coordinación en atención presencial', async () => {
    const { getByText } = await renderWithStackNavigation({
      screens: [
        {
          name: 'AcceptedOffer',
          component: AcceptedOfferScreen,
          initialParams: {
            ...baseSnapshot,
            modality: 'in-person' as const,
          },
        },
      ],
      initialRouteName: 'AcceptedOffer',
    });

    expect(getByText('Atención presencial')).toBeTruthy();
    expect(getByText('Ir al Inicio')).toBeTruthy();
    expect(getByText('Coordinar por chat')).toBeTruthy();
  });

  it('no presenta una sala de espera ficticia para llamada inmediata', async () => {
    const { getByText, queryByText } = await renderWithStackNavigation({
      screens: [
        {
          name: 'AcceptedOffer',
          component: AcceptedOfferScreen,
          initialParams: { ...baseSnapshot, modality: 'call' as const },
        },
      ],
      initialRouteName: 'AcceptedOffer',
    });

    expect(getByText('Ir al Inicio')).toBeTruthy();
    expect(getByText('Coordinar por chat')).toBeTruthy();
    expect(queryByText('Entrar a sala de espera')).toBeNull();
  });
});
