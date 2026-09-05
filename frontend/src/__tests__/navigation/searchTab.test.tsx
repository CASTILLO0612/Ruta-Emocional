import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { SearchTabScreen } from '../../screens/patient/SearchTabScreen';
import { useRequestStore } from '../../store/useRequestStore';
import { renderWithStackNavigation } from '../helpers/renderWithNavigation';
import { Text, View } from 'react-native';

const MockRadarScreen = () => (
  <View>
    <Text>Radar Screen Content</Text>
  </View>
);

describe('SearchTabScreen', () => {
  beforeEach(() => {
    useRequestStore.setState({
      activeRequest: null,
      activeRequestId: null,
      incomingOffers: [],
      isSearching: false,
      error: null,
    });
  });

  it('renderiza RequestWizardScreen cuando no hay solicitud activa', async () => {
    const { getByText } = await renderWithStackNavigation({
      screens: [
        { name: 'Search', component: SearchTabScreen },
      ],
      initialRouteName: 'Search',
    });

    expect(getByText('¿Cómo podemos ayudarte?')).toBeTruthy();
  });

  it('renderiza ActiveSearchSummary cuando la solicitud está en estado pending', async () => {
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

    const { getByText, queryByText } = await renderWithStackNavigation({
      screens: [
        { name: 'Search', component: SearchTabScreen },
        { name: 'Radar', component: MockRadarScreen },
      ],
      initialRouteName: 'Search',
    });

    expect(getByText('Búsqueda en curso')).toBeTruthy();
    expect(getByText('Manejo de ansiedad')).toBeTruthy();
    expect(queryByText('¿Cómo podemos ayudarte?')).toBeNull();
  });

  it('navega hacia Radar al presionar el botón de ver búsqueda', async () => {
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

    const { getByText, findByText } = await renderWithStackNavigation({
      screens: [
        { name: 'Search', component: SearchTabScreen },
        { name: 'Radar', component: MockRadarScreen },
      ],
      initialRouteName: 'Search',
    });

    expect(getByText('1 oferta(s) esperando tu decisión')).toBeTruthy();

    const openRadarButton = getByText('Ver ofertas (1)');
    await fireEvent.press(openRadarButton);

    expect(await findByText('Radar Screen Content')).toBeTruthy();
  });
});
