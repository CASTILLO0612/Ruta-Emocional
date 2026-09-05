import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Info,
  MapPin,
  MessageCircle,
  MonitorSmartphone,
  PhoneCall,
  UserRound,
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../../theme/colors';
import { FontFamily, Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { StarRating } from '../../components/common/StarRating';
import { Modality, Psychologist } from '../../models/Psychologist';
import { getPsychologistById } from '../../repositories/PsychologistRepository';
import type {
  AppNavigation,
  PsychologistProfileRoute,
} from '../../navigation/navigationTypes';
import { formatModalityLabel } from '../../utils/modality';
import { formatDecimalMoney } from '../../utils/formatDecimalMoney';
import { presentUserError } from '../../utils/userFacingError';

function ModalityIcon({ modality }: { readonly modality: Modality }) {
  if (modality === 'chat') return <MessageCircle size={16} color={Colors.primary} strokeWidth={1.9} />;
  if (modality === 'call') return <PhoneCall size={16} color={Colors.primary} strokeWidth={1.9} />;
  return <MapPin size={16} color={Colors.primary} strokeWidth={1.9} />;
}

export const PsychologistProfileScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigation>();
  const route = useRoute<PsychologistProfileRoute>();

  const psychologistId: string | undefined = route.params?.psychologistId;
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
        setLoadError(presentUserError(error, 'No pudimos cargar el perfil. Inténtalo nuevamente.'));
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
        <CircleAlert size={48} color={Colors.textDisabled} strokeWidth={1.6} />
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
            accessibilityLabel="Volver"
          >
            <ArrowLeft size={22} color={Colors.textInverse} strokeWidth={2} />
          </TouchableOpacity>
        </SafeAreaView>

        <View style={styles.heroContent}>
          {psychologist.photoURL ? (
            <Image source={{ uri: psychologist.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <UserRound size={48} color={Colors.textInverse} strokeWidth={1.6} />
            </View>
          )}

          <View style={styles.heroTextBlock}>
            <View style={styles.verifiedRow}>
              <Text style={styles.heroName}>{psychologist.displayName}</Text>
              <BadgeCheck size={18} color={Colors.accent} strokeWidth={2} />
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
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatDecimalMoney(psychologist.pricePerHour, psychologist.currencyCode)}
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
            <Text style={styles.statLabel}>calificación</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionRow}>
            <BadgeCheck size={18} color={Colors.primary} strokeWidth={1.9} />
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
              <Info size={18} color={Colors.primary} strokeWidth={1.9} />
              <Text style={styles.sectionTitle}>Acerca de</Text>
            </View>
            <Text style={styles.bioText}>{psychologist.bio}</Text>
          </View>
        )}

        <View style={styles.sectionCard}>
          <View style={styles.sectionRow}>
            <MonitorSmartphone size={18} color={Colors.primary} strokeWidth={1.9} />
            <Text style={styles.sectionTitle}>Modalidades de atención</Text>
          </View>
          <View style={styles.modalityList}>
            {psychologist.modalities.map((m) => {
              const label = formatModalityLabel(m);
              return (
                <View key={m} style={styles.modalityChip}>
                  <ModalityIcon modality={m} />
                  <Text style={styles.modalityLabel}>{label}</Text>
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
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceOnBrand,
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
    backgroundColor: Colors.surfaceOnBrand,
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
    ...Typography.h3,
    color: Colors.textInverse,
    flexShrink: 1,
  },
  heroSpecialty: {
    ...Typography.bodySmall,
    color: Colors.textOnBrandMuted,
    fontFamily: FontFamily.bodyMedium,
    marginBottom: 4,
  },
  reviewCount: {
    ...Typography.caption,
    color: Colors.textOnBrandMuted,
    marginTop: 2,
  },
  scrollContent: {
    padding: Spacing.base,
    gap: Spacing.md,
    marginTop: -Spacing.lg,
    paddingBottom: Spacing.xxxl,
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
    ...Typography.priceSm,
    color: Colors.textPrimary,
  },
  statLabel: {
    ...Typography.caption,
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
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  licenseText: {
    ...Typography.body,
    fontFamily: FontFamily.bodyBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  licenseNote: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  bioText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
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
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bodyMedium,
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
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bodyMedium,
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
    ...Typography.button,
    color: Colors.textSecondary,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
  },
  errorText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  backLink: {
    paddingVertical: Spacing.sm,
  },
  backLinkText: {
    ...Typography.button,
    color: Colors.primary,
  },
});
