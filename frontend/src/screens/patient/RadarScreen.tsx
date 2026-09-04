import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  StatusBar,
  Platform,
  AccessibilityInfo,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, {
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
} from '../../components/common/CustomMapView';
import {
  ChevronUp,
  MapPin,
  MessageCircle,
  Phone,
  WalletCards,
  X,
  ShieldCheck,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import {
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetFlatList,
} from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';

import { Colors, BrandColors } from '../../theme/colors';
import { FontFamily, Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { OfferCard } from '../../components/patient/OfferCard';
import { Offer } from '../../models/Offer';
import { useRequestStore } from '../../store/useRequestStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getNearbyPsychologists } from '../../repositories/PsychologistRepository';
import { getDirectoryMapConfig } from '../../config/runtimeConfig';
import { CustomAlert } from '../../components/common/CustomAlert';
import { OfferComparisonSheet } from '../../components/shared/OfferComparisonSheet';
import type {
  AppNavigation,
  AcceptedOfferSummaryParams,
} from '../../navigation/navigationTypes';
import { showAlert } from '../../utils/alert';
import { presentUserError } from '../../utils/userFacingError';
import { formatMoney } from '../../utils/money';
import { getResponsiveRadarWidth } from '../../utils/responsiveLayout';

export const RadarScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigation>();
  const { width } = useWindowDimensions();
  const radarWidth = getResponsiveRadarWidth(width);
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

  const [cancelAlertVisible, setCancelAlertVisible] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [acceptingOfferId, setAcceptingOfferId] = useState<string | null>(null);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const bottomSheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    let isMounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isMounted) setReduceMotionEnabled(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled
    );
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  // PRIVACIDAD GEOGRÁFICA (Binding Note 7):
  // Solo se solicita GPS y mapa si la modalidad es estrictamente 'in-person'.
  useEffect(() => {
    if (activeRequest?.modality !== 'in-person') {
      setUserLocation(null);
      setLocationPermissionDenied(false);
      setNearbyPsychologistCount(0);
      return;
    }

    let isMounted = true;
    const requestLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!isMounted) return;
        if (status !== 'granted') {
          setLocationPermissionDenied(true);
          return;
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
        if (isMounted) setLocationPermissionDenied(true);
      }
    };

    void requestLocation();
    return () => {
      isMounted = false;
    };
  }, [activeRequest?.modality]);

  useEffect(() => {
    if (!userLocation || activeRequest?.modality !== 'in-person') return;
    const controller = new AbortController();
    const { radiusKm } = getDirectoryMapConfig();
    void getNearbyPsychologists(
      userLocation.latitude,
      userLocation.longitude,
      radiusKm,
      controller.signal
    )
      .then((profiles) => setNearbyPsychologistCount(profiles.length))
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setNearbyPsychologistCount(0);
      });
    return () => controller.abort();
  }, [userLocation, activeRequest?.modality]);

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
    const stopAnimations = () => {
      ring1.stopAnimation();
      ring2.stopAnimation();
      ring3.stopAnimation();
      rotateAnim.stopAnimation();
    };
    stopAnimations();

    if (reduceMotionEnabled) {
      ring1.setValue(0.35);
      ring2.setValue(0.35);
      ring3.setValue(0.35);
      rotateAnim.setValue(0);
      return stopAnimations;
    }

    const pulseRing = (animation: Animated.Value, delay: number) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(animation, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(animation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    const ringAnimations = [
      pulseRing(ring1, 0),
      pulseRing(ring2, 700),
      pulseRing(ring3, 1400),
    ];
    const sweepAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    ringAnimations.forEach((animation) => animation.start());
    sweepAnimation.start();
    return () => {
      ringAnimations.forEach((animation) => animation.stop());
      sweepAnimation.stop();
      stopAnimations();
    };
  }, [reduceMotionEnabled, ring1, ring2, ring3, rotateAnim]);

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

      // Construcción del snapshot serializable AcceptedOfferSummaryParams
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
      navigation.goBack();
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

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const ringStyle = (anim: Animated.Value, size: number) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    position: 'absolute' as const,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    opacity: anim.interpolate({
      inputRange: [0, 0.3, 1],
      outputRange: [0, 0.6, 0],
    }),
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.4, 1],
        }),
      },
    ],
  });

  const isPresential = activeRequest?.modality === 'in-person';

  return (
    <BottomSheetModalProvider>
      <View style={styles.root}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="transparent"
          translucent
        />

        {isPresential && userLocation ? (
          <MapView
            style={StyleSheet.absoluteFill}
            provider={
              Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT
            }
            initialRegion={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: getDirectoryMapConfig().latitudeDelta,
              longitudeDelta: getDirectoryMapConfig().longitudeDelta,
            }}
            showsUserLocation
            scrollEnabled={false}
            zoomEnabled={false}
            mapType="standard"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.mapUnavailable]} />
        )}

        <View style={styles.darkOverlay} />

        <SafeAreaView style={styles.safe}>
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setCancelAlertVisible(true)}
              accessibilityLabel="Cancelar búsqueda"
              accessibilityRole="button"
            >
              <X size={22} color={Colors.primary} strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>
                {incomingOffers.length > 0
                  ? `${incomingOffers.length} oferta(s) recibidas`
                  : 'Buscando especialistas...'}
              </Text>
            </View>

            <View style={styles.topBarSpacer} />
          </View>

          {/* Animación del Radar */}
          <View style={styles.radarContainer}>
            <Animated.View style={ringStyle(ring1, radarWidth * 0.45)} />
            <Animated.View style={ringStyle(ring2, radarWidth * 0.65)} />
            <Animated.View style={ringStyle(ring3, radarWidth * 0.85)} />

            <Animated.View
              style={[
                styles.sweepWrapper,
                { width: radarWidth * 0.58, height: radarWidth * 0.58 },
                { transform: [{ rotate: spin }] },
              ]}
            >
              <View style={styles.sweepLine} />
            </Animated.View>

            <View style={styles.radarCore}>
              <ShieldCheck
                size={34}
                color={Colors.accent}
                strokeWidth={1.8}
              />
              {incomingOffers.length > 0 && (
                <View style={styles.offerBadge}>
                  <Text style={styles.offerBadgeText}>
                    {incomingOffers.length}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Tarjeta de información */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              {activeRequest?.modality === 'in-person' ? (
                <MapPin size={16} color={Colors.accent} />
              ) : activeRequest?.modality === 'call' ? (
                <Phone size={16} color={Colors.accent} />
              ) : (
                <MessageCircle size={16} color={Colors.accent} />
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
              <WalletCards size={16} color={Colors.accent} />
              <Text style={styles.infoLabel}>Presupuesto sugerido</Text>
              <Text style={styles.infoValue}>
                {activeRequest
                  ? formatMoney(activeRequest.proposedBudget, activeRequest.currencyCode)
                  : 'No disponible'}
              </Text>
            </View>

            {isPresential && nearbyPsychologistCount > 0 && (
              <View style={styles.nearbyRow}>
                <MapPin size={14} color={Colors.accent} />
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

            {incomingOffers.length === 0 ? (
              <Text style={styles.waitingText}>
                Notificando a psicólogos verificados...
              </Text>
            ) : (
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

        {/* Modal inferior con lista de ofertas */}
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

        {/* Comparación y confirmación accesible de la oferta */}
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

        {/* Diálogo de cancelación de búsqueda */}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BrandColors.navy,
  },
  mapUnavailable: {
    backgroundColor: BrandColors.navy,
  },
  darkOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.overlay,
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
    backgroundColor: Colors.overlay,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderOnBrand,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  statusText: {
    ...Typography.caption,
    color: Colors.textInverse,
    fontFamily: FontFamily.bodySemiBold,
  },
  radarContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sweepWrapper: {
    position: 'absolute',
    alignItems: 'center',
  },
  sweepLine: {
    width: 1.5,
    height: '50%',
    backgroundColor: Colors.accent,
    opacity: 0.5,
    transformOrigin: 'bottom',
  },
  radarCore: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.accent,
    ...Shadow.xl,
  },
  offerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerBadgeText: {
    ...Typography.caption,
    fontFamily: FontFamily.bodyBold,
    color: Colors.primary,
  },
  infoCard: {
    margin: Spacing.base,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.borderOnBrand,
    ...Shadow.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  infoLabel: {
    ...Typography.bodySmall,
    color: Colors.textOnBrandMuted,
    flex: 1,
  },
  infoValue: {
    ...Typography.label,
    color: Colors.textInverse,
    letterSpacing: 0,
    textTransform: 'none',
  },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceOnBrand,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  nearbyText: {
    ...Typography.caption,
    color: Colors.accent,
    fontFamily: FontFamily.bodyMedium,
  },
  waitingText: {
    ...Typography.bodySmall,
    color: Colors.textOnBrandMuted,
    textAlign: 'center',
    fontStyle: 'italic',
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
