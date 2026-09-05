import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { CalendarClock, Clock3, Globe2 } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import {
  normalizeDateInput,
  normalizeTimeInput,
  parseLocalSchedule,
  validateScheduledDate,
} from '../../utils/schedule';
import { getDeviceTimeZone } from '../../config/localization';

interface ScheduleDateTimeInputProps {
  readonly value?: Date;
  readonly leadMinutes: number;
  readonly maximumScheduleDays: number;
  readonly onChange: (value?: Date) => void;
}

function initialDateValue(value?: Date): string {
  if (!value) return '';
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${value.getFullYear()}`;
}

function initialTimeValue(value?: Date): string {
  if (!value) return '';
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

export const ScheduleDateTimeInput: React.FC<ScheduleDateTimeInputProps> = ({
  value,
  leadMinutes,
  maximumScheduleDays,
  onChange,
}) => {
  const [dateInput, setDateInput] = useState(() => initialDateValue(value));
  const [timeInput, setTimeInput] = useState(() => initialTimeValue(value));
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const timezone = useMemo(getDeviceTimeZone, []);

  useEffect(() => {
    const isComplete = dateInput.length === 10 && timeInput.length === 5;
    if (!isComplete) {
      setValidationMessage(null);
      onChange(undefined);
      return;
    }

    const scheduledFor = parseLocalSchedule(dateInput, timeInput);
    if (!scheduledFor) {
      setValidationMessage('Revisa la fecha y la hora ingresadas.');
      onChange(undefined);
      return;
    }

    const validation = validateScheduledDate(scheduledFor, {
      leadMinutes,
      maximumScheduleDays,
    });
    if (!validation.isValid) {
      setValidationMessage(validation.message);
      onChange(undefined);
      return;
    }

    setValidationMessage(null);
    onChange(scheduledFor);
  }, [dateInput, leadMinutes, maximumScheduleDays, onChange, timeInput]);

  return (
    <View style={styles.container}>
      <View style={styles.fieldsRow}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>FECHA</Text>
          <View style={[styles.inputShell, validationMessage && styles.inputShellError]}>
            <CalendarClock
              size={IconSize.inline}
              color={Colors.textTertiary}
              strokeWidth={IconStroke.regular}
            />
            <TextInput
              value={dateInput}
              onChangeText={(text) => setDateInput(normalizeDateInput(text))}
              style={styles.input}
              keyboardType="number-pad"
              placeholder="DD/MM/AAAA"
              placeholderTextColor={Colors.textDisabled}
              maxLength={10}
              accessibilityLabel="Fecha de la atención programada"
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>HORA</Text>
          <View style={[styles.inputShell, validationMessage && styles.inputShellError]}>
            <Clock3
              size={IconSize.inline}
              color={Colors.textTertiary}
              strokeWidth={IconStroke.regular}
            />
            <TextInput
              value={timeInput}
              onChangeText={(text) => setTimeInput(normalizeTimeInput(text))}
              style={styles.input}
              keyboardType="number-pad"
              placeholder="HH:MM"
              placeholderTextColor={Colors.textDisabled}
              maxLength={5}
              accessibilityLabel="Hora de la atención programada"
            />
          </View>
        </View>
      </View>

      {validationMessage ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {validationMessage}
        </Text>
      ) : (
        <View style={styles.timezoneRow}>
          <Globe2
            size={IconSize.inline}
            color={Colors.textTertiary}
            strokeWidth={IconStroke.regular}
          />
          <Text style={styles.timezoneText}>
            {timezone ? `Zona horaria del dispositivo: ${timezone}` : 'Se usará la zona horaria del dispositivo.'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  fieldsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  fieldGroup: {
    flex: 1,
    gap: Spacing.xs,
  },
  label: {
    ...Typography.overline,
    color: Colors.textTertiary,
  },
  inputShell: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
  },
  inputShellError: {
    borderColor: Colors.error,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bodyMedium,
    paddingVertical: Spacing.sm,
  },
  timezoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  timezoneText: {
    flex: 1,
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
  },
});
