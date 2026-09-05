import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppButton } from '../common/AppButton';
import { AppointmentModalityIcon } from './AppointmentModalityIcon';
import type {
  Appointment,
  AppointmentStatus,
} from '../../repositories/AppointmentRepository';
import type { UserRole } from '../../services/AuthService';
import { Colors } from '../../theme/colors';
import { IconSize } from '../../theme/icons';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import {
  APPOINTMENT_STATUS_LABELS,
  AppointmentAction,
  formatAppointmentDate,
  formatAppointmentTimeZone,
  getAppointmentActionPlan,
} from '../../utils/appointmentPresentation';
import { shouldStackInteractiveContent } from '../../utils/responsiveLayout';
import { formatModalityLabel } from '../../utils/modality';

const STATUS_COLORS: Record<AppointmentStatus, { readonly background: string; readonly text: string }> = {
  SCHEDULED: { background: Colors.primaryTint, text: Colors.primary },
  CONFIRMED: { background: Colors.successSurface, text: Colors.success },
  IN_PROGRESS: { background: Colors.infoSurface, text: Colors.info },
  COMPLETED: { background: Colors.surfaceMuted, text: Colors.textSecondary },
  CANCELLED: { background: Colors.errorSurface, text: Colors.error },
  NO_SHOW: { background: Colors.warningSurface, text: Colors.warning },
};

interface AppointmentCardProps {
  readonly appointment: Appointment;
  readonly role: UserRole | null;
  readonly isBusy: boolean;
  readonly onPrimaryAction: (appointment: Appointment, action: AppointmentAction) => void;
  readonly onOpenOptions: (appointment: Appointment) => void;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  role,
  isBusy,
  onPrimaryAction,
  onOpenOptions,
}) => {
  const { fontScale, width } = useWindowDimensions();
  const shouldStackActions = shouldStackInteractiveContent(width, fontScale);
  const statusColors = STATUS_COLORS[appointment.status];
  const actionPlan = getAppointmentActionPlan(appointment, role);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.modalityIcon}>
          <AppointmentModalityIcon
            modality={appointment.modality}
            size={IconSize.action}
            color={Colors.primary}
          />
        </View>
        <View style={styles.identity}>
          <Text style={styles.counterpart} numberOfLines={1}>
            {appointment.counterpart.displayName}
          </Text>
          <Text style={styles.date}>
            {formatAppointmentDate(appointment.startsAt, appointment.timezone)}
          </Text>
        </View>
        <View style={[styles.status, { backgroundColor: statusColors.background }]}>
          <Text style={[styles.statusText, { color: statusColors.text }]}>
            {APPOINTMENT_STATUS_LABELS[appointment.status]}
          </Text>
        </View>
      </View>

      <View style={styles.metadata}>
        <Text style={styles.metadataText}>{formatModalityLabel(appointment.modality)}</Text>
        <View style={styles.metadataDot} />
        <Text style={styles.metadataText}>
          {formatAppointmentTimeZone(appointment.startsAt, appointment.timezone)}
        </Text>
      </View>

      {appointment.cancellationReason ? (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Motivo registrado</Text>
          <Text style={styles.reasonText}>{appointment.cancellationReason}</Text>
        </View>
      ) : null}

      {actionPlan.primary || actionPlan.secondary.length > 0 ? (
        <View style={[styles.actions, shouldStackActions && styles.actionsStacked]}>
          {actionPlan.secondary.length > 0 ? (
            <AppButton
              label="Opciones"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onPress={() => onOpenOptions(appointment)}
              style={shouldStackActions ? styles.actionStacked : styles.secondaryAction}
              accessibilityHint="Muestra las opciones secundarias disponibles para esta cita"
            />
          ) : null}
          {actionPlan.primary ? (
            <AppButton
              label={actionPlan.primary.label}
              variant={
                actionPlan.primary.type === 'transition'
                && actionPlan.primary.transition === 'NO_SHOW'
                  ? 'outline'
                  : 'primary'
              }
              size="sm"
              isLoading={isBusy}
              onPress={() => onPrimaryAction(appointment, actionPlan.primary!)}
              style={shouldStackActions ? styles.actionStacked : styles.primaryAction}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  modalityIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  counterpart: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  date: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  status: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    flexShrink: 1,
  },
  statusText: {
    ...Typography.caption,
    fontFamily: FontFamily.bodySemiBold,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginLeft: 56,
  },
  metadataText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  metadataDot: {
    width: 3,
    height: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.textTertiary,
  },
  reasonBox: {
    marginLeft: 56,
    borderLeftWidth: 2,
    borderLeftColor: Colors.errorBorder,
    paddingLeft: Spacing.sm,
    gap: Spacing.xxs,
  },
  reasonLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.textTertiary,
  },
  reasonText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  actionsStacked: {
    flexDirection: 'column-reverse',
  },
  primaryAction: {
    flex: 1,
  },
  secondaryAction: {
    flex: 1,
  },
  actionStacked: {
    width: '100%',
  },
});
