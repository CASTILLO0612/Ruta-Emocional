import React from 'react';
import { SearchTabScreen } from '../../screens/patient/SearchTabScreen';
import { useRequestStore } from '../../store/useRequestStore';
import { renderWithStackNavigation } from '../helpers/renderWithNavigation';
import { Text, View } from 'react-native';
import { act, fireEvent } from '@testing-library/react-native';
import * as RequestRepository from '../../repositories/RequestRepository';

const MockRadarScreen = () => (
  <View>
    <Text>Radar Screen Content</Text>
  </View>
);

describe('SearchTabScreen', () => {
  beforeEach(() => {
    jest.spyOn(RequestRepository, 'getServiceRequestPolicy').mockResolvedValue({
      minimumAmount: '100',
      maximumAmount: '10000',
      supportedCurrencies: ['NIO'],
      immediateTtlMinutes: 30,
      scheduledLeadMinutes: 60,
      maximumScheduleDays: 30,
      maximumDescriptionLength: 500,
      maximumPrimaryNeedLength: 160,
      maximumOfferMessageLength: 500,
    });
    useRequestStore.setState({
      activeRequest: null,
      activeRequestId: null,
      incomingOffers: [],
      isSearching: false,
      error: null,
    });
  });

  it('renderiza RequestWizardScreen cuando no hay solicitud activa', async () => {
    const { getByLabelText, getByText, queryByText } = await renderWithStackNavigation({
      screens: [
        { name: 'Search', component: SearchTabScreen },
      ],
      initialRouteName: 'Search',
    });

    expect(getByText('¿Cómo podemos ayudarte?')).toBeTruthy();
    expect(getByText('Añadir contexto')).toBeTruthy();
    expect(queryByText('Ansiedad y estrés')).toBeNull();
    expect(queryByText('Depresión y tristeza')).toBeNull();

    await act(async () => {
      fireEvent.press(getByLabelText('Añadir contexto'));
    });
    expect(getByLabelText('Contexto de la solicitud')).toBeTruthy();
  });

  it('solicita únicamente el monto manual en el paso de presupuesto', async () => {
    const { findByText, getByLabelText, getByText, queryByText } =
      await renderWithStackNavigation({
        screens: [{ name: 'Search', component: SearchTabScreen }],
        initialRouteName: 'Search',
      });

    await act(async () => {
      fireEvent.press(getByLabelText('Añadir contexto'));
    });
    await act(async () => {
      fireEvent.changeText(
        getByLabelText('Contexto de la solicitud'),
        'Necesito apoyo para manejar el estrés.'
      );
    });
    await act(async () => {
      fireEvent.press(getByText('Continuar'));
    });
    expect(await findByText('¿Cómo deseas recibir tu sesión?')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Continuar'));
    });
    expect(await findByText('¿Cuándo necesitas la atención?')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Continuar'));
    });
    expect(await findByText('¿Cuál es tu presupuesto sugerido?')).toBeTruthy();
    expect(getByLabelText('Monto del presupuesto')).toBeTruthy();
    expect(queryByText('MONTOS SUGERIDOS')).toBeNull();
  });

  it('abre el Radar directamente cuando existe una solicitud pendiente', async () => {
    useRequestStore.setState({
      activeRequest: {
        id: 'req-123',
        modality: 'chat',
        primaryNeed: 'Manejo de ansiedad',
        proposedBudget: 500,
        currencyCode: 'NIO',
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      },
      activeRequestId: 'req-123',
      isSearching: true,
      incomingOffers: [],
    });

    const { findByText, queryByText } = await renderWithStackNavigation({
      screens: [
        { name: 'Search', component: SearchTabScreen },
        { name: 'Radar', component: MockRadarScreen },
      ],
      initialRouteName: 'Search',
    });

    expect(await findByText('Radar Screen Content')).toBeTruthy();
    expect(queryByText('Búsqueda en curso')).toBeNull();
    expect(queryByText('¿Cómo podemos ayudarte?')).toBeNull();
  });

  it('abre el Radar directamente cuando ya hay ofertas', async () => {
    useRequestStore.setState({
      activeRequest: {
        id: 'req-123',
        modality: 'call',
        primaryNeed: 'Estrés laboral',
        proposedBudget: 600,
        currencyCode: 'NIO',
        status: 'bidding',
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      },
      activeRequestId: 'req-123',
      isSearching: true,
      incomingOffers: [
        {
          id: 'off-1',
          requestId: 'req-123',
          psychologistId: 'psy-1',
          psychologistName: 'Dra. María González',
          psychologistRating: 4.9,
          amount: 600,
          currencyCode: 'NIO',
          status: 'pending',
          createdAt: new Date(),
        },
      ],
    });

    const { findByText, queryByText } = await renderWithStackNavigation({
      screens: [
        { name: 'Search', component: SearchTabScreen },
        { name: 'Radar', component: MockRadarScreen },
      ],
      initialRouteName: 'Search',
    });

    expect(await findByText('Radar Screen Content')).toBeTruthy();
    expect(queryByText('Ver ofertas (1)')).toBeNull();
  });
});
