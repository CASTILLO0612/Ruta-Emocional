import React from 'react';
import {
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  AlternateRoutingStrategy,
  AudioGuidance,
  CameraPerspective,
  MapColorScheme,
  NavigationNightMode,
  NavigationSessionStatus,
  NavigationUIEnabledPreference,
  NavigationView,
  type NavigationViewController,
  RouteStatus,
  RoutingStrategy,
  TravelMode,
  useNavigation as useGoogleNavigation,
} from '@googlemaps/react-native-navigation-sdk';

import { AppButton } from '../../components/common/AppButton';
import { AppHeader } from '../../components/shared/AppHeader';
import { GOOGLE_ROAD_MAP_PRESENTATION } from '../../config/googleMapPresentation';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { openExternalNavigation } from '../../utils/externalNavigation';
import type {
  AppNavigation,
  TurnByTurnNavigationRoute,
} from '../../navigation/navigationTypes';

type NavigationPhase =
  | 'INITIALIZING'
  | 'WAITING_LOCATION'
  | 'CALCULATING'
  | 'PREVIEW'
  | 'NAVIGATING'
  | 'REROUTING'
  | 'ARRIVED'
  | 'ERROR';

const resolveSessionMessage = (status: NavigationSessionStatus) => {
  switch (status) {
    case NavigationSessionStatus.NOT_AUTHORIZED:
      return 'La navegación no está disponible con la configuración actual.';
    case NavigationSessionStatus.TERMS_NOT_ACCEPTED:
      return 'Debes aceptar las condiciones de navegación para continuar.';
    case NavigationSessionStatus.NETWORK_ERROR:
      return 'No pudimos conectarnos para preparar la ruta.';
    case NavigationSessionStatus.LOCATION_PERMISSION_MISSING:
      return 'Necesitamos acceso a tu ubicación para iniciar la ruta.';
    default:
      return 'No pudimos iniciar la navegación. Inténtalo nuevamente.';
  }
};

const resolveRouteMessage = (status: RouteStatus) => {
  switch (status) {
    case RouteStatus.NO_ROUTE_FOUND:
      return 'No encontramos una ruta disponible hasta este destino.';
    case RouteStatus.NETWORK_ERROR:
      return 'No pudimos calcular la ruta por un problema de conexión.';
    case RouteStatus.QUOTA_CHECK_FAILED:
      return 'La navegación no está disponible en este momento.';
    default:
      return 'No pudimos preparar la ruta. Inténtalo nuevamente.';
  }
};

