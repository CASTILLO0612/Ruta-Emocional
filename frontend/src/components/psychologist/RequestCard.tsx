import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  CalendarClock,
  CircleHelp,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react-native';

import { AppButton } from '../common/AppButton';
import type { ActiveRequest } from '../../models/ActiveRequest';
import type { Modality } from '../../models/Psychologist';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import { IconSize, IconStroke } from '../../theme/icons';
import { formatMoney } from '../../utils/money';
import { formatModalityLabel } from '../../utils/modality';
import {
  formatRequestAge,
  formatRequestedMoment,
  getRequestDisplayTitle,
} from '../../utils/requestPresentation';
import { shouldStackInteractiveContent } from '../../utils/responsiveLayout';

const MODALITY_ICONS: Record<Modality, LucideIcon> = {
  chat: MessageCircle,
  call: Phone,
  'in-person': MapPin,
};

interface RequestCardProps {
  readonly request: ActiveRequest;
  readonly isSubmitting?: boolean;
  readonly onOfferProposedAmount: (request: ActiveRequest) => void;
  readonly onAdjustRate: (request: ActiveRequest) => void;
}

export const RequestCard: React.FC<RequestCardProps> = ({
  request,
  isSubmitting = false,
  onOfferProposedAmount,
  onAdjustRate,
}) => {
  const { fontScale, width } = useWindowDimensions();
  const ModalityIcon = MODALITY_ICONS[request.modality] ?? CircleHelp;
  const amountLabel = formatMoney(request.proposedBudget, request.currencyCode);
  const shouldStackActions = shouldStackInteractiveContent(width, fontScale);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.modalityBadge}>
          <ModalityIcon
            size={IconSize.inline}
            strokeWidth={IconStroke.regular}
            color={Colors.primary}
          />
          <Text style={styles.modalityText}>{formatModalityLabel(request.modality)}</Text>
        </View>
        <Text style={styles.age}>{formatRequestAge(request.createdAt)}</Text>
      </View>

      <View style={styles.summary}>
        <Text style={styles.title}>{getRequestDisplayTitle(request)}</Text>
      </View>

      <View style={styles.contextRow}>
        <CalendarClock
          size={IconSize.inline}
          strokeWidth={IconStroke.regular}
          color={Colors.textTertiary}
        />
        <Text style={styles.contextText}>{formatRequestedMoment(request)}</Text>
      </View>

      <View style={[styles.offerSummary, shouldStackActions && styles.offerSummaryStacked]}>
        <View>
          <Text style={styles.offerLabel}>Presupuesto propuesto</Text>
          <Text style={styles.offerAmount}>{amountLabel}</Text>
        </View>
        <View style={styles.privacyBadge}>
          <ShieldCheck
            size={IconSize.inline}
            strokeWidth={IconStroke.regular}
            color={Colors.success}
          />
          <Text style={styles.privacyText}>Identidad protegida</Text>
        </View>
      </View>

      <View style={[styles.actions, shouldStackActions && styles.actionsStacked]}>
        <AppButton
          label="Cambiar tarifa"
          onPress={() => onAdjustRate(request)}
          variant="outline"
          size="sm"
          disabled={isSubmitting}
          style={shouldStackActions ? styles.actionStacked : styles.action}
          accessibilityHint="Permite proponer un importe diferente al presupuesto del paciente"
        />
        <AppButton
          label="Enviar oferta"
          onPress={() => onOfferProposedAmount(request)}
          size="sm"
          disabled={isSubmitting}
          style={shouldStackActions ? styles.actionStacked : styles.action}
          accessibilityLabel={`Enviar oferta por ${amountLabel}`}
          accessibilityHint="El paciente deberá aceptar la oferta para iniciar la atención"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  modalityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryTint,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  modalityText: {
    ...Typography.caption,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.primary,
  },
  age: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  summary: {
    gap: Spacing.xs,
  },
  title: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  contextText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  offerSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  offerSummaryStacked: {
    alignItems: 'flex-start',
  },
  offerLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  offerAmount: {
    ...Typography.priceSm,
    color: Colors.primary,
    marginTop: Spacing.xxs,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexShrink: 1,
  },
  privacyText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionsStacked: {
    flexDirection: 'column',
  },
  action: {
    flex: 1,
  },
  actionStacked: {
    width: '100%',
  },
});
