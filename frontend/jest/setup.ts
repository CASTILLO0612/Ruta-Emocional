/**
 * Jest setup — fronteras nativas mínimas.
 *
 * Reglas:
 * - Se mockean únicamente módulos con implementaciones nativas que Jest no puede ejecutar.
 * - React Navigation NO se mockea globalmente; las pruebas usan renderWithNavigation.
 * - Zustand NO se mockea; los stores se usan reales o con estado inicial controlado.
 * - Las funciones puras no se mockean nunca.
 */

// 1. Gesture Handler — setup oficial de RNGH
import 'react-native-gesture-handler/jestSetup';

// 2. Worklets — mock oficial de react-native-worklets 0.10.x
jest.mock('react-native-worklets', () =>
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('react-native-worklets/src/mock')
);

// 3. Reanimated — setup oficial para Reanimated 4.x
// Debe ejecutarse después del mock de worklets
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('react-native-reanimated').setUpTests();

// 4. Safe Area — insets estáticos controlados y contextos para React Navigation
jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
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
