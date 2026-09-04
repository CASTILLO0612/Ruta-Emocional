/**
 * ActiveSearchSummary — Resumen de solicitud activa para la pestaña Buscar.
 *
 * Se muestra dentro de SearchTabScreen cuando el paciente ya tiene una
 * solicitud en estado PENDING o BIDDING. Proporciona visibilidad del estado
 * y un botón primario para abrir RadarScreen en el AppStack raíz,
 * impidiendo la duplicación de solicitudes o la renderización anidada de Radar.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Radar, Clock, DollarSign, MessageSquare, Phone, MapPin, Sparkles } from 'lucide-react-native';

import { ActiveRequest } from '../../models/ActiveRequest';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';
import { IconSize, IconStroke } from '../../theme/icons';
import { AppButton } from '../common/AppButton';
import { formatMoney } from '../../utils/money';

interface ActiveSearchSummaryProps {
  readonly request: ActiveRequest;
  readonly onOpenRadar: () => void;
  readonly incomingOfferCount?: number;
}

export const ActiveSearchSummary: React.FC<ActiveSearchSummaryProps> = ({
  request,
  onOpenRadar,
  incomingOfferCount = 0,
}) => {
  const getModalityLabel = (modality: string) => {
    switch (modality) {
      case 'chat':
        return { label: 'Chat en línea', icon: MessageSquare };
      case 'call':
        return { label: 'Llamada de voz', icon: Phone };
      case 'in-person':
        return { label: 'Atención presencial', icon: MapPin };
      default:
        return { label: modality, icon: MessageSquare };
    }
  };

  const modalityInfo = getModalityLabel(request.modality);
  const ModalityIcon = modalityInfo.icon;
  const hasOffers = incomingOfferCount > 0;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Encabezado del estado */}
        <View style={styles.header}>
          <View style={styles.radarIconContainer}>
            <Radar
              size={IconSize.action}
              color={Colors.primary}
              strokeWidth={IconStroke.emphasized}
            />
          </View>
          <View style={styles.statusTextContainer}>
            <Text style={[Typography.h4, styles.title]}>
              Búsqueda en curso
            </Text>
            <Text style={[Typography.bodySmall, styles.subtitle]}>
              {hasOffers
                ? `${incomingOfferCount} oferta(s) esperando tu decisión`
                : 'Tu solicitud está publicada. Te avisaremos si recibes una oferta.'}
            </Text>
          </View>
        </View>

        {/* Detalles de la solicitud */}
        <View style={styles.detailsContainer}>
          {request.primaryNeed && (
            <View style={styles.detailRow}>
              <Text style={[Typography.caption, styles.detailLabel]}>
                NECESIDAD PRINCIPAL
              </Text>
              <Text style={[Typography.body, styles.detailValue]}>
                {request.primaryNeed}
              </Text>
            </View>
          )}

          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <ModalityIcon
                size={IconSize.inline}
                color={Colors.primary}
                strokeWidth={IconStroke.regular}
              />
              <Text style={[Typography.bodySmall, styles.metaBadgeText]}>
                {modalityInfo.label}
              </Text>
            </View>

            <View style={styles.metaBadge}>
              <DollarSign
                size={IconSize.inline}
                color={Colors.primary}
                strokeWidth={IconStroke.regular}
              />
              <Text style={[Typography.bodySmall, styles.metaBadgeText]}>
                {formatMoney(request.proposedBudget, request.currencyCode)}
              </Text>
            </View>

            <View style={styles.metaBadge}>
              <Clock
                size={IconSize.inline}
                color={Colors.textTertiary}
                strokeWidth={IconStroke.regular}
              />
              <Text style={[Typography.bodySmall, styles.metaBadgeText]}>
                {request.scheduledFor ? 'Programada' : 'Inmediata'}
              </Text>
            </View>
          </View>
        </View>

        {/* Acción principal: abrir Radar en AppStack */}
        <View style={styles.actionContainer}>
          <AppButton
            label={hasOffers ? `Ver ofertas (${incomingOfferCount})` : 'Ver búsqueda en Radar'}
            onPress={onOpenRadar}
            variant="primary"
            size="md"
            fullWidth
            icon={hasOffers ? <Sparkles size={IconSize.inline} color={Colors.textInverse} /> : undefined}
            accessibilityLabel="Abrir pantalla de búsqueda y ofertas"
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.base,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadow.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  radarIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTextContainer: {
    flex: 1,
  },
  title: {
    color: Colors.textPrimary,
  },
  subtitle: {
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  detailsContainer: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  detailRow: {},
  detailLabel: {
    color: Colors.textTertiary,
    marginBottom: Spacing.xxs,
  },
  detailValue: {
    color: Colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: Spacing.xs,
  },
  metaBadgeText: {
    color: Colors.textPrimary,
    fontSize: 13,
  },
  actionContainer: {
    marginTop: Spacing.xs,
  },
});
