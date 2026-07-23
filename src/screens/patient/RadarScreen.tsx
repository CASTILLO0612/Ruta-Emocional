import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Animated,
  Easing,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
  Marker,
} from '../../components/common/CustomMapView';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BottomSheetModal, BottomSheetModalProvider, BottomSheetView } from '@gorhom/bottom-sheet';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { OfferCard } from '../../components/patient/OfferCard';
import { Offer } from '../../models/Offer';
import { Psychologist } from '../../models/Psychologist';
import { useRequestStore } from '../../store/useRequestStore';
import { getAvailablePsychologists } from '../../repositories/PsychologistRepository';
import { CustomAlert } from '../../components/common/CustomAlert';

const { width: SCREEN_W } = Dimensions.get('window');
const DEFAULT_REGION = {
  latitude: 12.1328,
  longitude: -86.2904,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

export const RadarScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const {
    activeRequest,
    incomingOffers,
    acceptIncomingOffer,
    cancelSearch,
    submitCounterOffer,
    isLoading,
  } = useRequestStore();

  const [nearbyPsychologists, setNearbyPsychologists] = useState<Psychologist[]>([]);

  const [cancelAlertVisible, setCancelAlertVisible] = useState(false);
  const [acceptAlertVisible, setAcceptAlertVisible] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const bottomSheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    getAvailablePsychologists()
      .then(setNearbyPsychologists)
      .catch((err) => console.warn('[Radar] Error loading psychologists:', err));
  }, []);

  useEffect(() => {
    if (activeRequest && activeRequest.id) {
      const budget = activeRequest.proposedBudget;

      const t1 = setTimeout(() => {
        submitCounterOffer({
          requestId: activeRequest.id,
          psychologistId: 'psy_001',
          psychologistName: 'Dra. Maria Elena Castillo',
          psychologistPhotoURL: 'https://i.pravatar.cc/150?img=47',
          psychologistRating: 4.9,
          psychologistSpecialty: 'Ansiedad y Estres',
          amount: budget + 50,
        }).catch(err => console.warn('[Simulación Oferta 1 Error]', err));
      }, 3000);

      const t2 = setTimeout(() => {
        submitCounterOffer({
          requestId: activeRequest.id,
          psychologistId: 'psy_002',
          psychologistName: 'Dr. Carlos Mendez Rios',
          psychologistPhotoURL: 'https://i.pravatar.cc/150?img=68',
          psychologistRating: 4.7,
          psychologistSpecialty: 'Depresión y Duelo',
          amount: budget - 30,
        }).catch(err => console.warn('[Simulación Oferta 2 Error]', err));
      }, 7000);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [activeRequest?.id]);

  const pulseRing = (anim: Animated.Value, delay: number) => {
    return Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
  };

  const sweepAnimation = Animated.loop(
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 3000,
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== 'web',
    })
  );

  useEffect(() => {
    pulseRing(ring1, 0).start();
    pulseRing(ring2, 700).start();
    pulseRing(ring3, 1400).start();
    sweepAnimation.start();
    return () => {
      ring1.stopAnimation();
      ring2.stopAnimation();
      ring3.stopAnimation();
      rotateAnim.stopAnimation();
    };
  }, []);

  useEffect(() => {
    if (incomingOffers.length > 0) {
      bottomSheetRef.current?.present();
    }
  }, [incomingOffers.length]);

  const handleOfferSelect = (offer: Offer) => {
    setSelectedOffer(offer);
    setAcceptAlertVisible(true);
  };

  const handleConfirmAccept = async () => {
    if (!selectedOffer) return;
    setAcceptAlertVisible(false);
    await acceptIncomingOffer(selectedOffer.id, selectedOffer.psychologistId, selectedOffer.amount);
    bottomSheetRef.current?.dismiss();
    
    const selectedModality = activeRequest?.modality ?? 'chat';
    if (selectedModality === 'in-person') {
      navigation.navigate('Route', {
        psychologistName: selectedOffer.psychologistName,
        psychologistPhotoURL: selectedOffer.psychologistPhotoURL,
        amount: selectedOffer.amount,
      });
    } else {
      navigation.navigate('Consultation', {
        psychologistName: selectedOffer.psychologistName,
        psychologistPhotoURL: selectedOffer.psychologistPhotoURL,
        modality: selectedModality,
        amount: selectedOffer.amount,
      });
    }
  };

  const handleConfirmCancel = () => {
    setCancelAlertVisible(false);
    cancelSearch();
    navigation.goBack();
  };

  const handlePinPress = (psy: Psychologist) => {
    const { createdAt, ...serializablePsy } = psy as any;
    navigation.navigate('PsychologistProfile', {
      psychologist: serializablePsy,
    });
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
    opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 0] }),
    transform: [
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
    ],
  });

  return (
    <BottomSheetModalProvider>
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        <MapView
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
          initialRegion={DEFAULT_REGION}
          showsUserLocation
          scrollEnabled={false}
          zoomEnabled={false}
          mapType="standard"
        >
          {nearbyPsychologists.map((psy) =>
            psy.coordinates ? (
              <Marker
                key={psy.id}
                coordinate={psy.coordinates}
                title={psy.displayName}
                onPress={() => handlePinPress(psy)}
              >
                <View style={styles.life360Marker}>
                  <View style={styles.life360AvatarBorder}>
                    {psy.photoURL ? (
                      <Image source={{ uri: psy.photoURL }} style={styles.life360Avatar} />
                    ) : (
                      <View style={styles.life360Placeholder}>
                        <MaterialIcons name="person" size={20} color={Colors.textInverse} />
                      </View>
                    )}
                  </View>
                  <View style={styles.life360ActiveBadge} />
                  <View style={styles.life360PinTip} />
                </View>
              </Marker>
            ) : null
          )}
        </MapView>

        <View style={styles.darkOverlay} />

        <SafeAreaView style={styles.safe}>
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setCancelAlertVisible(true)}
              accessibilityLabel="Cancel search button"
            >
              <MaterialIcons name="close" size={22} color={Colors.primary} />
            </TouchableOpacity>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Buscando psicólogos...</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.radarContainer}>
            <Animated.View style={ringStyle(ring1, SCREEN_W * 0.82)} />
            <Animated.View style={ringStyle(ring2, SCREEN_W * 0.58)} />
            <Animated.View style={ringStyle(ring3, SCREEN_W * 0.36)} />

            <Animated.View
              style={[styles.sweepWrapper, { transform: [{ rotate: spin }] }]}
            >
              <View style={styles.sweepLine} />
            </Animated.View>

            <View style={styles.radarCore}>
              <MaterialIcons name="psychology" size={32} color={Colors.accent} />
            </View>

            {incomingOffers.length > 0 && (
              <View style={styles.offerBadge}>
                <Text style={styles.offerBadgeText}>{incomingOffers.length}</Text>
              </View>
            )}
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <MaterialIcons name="account-balance-wallet" size={16} color={Colors.accent} />
              <Text style={styles.infoLabel}>Tu presupuesto</Text>
              <Text style={styles.infoValue}>
                C${activeRequest?.proposedBudget ?? '--'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="chat-bubble-outline" size={16} color={Colors.accent} />
              <Text style={styles.infoLabel}>Modalidad</Text>
              <Text style={styles.infoValue}>
                {activeRequest?.modality ?? '--'}
              </Text>
            </View>

            {nearbyPsychologists.length > 0 && incomingOffers.length === 0 && (
              <View style={styles.nearbyRow}>
                <MaterialIcons name="location-on" size={14} color={Colors.accent} />
                <Text style={styles.nearbyText}>
                  {nearbyPsychologists.length} psicólogos disponibles cerca de ti
                </Text>
              </View>
            )}

            {incomingOffers.length === 0 ? (
              <Text style={styles.waitingText}>
                Esperando ofertas de psicólogos disponibles...
              </Text>
            ) : (
              <TouchableOpacity
                style={styles.viewOffersBtn}
                onPress={() => bottomSheetRef.current?.present()}
              >
                <MaterialIcons name="expand-less" size={18} color={Colors.primary} />
                <Text style={styles.viewOffersBtnText}>
                  Ver {incomingOffers.length} oferta{incomingOffers.length > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>

        <BottomSheetModal
          ref={bottomSheetRef}
          snapPoints={['50%', '85%']}
          backgroundStyle={styles.sheetBg}
          handleIndicatorStyle={styles.sheetHandle}
        >
          <BottomSheetView style={styles.sheetContent}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Ofertas recibidas</Text>
              <Text style={styles.sheetSubtitle}>
                {incomingOffers.length} psicólog{incomingOffers.length !== 1 ? 'os' : 'o'} disponible{incomingOffers.length !== 1 ? 's' : ''}
              </Text>
            </View>

            <FlatList
              data={incomingOffers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <OfferCard
                  offer={item}
                  patientBudget={activeRequest?.proposedBudget ?? 0}
                  onAccept={handleOfferSelect}
                />
              )}
              contentContainerStyle={styles.offersList}
              showsVerticalScrollIndicator={false}
            />
          </BottomSheetView>
        </BottomSheetModal>

        <CustomAlert
          visible={cancelAlertVisible}
          title="Cancelar búsqueda"
          message="¿Seguro que deseas cancelar tu solicitud de terapia?"
          confirmText="Sí, cancelar"
          cancelText="No, continuar"
          showCancel
          onConfirm={handleConfirmCancel}
          onCancel={() => setCancelAlertVisible(false)}
        />

        <CustomAlert
          visible={acceptAlertVisible}
          title="Confirmar aceptación"
          message={selectedOffer ? `¿Deseas aceptar la oferta de la ${selectedOffer.psychologistName} por C$${selectedOffer.amount}?` : ''}
          confirmText="Aceptar"
          cancelText="Cancelar"
          showCancel
          onConfirm={handleConfirmAccept}
          onCancel={() => setAcceptAlertVisible(false)}
        />
      </View>
    </BottomSheetModalProvider>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#E5E9F0',
  },
  darkOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10,36,99,0.06)',
    pointerEvents: 'none',
  },
  safe: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.base,
    zIndex: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(10,36,99,0.92)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(57,211,83,0.3)',
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
    fontWeight: '600',
  },
  radarContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sweepWrapper: {
    position: 'absolute',
    width: SCREEN_W * 0.58,
    height: SCREEN_W * 0.58,
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
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  infoCard: {
    margin: Spacing.base,
    backgroundColor: 'rgba(10,36,99,0.92)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(57,211,83,0.3)',
    ...Shadow.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  infoLabel: {
    ...Typography.bodySmall,
    color: 'rgba(255,255,255,0.6)',
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
    backgroundColor: 'rgba(57,211,83,0.1)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  nearbyText: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '500',
  },
  waitingText: {
    ...Typography.bodySmall,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  viewOffersBtn: {
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
  },

  life360Marker: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
    height: 58,
  },
  life360AvatarBorder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.surface,
    borderWidth: 3,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  life360Avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  life360Placeholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  life360ActiveBadge: {
    position: 'absolute',
    top: 2,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  life360PinTip: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.accent,
    alignSelf: 'center',
    marginTop: -2,
  },
});
