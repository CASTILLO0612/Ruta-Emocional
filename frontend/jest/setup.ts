import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-worklets', () =>
  require('react-native-worklets/src/mock')
);

require('react-native-reanimated').setUpTests();

jest.mock('@expo/dom-webview', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    WebView: (props: Record<string, unknown>) => React.createElement(View, props),
  };
});

jest.mock('@googlemaps/react-native-navigation-sdk', () => {
  const React = require('react');
  const { View } = require('react-native');
  const navigationController = {
    showTermsAndConditionsDialog: jest.fn(async () => true),
    init: jest.fn(async () => 'ok'),
    cleanup: jest.fn(async () => undefined),
    setDestination: jest.fn(async () => 'OK'),
    getCurrentTimeAndDistance: jest.fn(async () => ({
      delaySeverity: 0,
      meters: 3100,
      seconds: 480,
    })),
    startGuidance: jest.fn(async () => undefined),
    stopGuidance: jest.fn(async () => undefined),
    clearDestinations: jest.fn(async () => undefined),
    startUpdatingLocation: jest.fn(),
    stopUpdatingLocation: jest.fn(),
    setAudioGuidanceType: jest.fn(),
  };

  return {
    NavigationProvider: ({ children }: { children: React.ReactNode }) => children,
    NavigationView: (props: Record<string, unknown>) => React.createElement(
      View,
      { testID: 'navigation-view', ...props }
    ),
    MapView: (props: Record<string, unknown>) => React.createElement(View, props),
    useNavigation: jest.fn(() => ({
      navigationController,
      removeAllListeners: jest.fn(),
      setOnArrival: jest.fn(),
      setOnLocationChanged: jest.fn(),
      setOnReroutingRequestedByOffRoute: jest.fn(),
      setOnRouteChanged: jest.fn(),
    })),
    AlternateRoutingStrategy: { SHOW_ALL: 0, SHOW_NONE: 1, SHOW_ONE: 2 },
    AudioGuidance: {
      VIBRATION: 1,
      VOICE_ALERTS_AND_GUIDANCE: 4,
      BLUETOOTH_AUDIO: 8,
    },
    MapColorScheme: { FOLLOW_SYSTEM: 0, LIGHT: 1, DARK: 2 },
    CameraPerspective: {
      TILTED: 0,
      TOP_DOWN_NORTH_UP: 1,
      TOP_DOWN_HEADING_UP: 2,
    },
    NavigationNightMode: { AUTO: 0, FORCE_DAY: 1, FORCE_NIGHT: 2 },
    NavigationUIEnabledPreference: { AUTOMATIC: 0, DISABLED: 1 },
    NavigationSessionStatus: {
      OK: 'ok',
      NOT_AUTHORIZED: 'notAuthorized',
      TERMS_NOT_ACCEPTED: 'termsNotAccepted',
      NETWORK_ERROR: 'networkError',
      LOCATION_PERMISSION_MISSING: 'locationPermissionMissing',
      UNKNOWN_ERROR: 'unknownError',
    },
    RouteStatus: {
      OK: 'OK',
      NO_ROUTE_FOUND: 'NO_ROUTE_FOUND',
      NETWORK_ERROR: 'NETWORK_ERROR',
      QUOTA_CHECK_FAILED: 'QUOTA_CHECK_FAILED',
    },
    RoutingStrategy: { DEFAULT_BEST: 0 },
    TaskRemovedBehavior: { QUIT_SERVICE: 1 },
    TravelMode: { DRIVING: 0 },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const inset = { top: 44, right: 0, bottom: 34, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  const SafeAreaInsetsContext = React.createContext(inset);
  const SafeAreaFrameContext = React.createContext(frame);

  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaConsumer: SafeAreaInsetsContext.Consumer,
    SafeAreaInsetsContext,
    SafeAreaFrameContext,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets: inset, frame },
  };
});
