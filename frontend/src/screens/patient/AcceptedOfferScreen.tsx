import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import {
  CheckCircle2,
  Calendar,
  MessageCircle,
  Phone,
  MapPin,
  Star,
  UserRound,
  ArrowRight,
  Navigation,
} from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';
import { IconSize, IconStroke } from '../../theme/icons';
import { AppHeader } from '../../components/shared/AppHeader';
import { ScreenContainer } from '../../components/shared/ScreenContainer';
import { AppButton } from '../../components/common/AppButton';
import { formatDecimalMoney } from '../../utils/formatDecimalMoney';
import { resolveAcceptedOfferDecision } from '../../navigation/resolveAcceptedOfferDecision';
import { openExternalNavigation } from '../../utils/externalNavigation';
import { showAlert } from '../../utils/alert';
import type {
  AcceptedOfferRoute,
  AppNavigation,
} from '../../navigation/navigationTypes';

export const AcceptedOfferScreen: React.FC = () => {
  const route = useRoute<AcceptedOfferRoute>();
  const navigation = useNavigation<AppNavigation>();
  const summary = route.params;

  const decision = resolveAcceptedOfferDecision({
    modality: summary.modality,
    scheduledFor: summary.scheduledFor,
    conversationId: summary.conversationId,
  });

  const getModalityLabel = (modality: string) => {
    switch (modality) {
      case 'chat':
        return { label: 'Chat en línea', icon: MessageCircle };
      case 'call':
        return { label: 'Llamada de voz', icon: Phone };
      case 'in-person':
        return { label: 'Atención presencial', icon: MapPin };
      default:
        return { label: modality, icon: MessageCircle };
    }
  };

  const modalityInfo = getModalityLabel(summary.modality);
  const ModalityIcon = modalityInfo.icon;
  const isImmediateChat = decision.type === 'IMMEDIATE_CHAT';
  const isInPerson = summary.modality === 'in-person';
  const hasScheduledTime = Boolean(summary.scheduledFor);

  const openConversation = () => navigation.navigate('Consultation', {
    conversationId: summary.conversationId,
  });

  const openAppointments = () => navigation.navigate('PatientMain', {
    screen: 'Appointments',
  });

  const handleNavigation = async (provider: 'GOOGLE_MAPS' | 'WAZE') => {
    if (!summary.inPersonDestination) return;
    try {
      await openExternalNavigation(provider, summary.inPersonDestination);
    } catch {
      showAlert(
        'No pudimos abrir la navegación',
        'Verifica que el servicio de mapas esté disponible e inténtalo nuevamente.'
      );
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Confirmación" showBrand={false} />
      <ScreenContainer edges={['bottom', 'left', 'right']} contentStyle={styles.content}>
        <View style={styles.successIconContainer}>
          <CheckCircle2
            size={IconSize.state}
            color={Colors.success}
            strokeWidth={IconStroke.emphasized}
          />
        </View>

        <Text style={[Typography.h2, styles.title]}>Propuesta aceptada</Text>
        <Text style={[Typography.body, styles.subtitle]}>
          {isImmediateChat
            ? 'El canal de conversación ya está disponible.'
            : isInPerson
              ? 'Ahora puedes coordinar la cita y consultar la ubicación.'
              : 'Revisa los detalles y coordina la atención con el profesional.'}
        </Text>

        <View style={styles.summaryCard}>
          <View style={styles.profileRow}>
            {summary.psychologistPhotoURL ? (
              <Image
                source={{ uri: summary.psychologistPhotoURL }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <UserRound
                  size={28}
                  color={Colors.primary}
                  strokeWidth={IconStroke.regular}
                />
              </View>
            )}

            <View style={styles.profileInfo}>
              <Text style={[Typography.h4, styles.name]}>
                {summary.psychologistName}
              </Text>
              {summary.psychologistSpecialty && (
                <Text style={[Typography.bodySmall, styles.specialty]}>
                  {summary.psychologistSpecialty}
                </Text>
              )}
              {typeof summary.psychologistRating === 'number' &&
                summary.psychologistRating > 0 && (
                  <View style={styles.ratingRow}>
                    <Star size={12} color={Colors.starFilled} fill={Colors.starFilled} />
                    <Text style={[Typography.caption, styles.ratingText]}>
                      {summary.psychologistRating.toFixed(1)}
                    </Text>
                  </View>
                )}
            </View>
          </View>

          <View style={styles.detailsBox}>
            <View style={styles.detailItem}>
              <Text style={[Typography.caption, styles.detailLabel]}>
                MODALIDAD
              </Text>
              <View style={styles.detailValueRow}>
                <ModalityIcon size={14} color={Colors.primary} />
                <Text style={[Typography.bodySmall, styles.detailValue]}>
                  {modalityInfo.label}
                </Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <Text style={[Typography.caption, styles.detailLabel]}>
                IMPORTE ACORDADO
              </Text>
              <Text style={[Typography.priceSm, styles.amountValue]}>
                {formatDecimalMoney(summary.amountDecimal, summary.currencyCode)}
              </Text>
            </View>

            {summary.scheduledFor && (
              <View style={styles.detailItem}>
                <Text style={[Typography.caption, styles.detailLabel]}>
                  FECHA Y HORA
                </Text>
                <View style={styles.detailValueRow}>
                  <Calendar size={14} color={Colors.primary} />
                  <Text style={[Typography.bodySmall, styles.detailValue]}>
                    {new Date(summary.scheduledFor).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}

            {isInPerson && summary.inPersonDestination ? (
              <View style={styles.locationDetail}>
                <Text style={[Typography.caption, styles.detailLabel]}>UBICACIÓN</Text>
                <View style={styles.detailValueRow}>
                  <MapPin size={14} color={Colors.primary} />
                  <View style={styles.locationCopy}>
                    <Text style={[Typography.bodySmall, styles.detailValue]}>
                      {summary.inPersonDestination.name}
                    </Text>
                    <Text style={[Typography.caption, styles.locationAddress]}>
                      {summary.inPersonDestination.address}
                    </Text>
                    {summary.inPersonDestination.directions ? (
                      <Text style={[Typography.caption, styles.locationDirections]}>
                        {summary.inPersonDestination.directions}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.actionsContainer}>
          {isImmediateChat && (
            <AppButton
              label="Iniciar conversación ahora"
              onPress={() => navigation.replace('Consultation', {
                conversationId: summary.conversationId,
              })}
              variant="primary"
              size="lg"
              fullWidth
              icon={<ArrowRight size={18} color={Colors.textInverse} />}
            />
          )}

          {isInPerson && summary.inPersonDestination ? (
            <>
              <AppButton
                label="Cómo llegar"
                onPress={() => void handleNavigation('GOOGLE_MAPS')}
                variant="primary"
                size="lg"
                fullWidth
                icon={<Navigation size={18} color={Colors.textInverse} />}
              />
              <AppButton
                label="Abrir en Waze"
                onPress={() => void handleNavigation('WAZE')}
                variant="outline"
                size="md"
                fullWidth
              />
            </>
          ) : null}

          {!isImmediateChat && !(isInPerson && summary.inPersonDestination) && (
            <AppButton
              label={isInPerson
                ? 'Coordinar ubicación'
                : hasScheduledTime
                  ? 'Ver mis citas'
                  : 'Coordinar llamada'}
              onPress={() => hasScheduledTime && !isInPerson
                ? openAppointments()
                : openConversation()}
              variant="primary"
              size="lg"
              fullWidth
            />
          )}

          <AppButton
            label={isImmediateChat || (isInPerson && !summary.inPersonDestination)
              ? 'Volver al inicio'
              : 'Coordinar detalles'}
            onPress={() => isImmediateChat || (isInPerson && !summary.inPersonDestination)
              ? navigation.navigate('PatientMain')
              : openConversation()}
            variant="outline"
            size="md"
            fullWidth
            style={styles.homeButton}
          />
        </View>
      </ScreenContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  successIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  title: {
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xxs,
  },
  subtitle: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: Spacing.xl,
    ...Shadow.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: Spacing.md,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    color: Colors.textPrimary,
  },
  specialty: {
    color: Colors.textSecondary,
    marginVertical: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: Colors.textTertiary,
  },
  detailsBox: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  detailItem: {},
  detailLabel: {
    color: Colors.textTertiary,
    fontSize: 11,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detailValue: {
    color: Colors.textPrimary,
  },
  locationDetail: {
    paddingTop: Spacing.xs,
  },
  locationCopy: {
    flex: 1,
    gap: 2,
  },
  locationAddress: {
    color: Colors.textSecondary,
  },
  locationDirections: {
    color: Colors.textTertiary,
  },
  amountValue: {
    color: Colors.primary,
  },
  actionsContainer: {
    width: '100%',
    gap: Spacing.sm,
  },
  homeButton: {
    marginTop: Spacing.xxs,
  },
});
