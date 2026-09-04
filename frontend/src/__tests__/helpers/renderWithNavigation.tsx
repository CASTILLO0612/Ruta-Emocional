/**
 * renderWithNavigation — Helper de pruebas con navegadores reales.
 *
 * Sigue la guía oficial de pruebas de React Navigation y RNTL v14.
 * No mockea @react-navigation/native globalmente, sino que renderiza
 * contenedores y navegadores reales para verificar la estructura de rutas.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { View } from 'react-native';
import {
  createNavigatorFactory,
  NavigationContainer,
  StackRouter,
  useNavigationBuilder,
} from '@react-navigation/native';

export interface TestScreenConfig {
  readonly name: string;
  readonly component: React.ComponentType<any>;
  readonly initialParams?: Record<string, any>;
}

export interface RenderWithStackOptions {
  readonly screens: readonly TestScreenConfig[];
  readonly initialRouteName?: string;
}

/** Navegador real y ligero recomendado por React Navigation para pruebas unitarias. */
function TestStackNavigator(props: any) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(StackRouter, props);
  return (
    <NavigationContent>
      {state.routes.map((route, index) => (
        <View key={route.key} aria-hidden={index !== state.index}>
          {descriptors[route.key].render()}
        </View>
      ))}
    </NavigationContent>
  );
}

const createTestStackNavigator = createNavigatorFactory(TestStackNavigator);

export async function renderWithStackNavigation({
  screens,
  initialRouteName,
}: RenderWithStackOptions) {
  const TestStack = createTestStackNavigator();

  return render(
    <NavigationContainer>
      <TestStack.Navigator initialRouteName={initialRouteName}>
        {screens.map(({ name, component, initialParams }) => (
          <TestStack.Screen
            key={name}
            name={name}
            component={component}
            initialParams={initialParams}
          />
        ))}
      </TestStack.Navigator>
    </NavigationContainer>
  );
}

export interface RenderWithTabsOptions {
  readonly tabs: readonly TestScreenConfig[];
  readonly initialRouteName?: string;
}

export async function renderWithTabNavigation({
  tabs,
  initialRouteName,
}: RenderWithTabsOptions) {
  const TestTabs = createTestStackNavigator();

  return render(
    <NavigationContainer>
      <TestTabs.Navigator initialRouteName={initialRouteName}>
        {tabs.map(({ name, component, initialParams }) => (
          <TestTabs.Screen
            key={name}
            name={name}
            component={component}
            initialParams={initialParams}
          />
        ))}
      </TestTabs.Navigator>
    </NavigationContainer>
  );
}
