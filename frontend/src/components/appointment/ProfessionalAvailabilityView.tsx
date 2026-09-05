import React, { useMemo } from 'react';
import { Clock3, PencilLine } from 'lucide-react-native';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AppButton } from '../common/AppButton';
import type { WeeklyAvailabilityRule } from '../../models/ProfessionalProfile';
import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import {
  formatAvailabilityInterval,
  groupAvailabilityRules,
  WEEKDAY_LABELS,
} from '../../utils/availability';
import { shouldStackInteractiveContent } from '../../utils/responsiveLayout';

interface ProfessionalAvailabilityViewProps {
  readonly timezone: string;
  readonly rules: readonly WeeklyAvailabilityRule[];
  readonly onEdit: () => void;
}

export const ProfessionalAvailabilityView: React.FC<ProfessionalAvailabilityViewProps> = ({
  timezone,
  rules,
  onEdit,
}) => {
  const { fontScale, width } = useWindowDimensions();
  const shouldStackFooter = shouldStackInteractiveContent(width, fontScale);
  const groupedRules = useMemo(() => groupAvailabilityRules(rules), [rules]);
  const availableDays = groupedRules.size;

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <View style={styles.iconBox}>
          <Clock3
            size={IconSize.state}
            strokeWidth={IconStroke.regular}
            color={Colors.primary}
          />
        </View>
        <Text style={styles.title}>Tu semana de atención</Text>
        <Text style={styles.description}>
          Estos intervalos determinan los horarios que pueden reservar tus pacientes.
        </Text>
        <Text style={styles.timezone}>{timezone}</Text>
      </View>

      <View style={styles.schedule}>
        {WEEKDAY_LABELS.map((label, weekday) => {
          const dayRules = groupedRules.get(weekday) ?? [];
          return (
            <View key={label} style={styles.dayRow}>
              <Text style={styles.dayLabel}>{label}</Text>
              <View style={styles.intervals}>
                {dayRules.length > 0 ? dayRules.map((rule, index) => (
                  <Text key={`${rule.startTime}-${rule.endTime}-${index}`} style={styles.interval}>
                    {formatAvailabilityInterval(rule)}
                  </Text>
                )) : (
                  <Text style={styles.unavailable}>No disponible</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <View style={[styles.footer, shouldStackFooter && styles.footerStacked]}>
        <Text style={styles.summary}>
          {availableDays === 1 ? '1 día disponible' : `${availableDays} días disponibles`}
        </Text>
        <AppButton
          label="Editar horarios"
          onPress={onEdit}
          variant="outline"
          fullWidth={shouldStackFooter}
          icon={(
            <PencilLine
              size={IconSize.action}
              strokeWidth={IconStroke.regular}
              color={Colors.primary}
            />
          )}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
  },
  intro: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    maxWidth: 420,
  },
  timezone: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.md,
  },
  schedule: {
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
  },
  dayRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    gap: Spacing.base,
  },
  dayLabel: {
    ...Typography.bodySmall,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.textPrimary,
    width: 88,
  },
  intervals: {
    flex: 1,
    alignItems: 'flex-end',
    paddingVertical: Spacing.sm,
    gap: Spacing.xxs,
  },
  interval: {
    ...Typography.bodySmall,
    color: Colors.primary,
  },
  unavailable: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  footer: {
    marginTop: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  footerStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  summary: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
});
