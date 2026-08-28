import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { StarRating } from '../../components/common/StarRating';
import { AppButton } from '../../components/common/AppButton';
import { Modality, Psychologist } from '../../models/Psychologist';
import { getPsychologistById } from '../../repositories/PsychologistRepository';
import type {
  AppNavigation,
  PsychologistProfileRoute,
} from '../../navigation/navigationTypes';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const MODALITY_LABELS: Record<Modality, { icon: MaterialIconName; label: string }> = {
  chat: { icon: 'chat-bubble-outline', label: 'Chat de texto' },
  call: { icon: 'phone-in-talk', label: 'Llamada de audio' },
  'in-person': { icon: 'location-on', label: 'Presencial' },
};

export const PsychologistProfileScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigation>();
  const route = useRoute<PsychologistProfileRoute>();

  const psychologistId: string | undefined = route.params?.psychologistId;
  const offerAmount: number | undefined = route.params?.offerAmount;
  const onAccept: (() => void) | undefined = route.params?.onAccept;
  const [psychologist, setPsychologist] = useState<Psychologist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProfile = () => {
    if (!psychologistId) {
      setLoadError('El perfil solicitado no es válido.');
      setIsLoading(false);
      return () => undefined;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    void getPsychologistById(psychologistId, controller.signal)
      .then(setPsychologist)
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'No pudimos cargar el perfil.');
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  };

  useEffect(loadProfile, [psychologistId]);

  if (isLoading) {
    return (
      <View style={styles.errorState}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.errorText}>Cargando perfil verificado...</Text>
      </View>
    );
  }

  if (!psychologist) {
    return (
      <View style={styles.errorState}>
        <MaterialIcons name="error-outline" size={48} color={Colors.textDisabled} />
        <Text style={styles.errorText}>{loadError ?? 'Perfil no disponible'}</Text>
        <TouchableOpacity onPress={loadProfile} style={styles.backLink}>
          <Text style={styles.backLinkText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <View style={styles.hero}>
        <SafeAreaView>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back button"
          >
            <MaterialIcons name="arrow-back" size={22} color={Colors.textInverse} />
          </TouchableOpacity>
        </SafeAreaView>

        <View style={styles.heroContent}>
          {psychologist.photoURL ? (
            <Image source={{ uri: psychologist.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <MaterialIcons name="person" size={48} color={Colors.textInverse} />
            </View>
          )}

          <View style={styles.heroTextBlock}>
            <View style={styles.verifiedRow}>
              <Text style={styles.heroName}>{psychologist.displayName}</Text>
              <MaterialIcons name="verified" size={18} color={Colors.accent} />
            </View>
            <Text style={styles.heroSpecialty}>{psychologist.specialty}</Text>
            <StarRating rating={psychologist.rating} size={14} showValue />
            <Text style={styles.reviewCount}>{psychologist.totalReviews} reseñas</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {offerAmount !== undefined && (
          <View style={styles.offerBanner}>
            <View style={styles.offerBannerLeft}>
              <Text style={styles.offerBannerLabel}>Oferta recibida</Text>
              <Text style={styles.offerBannerAmount}>C$ {offerAmount}</Text>
            </View>
            <MaterialIcons name="local-offer" size={32} color={Colors.accent} />
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {psychologist.currencyCode} {psychologist.pricePerHour}
            </Text>
            <Text style={styles.statLabel}>desde / hora</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{psychologist.totalReviews}</Text>
            <Text style={styles.statLabel}>reseñas</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{psychologist.rating}</Text>
            <Text style={styles.statLabel}>rating</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionRow}>
            <MaterialIcons name="badge" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Credencial</Text>
          </View>
          <Text style={styles.licenseText}>Licencia profesional verificada</Text>
          <Text style={styles.licenseNote}>
            Autoridad emisora: {psychologist.credentialAuthority}
          </Text>
        </View>

        {psychologist.bio && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionRow}>
              <MaterialIcons name="info-outline" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Acerca de</Text>
            </View>
            <Text style={styles.bioText}>{psychologist.bio}</Text>
          </View>
        )}

        <View style={styles.sectionCard}>
          <View style={styles.sectionRow}>
            <MaterialIcons name="devices" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Modalidades de atención</Text>
          </View>
          <View style={styles.modalityList}>
            {psychologist.modalities.map((m) => {
              const meta = MODALITY_LABELS[m];
              if (!meta) return null;
              return (
                <View key={m} style={styles.modalityChip}>
                  <MaterialIcons name={meta.icon} size={16} color={Colors.primary} />
                  <Text style={styles.modalityLabel}>{meta.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.sectionCard, styles.availabilityCard]}>
          <View style={styles.availabilityDot} />
          <Text style={styles.availabilityText}>
            {psychologist.isAvailable ? 'Disponible ahora mismo' : 'No disponible en este momento'}
          </Text>
        </View>

        <View style={styles.ctaBlock}>
          {onAccept ? (
            <AppButton
              label={offerAmount ? `Aceptar oferta — C$${offerAmount}` : 'Aceptar psicólogo'}
              onPress={() => {
                onAccept();
                navigation.goBack();
              }}
              variant="primary"
              size="lg"
              fullWidth
              icon={<MaterialIcons name="check-circle-outline" size={20} color={Colors.primary} />}
            />
          ) : null}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  hero: {
    backgroundColor: Colors.primary,
    paddingBottom: Spacing.xxl,
  },
  backBtn: {
    margin: Spacing.md,
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  heroTextBlock: {
    flex: 1,
    gap: 4,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textInverse,
    flexShrink: 1,
  },
  heroSpecialty: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
    marginBottom: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  scrollContent: {
    padding: Spacing.base,
    gap: Spacing.md,
    marginTop: -Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  offerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  offerBannerLeft: {
    gap: 2,
  },
  offerBannerLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  offerBannerAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.accent,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  licenseText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  licenseNote: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  bioText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  modalityList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  modalityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalityLabel: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  availabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  availabilityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  availabilityText: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  ctaBlock: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  secondaryBtnText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  backLink: {
    paddingVertical: Spacing.sm,
  },
  backLinkText: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