export const PatientNavigationScreen: React.FC = () => {
  const route = useRoute<TurnByTurnNavigationRoute>();
  const navigation = useNavigation<AppNavigation>();
  const destination = route.params.destination;
  const {
    navigationController,
    removeAllListeners,
    setOnArrival,
    setOnLocationChanged,
    setOnReroutingRequestedByOffRoute,
    setOnRouteChanged,
  } = useGoogleNavigation();
  const [phase, setPhase] = React.useState<NavigationPhase>('INITIALIZING');
  const [message, setMessage] = React.useState('Preparando tu ruta segura…');
  const [routeSummary, setRouteSummary] = React.useState<{
    readonly meters: number;
    readonly seconds: number;
  } | null>(null);
  const [nightNavigationEnabled, setNightNavigationEnabled] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const routingStartedRef = React.useRef(false);
  const routeReadyRef = React.useRef(false);
  const guidanceRequestedRef = React.useRef(false);
  const guidanceActiveRef = React.useRef(false);
  const arrivedRef = React.useRef(false);
  const mapReadyRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const skipCleanupOnceRef = React.useRef(false);
  const navigationViewControllerRef = React.useRef<NavigationViewController | null>(null);

  const showRoutePreviewOnMap = React.useCallback(async () => {
    const controller = navigationViewControllerRef.current;
    if (
      !controller ||
      !mapReadyRef.current ||
      !routeReadyRef.current ||
      guidanceRequestedRef.current
    ) return;
    try {
      await controller.setNavigationUIEnabled(false);
      if (
        mountedRef.current &&
        mapReadyRef.current &&
        routeReadyRef.current &&
        !guidanceRequestedRef.current
      ) controller.showRouteOverview();
    } catch {}
  }, []);

  const activateNavigationOnMap = React.useCallback(async () => {
    const controller = navigationViewControllerRef.current;
    if (
      !controller ||
      !mapReadyRef.current ||
      !guidanceActiveRef.current ||
      arrivedRef.current
    ) return;
    try {
      await controller.setNavigationUIEnabled(true);
      if (
        mountedRef.current &&
        mapReadyRef.current &&
        guidanceActiveRef.current &&
        !arrivedRef.current
      ) await controller.setFollowingPerspective(CameraPerspective.TILTED);
    } catch {}
  }, []);

  const stopNavigation = React.useCallback(async () => {
    try {
      removeAllListeners();
    } catch {}
    try {
      await navigationController.stopGuidance();
    } catch {}
    try {
      await navigationController.clearDestinations();
    } catch {}
    try {
      navigationController.stopUpdatingLocation();
    } catch {}
    try {
      await navigationController.cleanup();
    } catch {}
  }, [navigationController, removeAllListeners]);

  const leaveNavigation = React.useCallback(() => {
    void stopNavigation().finally(() => navigation.goBack());
  }, [navigation, stopNavigation]);

  const restartNavigation = React.useCallback(async () => {
    setPhase('INITIALIZING');
    setMessage('Preparando tu ruta segura…');
    setRouteSummary(null);
    setNightNavigationEnabled(false);
    routeReadyRef.current = false;
    guidanceRequestedRef.current = false;
    guidanceActiveRef.current = false;
    arrivedRef.current = false;
    await stopNavigation();
    if (!mountedRef.current) return;
    skipCleanupOnceRef.current = true;
    setAttempt((value) => value + 1);
  }, [stopNavigation]);

  const startGuidance = React.useCallback(async () => {
    if (guidanceRequestedRef.current || phase !== 'PREVIEW') return;
    guidanceRequestedRef.current = true;
    setPhase('CALCULATING');
    setMessage('Iniciando navegación…');

    try {
      navigationController.setAudioGuidanceType(
        AudioGuidance.VOICE_ALERTS_AND_GUIDANCE |
          AudioGuidance.VIBRATION |
          AudioGuidance.BLUETOOTH_AUDIO
      );
      await navigationController.startGuidance();
      guidanceActiveRef.current = !arrivedRef.current;
      if (mountedRef.current) {
        setNightNavigationEnabled(true);
        if (!arrivedRef.current) {
          setPhase('NAVIGATING');
          setMessage('Navegación activa');
        }
      }
    } catch {
      guidanceRequestedRef.current = false;
      guidanceActiveRef.current = false;
      setNightNavigationEnabled(false);
      if (mountedRef.current) {
        setPhase('ERROR');
        setMessage('No pudimos iniciar la guía. Inténtalo nuevamente.');
      }
    }
  }, [navigationController, phase]);

  React.useEffect(() => {
    mountedRef.current = true;
    routingStartedRef.current = false;
    routeReadyRef.current = false;
    guidanceRequestedRef.current = false;
    guidanceActiveRef.current = false;
    arrivedRef.current = false;
    setNightNavigationEnabled(false);
    let locationTimeout: ReturnType<typeof setTimeout> | undefined;

    const presentRoutePreview = async () => {
      if (
        !mountedRef.current ||
        !routeReadyRef.current ||
        guidanceRequestedRef.current
      ) return;

      await showRoutePreviewOnMap();
      try {
        const summary = await navigationController.getCurrentTimeAndDistance();
        if (!mountedRef.current || guidanceRequestedRef.current) return;
        setRouteSummary(
          summary?.meters > 0 && summary.seconds > 0
            ? { meters: summary.meters, seconds: summary.seconds }
            : null
        );
      } catch {
        if (!mountedRef.current || guidanceRequestedRef.current) return;
        setRouteSummary(null);
      }

      if (!mountedRef.current || guidanceRequestedRef.current) return;
      setPhase('PREVIEW');
      setMessage('Ruta lista');
    };

    const calculateRoute = async () => {
      if (routingStartedRef.current || !mountedRef.current) return;
      routingStartedRef.current = true;
      if (locationTimeout) clearTimeout(locationTimeout);
      setPhase('CALCULATING');
      setMessage('Calculando la mejor ruta…');

      try {
        const status = await navigationController.setDestination(
          {
            title: destination.name,
            position: {
              lat: destination.latitude,
              lng: destination.longitude,
            },
          },
          {
            routingOptions: {
              travelMode: TravelMode.DRIVING,
              routingStrategy: RoutingStrategy.DEFAULT_BEST,
              alternateRoutesStrategy: AlternateRoutingStrategy.SHOW_ALL,
              avoidFerries: false,
              avoidHighways: false,
              avoidTolls: false,
            },
            displayOptions: { showDestinationMarkers: true },
          }
        );

        if (!mountedRef.current) return;
        if (status !== RouteStatus.OK) {
          routeReadyRef.current = false;
          setPhase('ERROR');
          setMessage(resolveRouteMessage(status));
          return;
        }

        routeReadyRef.current = true;
        await presentRoutePreview();
      } catch {
        if (mountedRef.current) {
          routeReadyRef.current = false;
          setPhase('ERROR');
          setMessage('No pudimos preparar la ruta. Inténtalo nuevamente.');
        }
      }
    };

    setOnLocationChanged(() => {
      void calculateRoute();
    });
    setOnArrival(() => {
      if (!mountedRef.current) return;
      arrivedRef.current = true;
      guidanceActiveRef.current = false;
      setNightNavigationEnabled(true);
      setPhase('ARRIVED');
      setMessage('Llegaste a tu destino');
      void navigationViewControllerRef.current?.setFollowingPerspective(
        CameraPerspective.TOP_DOWN_NORTH_UP,
        { zoomLevel: 17 }
      );
      void navigationController.stopGuidance();
    });
    setOnReroutingRequestedByOffRoute(() => {
      if (
        !mountedRef.current ||
        !guidanceActiveRef.current ||
        arrivedRef.current
      ) return;
      setPhase('REROUTING');
      setMessage('Actualizando la ruta…');
    });
    setOnRouteChanged(() => {
      if (
        mountedRef.current &&
        routeReadyRef.current &&
        !guidanceRequestedRef.current
      ) {
        void presentRoutePreview();
        return;
      }
      if (
        !mountedRef.current ||
        !guidanceActiveRef.current ||
        arrivedRef.current
      ) return;
      setPhase('NAVIGATING');
      setMessage('Navegación activa');
    });

    const initialize = async () => {
      setPhase('INITIALIZING');
      setMessage('Preparando tu ruta segura…');

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        if (mountedRef.current) {
          setPhase('ERROR');
          setMessage('Activa el acceso a tu ubicación para iniciar la ruta.');
        }
        return;
      }

      const termsAccepted = await navigationController.showTermsAndConditionsDialog();
      if (!termsAccepted) {
        if (mountedRef.current) {
          setPhase('ERROR');
          setMessage('Debes aceptar las condiciones de navegación para continuar.');
        }
        return;
      }

      const status = await navigationController.init();
      if (!mountedRef.current) return;
      if (status !== NavigationSessionStatus.OK) {
        setPhase('ERROR');
        setMessage(resolveSessionMessage(status));
        return;
      }

      setPhase('WAITING_LOCATION');
      setMessage('Ubicando tu posición…');
      navigationController.startUpdatingLocation();
      locationTimeout = setTimeout(() => {
        if (!mountedRef.current || routingStartedRef.current) return;
        routingStartedRef.current = true;
        setPhase('ERROR');
        setMessage('No pudimos obtener tu ubicación. Verifica que el GPS esté activo.');
        try {
          navigationController.stopUpdatingLocation();
        } catch {}
      }, 15000);
    };

    void initialize().catch(() => {
      if (mountedRef.current) {
        setPhase('ERROR');
        setMessage('No pudimos iniciar la navegación. Inténtalo nuevamente.');
      }
    });

    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        leaveNavigation();
        return true;
      }
    );

    return () => {
      mountedRef.current = false;
      if (locationTimeout) clearTimeout(locationTimeout);
      backSubscription.remove();
      if (skipCleanupOnceRef.current) {
        skipCleanupOnceRef.current = false;
      } else {
        void stopNavigation();
      }
    };
  }, [
    attempt,
    destination.latitude,
    destination.longitude,
    destination.name,
    leaveNavigation,
    navigationController,
    setOnArrival,
    setOnLocationChanged,
    setOnReroutingRequestedByOffRoute,
    setOnRouteChanged,
    showRoutePreviewOnMap,
    stopNavigation,
  ]);

  React.useEffect(() => {
    if (phase === 'PREVIEW') {
      void showRoutePreviewOnMap();
    }
  }, [phase, showRoutePreviewOnMap]);

  React.useEffect(() => {
    if (!nightNavigationEnabled || !guidanceActiveRef.current) return;
    void activateNavigationOnMap();
  }, [activateNavigationOnMap, nightNavigationEnabled]);

  const openWaze = async () => {
    try {
      await openExternalNavigation('WAZE', destination);
    } catch {
      setPhase('ERROR');
      setMessage('No pudimos abrir Waze en este dispositivo.');
    }
  };

  const isBusy = ['INITIALIZING', 'WAITING_LOCATION', 'CALCULATING'].includes(phase);
  const navigationUiEnabled = phase === 'NAVIGATING' || phase === 'REROUTING';

  const formatDuration = (seconds: number) => {
    const minutes = Math.max(1, Math.round(seconds / 60));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    const kilometers = meters / 1000;
    return `${kilometers.toLocaleString('es-NI', {
      maximumFractionDigits: kilometers < 10 ? 1 : 0,
    })} km`;
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Cómo llegar" showBack onBack={leaveNavigation} />
      <View style={styles.mapContainer}>
        <NavigationView
          {...GOOGLE_ROAD_MAP_PRESENTATION}
          style={StyleSheet.absoluteFill}
          mapColorScheme={
            nightNavigationEnabled
              ? MapColorScheme.DARK
              : MapColorScheme.LIGHT
          }
          navigationNightMode={
            nightNavigationEnabled
              ? NavigationNightMode.FORCE_NIGHT
              : NavigationNightMode.FORCE_DAY
          }
          navigationUIEnabledPreference={NavigationUIEnabledPreference.DISABLED}
          compassEnabled={false}
          scrollGesturesEnabled
          scrollGesturesDuringRotateOrZoomEnabled
          rotateGesturesEnabled
          tiltGesturesEnabled
          zoomGesturesEnabled
          myLocationEnabled
          myLocationButtonEnabled={phase === 'PREVIEW'}
          tripProgressBarEnabled={navigationUiEnabled}
          trafficPromptsEnabled={navigationUiEnabled}
          trafficIncidentCardsEnabled={navigationUiEnabled}
          headerEnabled={navigationUiEnabled}
          footerEnabled={navigationUiEnabled}
          speedometerEnabled={false}
          speedLimitIconEnabled={navigationUiEnabled}
          recenterButtonEnabled={navigationUiEnabled}
          reportIncidentButtonEnabled={false}
          onMapReady={() => {
            mapReadyRef.current = true;
            if (guidanceActiveRef.current) {
              void activateNavigationOnMap();
            } else {
              void showRoutePreviewOnMap();
            }
          }}
          onNavigationViewControllerCreated={(controller) => {
            navigationViewControllerRef.current = controller;
            if (guidanceActiveRef.current) {
              void activateNavigationOnMap();
            } else {
              void showRoutePreviewOnMap();
            }
          }}
          androidStylingOptions={{
            primaryDayModeThemeColor: Colors.primary,
            secondaryDayModeThemeColor: Colors.primaryLight,
            primaryNightModeThemeColor: Colors.primaryDark,
            secondaryNightModeThemeColor: Colors.primary,
            headerLargeManeuverIconColor: Colors.textInverse,
            headerSmallManeuverIconColor: Colors.textInverse,
            headerNextStepTextColor: Colors.textInverse,
            headerInstructionsTextColor: Colors.textInverse,
            headerDistanceValueTextColor: Colors.textInverse,
            headerDistanceUnitsTextColor: Colors.textInverse,
          }}
        />

        {(isBusy || phase === 'REROUTING') && (
          <View
            style={styles.statusPill}
            pointerEvents="none"
            accessibilityLiveRegion="polite"
          >
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.statusText}>{message}</Text>
          </View>
        )}

        {phase === 'PREVIEW' && (
          <View style={styles.messagePanel} accessibilityLiveRegion="polite">
            <Text style={styles.routeMode}>Ruta en automóvil</Text>
            <Text style={styles.messageTitle}>{destination.name}</Text>
            {routeSummary ? (
              <Text style={styles.routeMetrics}>
                {formatDuration(routeSummary.seconds)} · {formatDistance(routeSummary.meters)}
              </Text>
            ) : null}
            {destination.address !== destination.name ? (
              <Text style={styles.messageBody} numberOfLines={2}>
                {destination.address}
              </Text>
            ) : null}
            <AppButton
              label="Iniciar navegación"
              onPress={() => void startGuidance()}
              variant="primary"
              fullWidth
            />
          </View>
        )}

        {phase === 'ERROR' && (
          <View style={styles.messagePanel} accessibilityLiveRegion="assertive">
            <Text style={styles.messageTitle}>No pudimos iniciar la ruta</Text>
            <Text style={styles.messageBody}>{message}</Text>
            <View style={styles.actions}>
              <AppButton
                label="Intentar de nuevo"
                onPress={() => void restartNavigation()}
                variant="primary"
                fullWidth
              />
              <AppButton
                label="Abrir en Waze"
                onPress={() => void openWaze()}
                variant="outline"
                fullWidth
              />
            </View>
          </View>
        )}

        {phase === 'ARRIVED' && (
          <View style={styles.messagePanel} accessibilityLiveRegion="polite">
            <Text style={styles.messageTitle}>Llegaste a tu destino</Text>
            <Text style={styles.messageBody}>{destination.name}</Text>
            <AppButton
              label="Volver a la cita"
              onPress={leaveNavigation}
              variant="primary"
              fullWidth
            />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mapContainer: {
    flex: 1,
  },
  statusPill: {
    position: 'absolute',
    top: Spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: 999,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  statusText: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
  },
  messagePanel: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
    bottom: Spacing.xl,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  messageTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  routeMode: {
    ...Typography.label,
    color: Colors.primary,
  },
  routeMetrics: {
    ...Typography.h4,
    color: Colors.success,
  },
  messageBody: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  actions: {
    gap: Spacing.xs,
  },
});
