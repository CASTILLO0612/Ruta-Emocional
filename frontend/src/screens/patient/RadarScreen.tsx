import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView from '../../components/common/CustomMapView';
import {
  ChevronUp,
  CircleAlert,
  MapPin,
  MessageCircle,
  Phone,
  WalletCards,
  X,
} from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetFlatList,
} from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';

import { Colors } from '../../theme/colors';
import { FontFamily, Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { OfferCard } from '../../components/patient/OfferCard';
import { Offer } from '../../models/Offer';
import { useRequestStore } from '../../store/useRequestStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getNearbyPsychologists } from '../../repositories/PsychologistRepository';
import { getDirectoryMapConfig } from '../../config/runtimeConfig';
import { CustomAlert } from '../../components/common/CustomAlert';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { OfferComparisonSheet } from '../../components/shared/OfferComparisonSheet';
import type {
  AppNavigation,
  AcceptedOfferSummaryParams,
} from '../../navigation/navigationTypes';
import { showAlert } from '../../utils/alert';
import { presentUserError } from '../../utils/userFacingError';
import { formatMoney } from '../../utils/money';

const RadarScreenContent: React.FC = () => {
  const navigation = useNavigation<AppNavigation>();
  const userProfile = useAuthStore((state) => state.userProfile);

  const {
    activeRequest,
    activeRequestId,
    incomingOffers,
    startListeningToOffers,
    acceptIncomingOffer,
    cancelSearch,
    error,
    clearError,
  } = useRequestStore();

  const [nearbyPsychologistCount, setNearbyPsychologistCount] = useState(0);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoadTimedOut, setMapLoadTimedOut] = useState(false);

  const [cancelAlertVisible, setCancelAlertVisible] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [acceptingOfferId, setAcceptingOfferId] = useState<string | null>(null);

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const mapConfig = React.useMemo(() => getDirectoryMapConfig(), []);

  useEffect(() => {
    setMapReady(false);
    setMapLoadTimedOut(false);
  }, [activeRequest?.id]);

  useFocusEffect(
    React.useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        setCancelAlertVisible(true);
        return true;
      });
      return () => subscription.remove();
    }, [])
  );

  useEffect(() => {
    if (!activeRequest) {
      setUserLocation(null);
      setLocationPermissionDenied(false);
      setLocationPermissionGranted(false);
      setNearbyPsychologistCount(0);
      return;
    }

    let isMounted = true;
    const requestLocation = async () => {
      try {
        const existingPermission = await Location.getForegroundPermissionsAsync();
        const { status } = existingPermission.status === 'granted'
          ? existingPermission
          : await Location.requestForegroundPermissionsAsync();
        if (!isMounted) return;
        if (status !== 'granted') {
          setLocationPermissionDenied(true);
          setLocationPermissionGranted(false);
          return;
        }
        setLocationPermissionDenied(false);
        setLocationPermissionGranted(true);

        const lastKnownLocation = await Location.getLastKnownPositionAsync({
          maxAge: 5 * 60 * 1000,
          requiredAccuracy: 2_000,
        });
        if (isMounted && lastKnownLocation) {
          setUserLocation({
            latitude: lastKnownLocation.coords.latitude,
            longitude: lastKnownLocation.coords.longitude,
          });
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!isMounted) return;
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch {
        if (isMounted) setLocationPermissionGranted(false);
      }
    };

    void requestLocation();
    return () => {
      isMounted = false;
    };
  }, [activeRequest?.id]);

  useEffect(() => {
    if (!userLocation || activeRequest?.modality !== 'in-person') return;
    const controller = new AbortController();
    void getNearbyPsychologists(
      userLocation.latitude,
      userLocation.longitude,
      mapConfig.radiusKm,
      controller.signal
    )
      .then((profiles) => setNearbyPsychologistCount(profiles.length))
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setNearbyPsychologistCount(0);
      });
    return () => controller.abort();
  }, [userLocation, activeRequest?.modality, mapConfig.radiusKm]);

  useEffect(() => {
    if (!activeRequest || mapReady) {
      setMapLoadTimedOut(false);
      return;
    }

    const timeout = setTimeout(() => setMapLoadTimedOut(true), 8_000);
    return () => clearTimeout(timeout);
  }, [activeRequest?.id, mapReady]);

  useEffect(() => {
    const currentId = activeRequestId || activeRequest?.id;
    if (currentId) {
      startListeningToOffers(currentId);
    }
  }, [activeRequestId, activeRequest?.id, startListeningToOffers]);

  useEffect(() => {
    if (!error) return;
    showAlert('No pudimos actualizar la búsqueda', error);
    clearError();
  }, [clearError, error]);

  useEffect(() => {
    if (incomingOffers && incomingOffers.length > 0) {
      bottomSheetRef.current?.present();
    }
  }, [incomingOffers]);

  const handleOfferSelect = (offer: Offer) => {
    setSelectedOffer(offer);
  };

  const handleConfirmAccept = async (offer: Offer) => {
    if (acceptingOfferId) return;
    if (!userProfile?.id) {
      showAlert('Sesión no disponible', 'Vuelve a iniciar sesión para aceptar la propuesta.');
      return;
    }

    setAcceptingOfferId(offer.id);
    try {
      const requestSnapshot = activeRequest;
      const result = await acceptIncomingOffer(offer.id, userProfile.id);
      const acceptedOffer = result.offer;
      setSelectedOffer(null);
      bottomSheetRef.current?.dismiss();

      const summaryParams: AcceptedOfferSummaryParams = {
        requestId: activeRequestId || activeRequest?.id || '',
        offerId: acceptedOffer.id,
        careRelationshipId: result.careRelationshipId,
        conversationId: result.conversationId,
        psychologistId: acceptedOffer.psychologistId,
        psychologistName: acceptedOffer.psychologistName,
        amountDecimal: acceptedOffer.amount.toFixed(2),
        currencyCode: acceptedOffer.currencyCode,
        modality: requestSnapshot?.modality ?? 'chat',
        ...(acceptedOffer.psychologistPhotoURL
          ? { psychologistPhotoURL: acceptedOffer.psychologistPhotoURL }
          : {}),
        ...(acceptedOffer.psychologistSpecialty
          ? { psychologistSpecialty: acceptedOffer.psychologistSpecialty }
          : {}),
        ...(typeof acceptedOffer.psychologistRating === 'number'
          ? { psychologistRating: acceptedOffer.psychologistRating }
          : {}),
        ...(requestSnapshot?.scheduledFor
          ? { scheduledFor: requestSnapshot.scheduledFor.toISOString() }
          : {}),
        ...(result.inPersonDestination
          ? { inPersonDestination: result.inPersonDestination }
          : {}),
      };

      navigation.replace('AcceptedOffer', summaryParams);
    } catch (acceptanceError) {
      clearError();
      showAlert(
        'No pudimos confirmar la propuesta',
        presentUserError(
          acceptanceError,
          'No pudimos confirmar la propuesta en este momento. Tu solicitud sigue disponible para que lo intentes nuevamente.'
        )
      );
    } finally {
      setAcceptingOfferId(null);
    }
  };

  const handleConfirmCancel = async () => {
    setCancelAlertVisible(false);
    try {
      if (!userProfile?.id) {
        throw new Error('La sesión ya no está disponible.');
      }
      await cancelSearch(userProfile.id);
      navigation.reset({
        index: 0,
        routes: [{ name: 'PatientMain', params: { screen: 'Search' } }],
      });
    } catch (cancellationError) {
      clearError();
      showAlert(
        'No pudimos cancelar la solicitud',
        presentUserError(
          cancellationError,
          'La solicitud continúa activa. Intenta cancelarla nuevamente en unos instantes.'
        )
      );
    }
  };

  const handleMapReady = React.useCallback(() => {
    setMapReady(true);
    setMapLoadTimedOut(false);
  }, []);
  const isPresential = activeRequest?.modality === 'in-person';
  const mapRegion = React.useMemo(() => ({
    latitude: userLocation?.latitude ?? mapConfig.defaultLatitude,
    longitude: userLocation?.longitude ?? mapConfig.defaultLongitude,
    latitudeDelta: mapConfig.latitudeDelta,
    longitudeDelta: mapConfig.longitudeDelta,
  }), [mapConfig, userLocation?.latitude, userLocation?.longitude]);

  return (
    <BottomSheetModalProvider>
      <View style={styles.root}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="transparent"
          translucent
        />

        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={mapRegion}
          showsUserLocation={locationPermissionGranted}
          scrollEnabled
          zoomEnabled
          onMapReady={handleMapReady}
        />

        {!mapReady && (
          <View
            style={[StyleSheet.absoluteFill, styles.mapLoading]}
            pointerEvents="none"
            accessibilityLiveRegion="polite"
          >
            {mapLoadTimedOut ? <MapPin size={18} color={Colors.primary} /> : (
              <ActivityIndicator size="small" color={Colors.primary} />
            )}
            <Text style={styles.mapLoadingBody}>
              {mapLoadTimedOut ? 'El mapa está tardando; tu búsqueda sigue activa.' : 'Preparando mapa'}
            </Text>
          </View>
        )}

        <SafeAreaView style={styles.safe} pointerEvents="box-none">
          <View style={styles.topBar} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setCancelAlertVisible(true)}
              accessibilityLabel="Cancelar búsqueda"
              accessibilityRole="button"
            >
              <X size={22} color={Colors.primary} strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.statusPill} pointerEvents="none">
              {incomingOffers.length > 0 ? (
                <View style={styles.statusDot} />
              ) : (
                <ActivityIndicator size="small" color={Colors.primary} />
              )}
              <Text style={styles.statusText}>
                {incomingOffers.length > 0
                  ? `${incomingOffers.length} oferta(s) recibidas`
                  : 'Buscando profesionales'}
              </Text>
            </View>

            <View style={styles.topBarSpacer} pointerEvents="none" />
          </View>

          <View
            style={styles.infoCard}
            pointerEvents={incomingOffers.length > 0 ? 'auto' : 'none'}
          >
            <View style={styles.infoRow}>
              {activeRequest?.modality === 'in-person' ? (
                <MapPin size={16} color={Colors.primary} />
              ) : activeRequest?.modality === 'call' ? (
                <Phone size={16} color={Colors.primary} />
              ) : (
                <MessageCircle size={16} color={Colors.primary} />
              )}
              <Text style={styles.infoLabel}>Modalidad</Text>
              <Text style={styles.infoValue}>
                {activeRequest?.modality === 'in-person'
                  ? 'Presencial'
                  : activeRequest?.modality === 'call'
                    ? 'Llamada'
                    : 'Chat'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <WalletCards size={16} color={Colors.primary} />
              <Text style={styles.infoLabel}>Presupuesto sugerido</Text>
              <Text style={styles.infoValue}>
                {activeRequest
                  ? formatMoney(activeRequest.proposedBudget, activeRequest.currencyCode)
                  : 'No disponible'}
              </Text>
            </View>

            {isPresential && nearbyPsychologistCount > 0 && (
              <View style={styles.nearbyRow}>
                <MapPin size={14} color={Colors.primary} />
                <Text style={styles.nearbyText}>
                  {nearbyPsychologistCount} psicólogos disponibles en tu zona
                </Text>
              </View>
            )}

            {isPresential && locationPermissionDenied && (
              <View style={styles.nearbyRow}>
                <Text style={styles.nearbyText}>
                  Ubicación no disponible; buscando en toda la red
                </Text>
              </View>
            )}

            {incomingOffers.length > 0 && (
              <TouchableOpacity
                style={styles.viewOffersBtn}
                onPress={() => bottomSheetRef.current?.present()}
                accessibilityRole="button"
                accessibilityLabel={`Ver ${incomingOffers.length} propuestas recibidas`}
              >
                <Text style={styles.viewOffersBtnText}>
                  Ver propuestas recibidas ({incomingOffers.length})
                </Text>
                <ChevronUp size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>

        <BottomSheetModal
          ref={bottomSheetRef}
          snapPoints={['50%', '85%']}
          backgroundStyle={styles.sheetBg}
          handleIndicatorStyle={styles.sheetHandle}
          enablePanDownToClose
        >
          <View style={styles.sheetContent}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Propuestas disponibles</Text>
              <Text style={styles.sheetSubtitle}>
                Elige la que mejor se ajuste a tus necesidades y presupuesto
              </Text>
            </View>

            <BottomSheetFlatList
              data={incomingOffers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.offersList}
              renderItem={({ item }) => (
                <OfferCard
                  offer={item}
                  patientBudget={activeRequest?.proposedBudget ?? 0}
                  onAccept={() => handleOfferSelect(item)}
                />
              )}
            />
          </View>
        </BottomSheetModal>

        <OfferComparisonSheet
          visible={Boolean(selectedOffer)}
          offer={selectedOffer}
          request={activeRequest}
          isAccepting={acceptingOfferId === selectedOffer?.id}
          onAccept={handleConfirmAccept}
          onViewProfile={(psychologistId) =>
            navigation.navigate('PsychologistProfile', { psychologistId })
          }
          onClose={() => setSelectedOffer(null)}
        />

        <CustomAlert
          visible={cancelAlertVisible}
          title="¿Cancelar búsqueda?"
          message="Se cancelará la solicitud y dejarás de recibir propuestas para esta sesión."
          confirmText="Sí, cancelar"
          cancelText="Seguir esperando"
          tone="warning"
          confirmDestructive
          showCancel={true}
          onConfirm={handleConfirmCancel}
          onCancel={() => setCancelAlertVisible(false)}
        />
      </View>
    </BottomSheetModalProvider>
  );
};

interface RadarRecoveryProps {
  readonly isCancelling: boolean;
  readonly message: string | null;
  readonly onRetry: () => void;
  readonly onCancel: () => void;
}

const RadarRecovery: React.FC<RadarRecoveryProps> = ({
  isCancelling,
  message,
  onRetry,
  onCancel,
}) => (
  <View style={styles.recoveryScreen} accessibilityRole="alert">
    <CircleAlert size={36} color={Colors.error} strokeWidth={1.8} />
    <Text style={styles.recoveryTitle}>No pudimos abrir la búsqueda</Text>
    <Text style={styles.recoveryBody}>
      {message ?? 'Tu solicitud sigue protegida. Puedes reintentar o cancelarla para crear una nueva búsqueda.'}
    </Text>
    <View style={styles.recoveryActions}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Reintentar búsqueda"
        disabled={isCancelling}
        onPress={onRetry}
        style={[styles.recoveryPrimaryAction, isCancelling && styles.recoveryActionDisabled]}
      >
        <Text style={styles.recoveryPrimaryActionText}>Reintentar</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Cancelar búsqueda activa"
        disabled={isCancelling}
        onPress={onCancel}
        style={[styles.recoverySecondaryAction, isCancelling && styles.recoveryActionDisabled]}
      >
        {isCancelling ? (
          <ActivityIndicator size="small" color={Colors.error} />
        ) : (
          <Text style={styles.recoverySecondaryActionText}>Cancelar búsqueda</Text>
        )}
      </TouchableOpacity>
    </View>
  </View>
);

export const RadarScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigation>();
  const userId = useAuthStore((state) => state.userProfile?.id);
  const activeRequestId = useRequestStore((state) => state.activeRequestId ?? state.activeRequest?.id);
  const cancelSearch = useRequestStore((state) => state.cancelSearch);
  const clearError = useRequestStore((state) => state.clearError);
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  const retry = React.useCallback(() => {
    clearError();
    setRecoveryMessage(null);
    setRecoveryAttempt((attempt) => attempt + 1);
  }, [clearError]);

  const cancel = React.useCallback(async () => {
    if (isCancelling) return;
    if (!userId) {
      setRecoveryMessage('Tu sesión ya no está disponible. Vuelve a iniciar sesión para continuar.');
      return;
    }

    setIsCancelling(true);
    setRecoveryMessage(null);
    try {
      await cancelSearch(userId);
      navigation.reset({
        index: 0,
        routes: [{ name: 'PatientMain', params: { screen: 'Search' } }],
      });
    } catch {
      setRecoveryMessage('No pudimos cancelar la búsqueda. Revisa tu conexión e inténtalo nuevamente.');
    } finally {
      setIsCancelling(false);
    }
  }, [cancelSearch, isCancelling, navigation, userId]);

  return (
    <ErrorBoundary
      key={`${activeRequestId ?? 'without-request'}-${recoveryAttempt}`}
      fallback={(
        <RadarRecovery
          isCancelling={isCancelling}
          message={recoveryMessage}
          onRetry={retry}
          onCancel={() => void cancel()}
        />
      )}
    >
      <RadarScreenContent />
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.surfaceMuted,
  },
  recoveryScreen: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.md,
  },
  recoveryTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  recoveryBody: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 360,
  },
  recoveryActions: {
    width: '100%',
    maxWidth: 360,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  recoveryPrimaryAction: {
    minHeight: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  recoveryPrimaryActionText: {
    ...Typography.button,
    color: Colors.textInverse,
  },
  recoverySecondaryAction: {
    minHeight: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.error,
  },
  recoverySecondaryActionText: {
    ...Typography.button,
    color: Colors.error,
  },
  recoveryActionDisabled: {
    opacity: 0.55,
  },
  mapLoading: {
    position: 'absolute',
    top: 112,
    left: Spacing.xl,
    right: Spacing.xl,
    zIndex: 2,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    ...Shadow.sm,
  },
  mapLoadingBody: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xs,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  topBarSpacer: { width: 44, height: 44 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadow.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  statusText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bodySemiBold,
  },
  infoCard: {
    margin: Spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadow.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  infoLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    ...Typography.label,
    color: Colors.textPrimary,
    letterSpacing: 0,
    textTransform: 'none',
  },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryTint,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  nearbyText: {
    ...Typography.caption,
    color: Colors.primary,
    fontFamily: FontFamily.bodyMedium,
    flex: 1,
  },
  viewOffersBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  viewOffersBtnText: {
    ...Typography.button,
    color: Colors.primary,
    fontSize: 14,
  },
  sheetBg: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
  },
  sheetHandle: {
    backgroundColor: Colors.border,
    width: 36,
  },
  sheetContent: {
    flex: 1,
  },
  sheetHeader: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 2,
  },
  sheetTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  sheetSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  offersList: {
    paddingVertical: Spacing.base,
    paddingBottom: 40,
  },
});
