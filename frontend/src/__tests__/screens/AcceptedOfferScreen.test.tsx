import React from 'react';
import { act, fireEvent } from '@testing-library/react-native';
import { AcceptedOfferScreen } from '../../screens/patient/AcceptedOfferScreen';
import { renderWithStackNavigation } from '../helpers/renderWithNavigation';
import { Text, TouchableOpacity, View } from 'react-native';

const MockConsultationScreen = () => (
  <View>
    <Text>Consultation Room Content</Text>
  </View>
);

const MockPatientHomeScreen = () => (
  <View>
    <Text>Inicio del paciente</Text>
  </View>
);

const MockNavigationScreen = ({
  navigation,
}: {
  navigation: { goBack: () => void };
}) => (
  <View>
    <Text>Navegación interna activa</Text>
    <TouchableOpacity onPress={navigation.goBack}>
      <Text>Volver a confirmación</Text>
    </TouchableOpacity>
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

  it('prioriza coordinar la ubicación cuando el consultorio aún no está configurado', async () => {
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
    expect(getByText('Coordinar ubicación')).toBeTruthy();
    expect(getByText('Volver al inicio')).toBeTruthy();
  });

  it('muestra el destino y opciones de navegación para atención presencial', async () => {
    const { getByLabelText, getByText, findByText } = await renderWithStackNavigation({
      screens: [
        {
          name: 'AcceptedOffer',
          component: AcceptedOfferScreen,
          initialParams: {
            ...baseSnapshot,
            modality: 'in-person' as const,
            inPersonDestination: {
              name: 'Consultorio Central',
              address: 'Avenida principal, Managua',
              directions: 'Segundo piso',
              latitude: 12.114,
              longitude: -86.236,
            },
          },
        },
        {
          name: 'PatientMain',
          component: MockPatientHomeScreen,
        },
        {
          name: 'TurnByTurnNavigation',
          component: MockNavigationScreen,
        },
      ],
      initialRouteName: 'AcceptedOffer',
    });

    expect(getByText('Consultorio Central')).toBeTruthy();
    expect(getByText('Avenida principal, Managua')).toBeTruthy();
    expect(getByText('Segundo piso')).toBeTruthy();
    expect(getByText('Cómo llegar')).toBeTruthy();
    expect(getByText('Abrir en Waze')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Cómo llegar'));
    });
    expect(await findByText('Navegación interna activa')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Volver a confirmación'));
    });

    await act(async () => {
      fireEvent.press(getByLabelText('Volver atrás'));
    });
    expect(await findByText('Inicio del paciente')).toBeTruthy();
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

    expect(getByText('Coordinar llamada')).toBeTruthy();
    expect(getByText('Coordinar detalles')).toBeTruthy();
    expect(queryByText('Entrar a sala de espera')).toBeNull();
  });
});
