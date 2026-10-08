import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import {
  AlternateRoutingStrategy,
  MapColorScheme,
  NavigationNightMode,
  NavigationUIEnabledPreference,
  RouteStatus,
  useNavigation as useGoogleNavigation,
} from '@googlemaps/react-native-navigation-sdk';
import {
  useNavigation,
  useRoute,
} from '@react-navigation/native';

import { PatientNavigationScreen } from '../../screens/patient/PatientNavigationScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));

jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted' },
  requestForegroundPermissionsAsync: jest.fn(),
}));

const mockedUseNavigation = jest.mocked(useNavigation);
const mockedUseRoute = jest.mocked(useRoute);
const mockedUseGoogleNavigation = jest.mocked(useGoogleNavigation);
const mockedRequestPermission = jest.mocked(
  Location.requestForegroundPermissionsAsync
);

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const containsMapProp = (
  value: unknown,
  property: string,
  expected: unknown
): boolean => {
  if (!value || typeof value !== 'object') return false;
  const node = value as {
    readonly props?: Record<string, unknown>;
    readonly children?: readonly unknown[];
  };
  if (node.props?.[property] === expected) return true;
  return node.children?.some((child) => (
    containsMapProp(child, property, expected)
  )) ?? false;
};

describe('PatientNavigationScreen', () => {
  it('activa el modo nocturno al terminar de iniciar la guía y lo conserva al llegar', async () => {
    const startGuidance = deferred();
    const navigationViewController = {
      showRouteOverview: jest.fn(),
      setFollowingPerspective: jest.fn(async () => undefined),
      setNavigationUIEnabled: jest.fn(async () => undefined),
    };
    let onLocationChanged: (() => void) | null = null;
    let onArrival: (() => void) | null = null;
    const navigationController = {
      showTermsAndConditionsDialog: jest.fn(async () => true),
      init: jest.fn(async () => 'ok'),
      cleanup: jest.fn(async () => undefined),
      setDestination: jest.fn(async () => RouteStatus.OK),
      getCurrentTimeAndDistance: jest.fn(async () => ({
        delaySeverity: 0,
        meters: 3100,
        seconds: 480,
      })),
      startGuidance: jest.fn(() => startGuidance.promise),
      stopGuidance: jest.fn(async () => undefined),
      clearDestinations: jest.fn(async () => undefined),
      startUpdatingLocation: jest.fn(),
      stopUpdatingLocation: jest.fn(),
      setAudioGuidanceType: jest.fn(),
    };

    mockedUseNavigation.mockReturnValue({
      goBack: jest.fn(),
    } as never);
    mockedUseRoute.mockReturnValue({
      params: {
        destination: {
          name: 'Consultorio Ruta Emocional',
          address: 'Avenida 2, Granada',
          directions: null,
          latitude: 11.9299,
          longitude: -85.956,
        },
      },
    } as never);
    mockedRequestPermission.mockResolvedValue({ status: 'granted' } as never);
    mockedUseGoogleNavigation.mockReturnValue({
      navigationController,
      removeAllListeners: jest.fn(),
      setOnArrival: jest.fn((callback) => {
        onArrival = callback as () => void;
      }),
      setOnLocationChanged: jest.fn((callback) => {
        onLocationChanged = callback as () => void;
      }),
      setOnReroutingRequestedByOffRoute: jest.fn(),
      setOnRouteChanged: jest.fn(),
    } as never);

    const view = await render(<PatientNavigationScreen />);

    await act(async () => {
      view.getByTestId('navigation-view').props.onNavigationViewControllerCreated(
        navigationViewController
      );
    });
    expect(navigationViewController.setNavigationUIEnabled).not.toHaveBeenCalled();

    await act(async () => {
      view.getByTestId('navigation-view').props.onMapReady();
    });

    await waitFor(() => expect(onLocationChanged).not.toBeNull());
    await act(async () => onLocationChanged?.());
    await waitFor(() => expect(view.getByText('Iniciar navegación')).toBeTruthy());
    expect(navigationController.setDestination).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        routingOptions: expect.objectContaining({
          alternateRoutesStrategy: AlternateRoutingStrategy.SHOW_ALL,
        }),
      })
    );
    expect(navigationViewController.showRouteOverview).toHaveBeenCalled();
    expect(navigationViewController.setNavigationUIEnabled).toHaveBeenCalledWith(false);
    const startButton = view.getByText('Iniciar navegación');
    const mapUsesMode = (navigationNightMode: NavigationNightMode) => (
      containsMapProp(view.toJSON(), 'navigationNightMode', navigationNightMode)
    );

    expect(mapUsesMode(NavigationNightMode.FORCE_DAY)).toBe(true);
    expect(containsMapProp(
      view.toJSON(),
      'mapColorScheme',
      MapColorScheme.LIGHT
    )).toBe(true);
    expect(containsMapProp(
      view.toJSON(),
      'navigationUIEnabledPreference',
      NavigationUIEnabledPreference.DISABLED
    )).toBe(true);
    expect(containsMapProp(view.toJSON(), 'scrollGesturesEnabled', true)).toBe(true);
    expect(containsMapProp(
      view.toJSON(),
      'scrollGesturesDuringRotateOrZoomEnabled',
      true
    )).toBe(true);
    expect(containsMapProp(view.toJSON(), 'rotateGesturesEnabled', true)).toBe(true);
    expect(containsMapProp(view.toJSON(), 'tiltGesturesEnabled', true)).toBe(true);
    expect(containsMapProp(view.toJSON(), 'zoomGesturesEnabled', true)).toBe(true);
    await fireEvent.press(startButton);
    await waitFor(() => expect(navigationController.startGuidance).toHaveBeenCalledTimes(1));
    expect(mapUsesMode(NavigationNightMode.FORCE_DAY)).toBe(true);

    await act(async () => startGuidance.resolve());
    await waitFor(() => {
      expect(mapUsesMode(NavigationNightMode.FORCE_NIGHT)).toBe(true);
    });
    await waitFor(() => {
      expect(navigationViewController.setNavigationUIEnabled).toHaveBeenCalledWith(true);
      expect(navigationViewController.setFollowingPerspective).toHaveBeenCalledWith(
        expect.any(Number)
      );
    });
    expect(containsMapProp(
      view.toJSON(),
      'mapColorScheme',
      MapColorScheme.DARK
    )).toBe(true);

    await act(async () => onArrival?.());
    await waitFor(() => expect(view.getByText('Llegaste a tu destino')).toBeTruthy());
    expect(mapUsesMode(NavigationNightMode.FORCE_NIGHT)).toBe(true);

    await view.unmount();
  });
});
