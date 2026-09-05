import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppHeader } from '../../components/shared/AppHeader';

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 800 },
  insets: { top: 24, right: 0, bottom: 0, left: 0 },
};

function renderHeader(element: React.ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      <NavigationContainer>{element}</NavigationContainer>
    </SafeAreaProvider>
  );
}

describe('AppHeader', () => {
  it('usa el logotipo oficial en cabeceras raíz tituladas', async () => {
    const view = await renderHeader(
      <AppHeader
        title="Pacientes"
        subtitle="Historia clínica privada y versionada"
        showBrandMark
        showMenta
        showInbox
      />
    );

    expect(view.getByTestId('app-header-brand-logo')).toBeOnTheScreen();
  });

  it('evita puntos suspensivos en el título del encabezado', async () => {
    const view = await renderHeader(
      <AppHeader
        title="Pacientes"
        subtitle="Historia clínica privada y versionada"
        showBrandMark
        showMenta
        showInbox
      />
    );

    const title = view.getByText('Pacientes');
    expect(title.props.numberOfLines).toBe(1);
    expect(title.props.ellipsizeMode).toBe('clip');
  });
});
