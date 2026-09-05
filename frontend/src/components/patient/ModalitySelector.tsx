import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MapPin, MessageCircle, Phone, type LucideIcon } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing, Shadow } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import { IconSize, IconStroke } from '../../theme/icons';
import { Modality } from '../../models/Psychologist';

interface ModalityOption {
  key: Modality;
  label: string;
  icon: LucideIcon;
  description: string;
}

const MODALITIES: ModalityOption[] = [
  {
    key: 'chat',
    label: 'Chat',
    icon: MessageCircle,
    description: 'Texto seguro',
  },
  {
    key: 'call',
    label: 'Llamada',
    icon: Phone,
    description: 'Audio privado',
  },
  {
    key: 'in-person',
    label: 'Presencial',
    icon: MapPin,
    description: 'En consultorio',
  },
];

interface ModalitySelectorProps {
  selected: Modality;
  onSelect: (modality: Modality) => void;
}

export const ModalitySelector: React.FC<ModalitySelectorProps> = ({
  selected,
  onSelect,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>MODALIDAD DE SESIÓN</Text>
      <View style={styles.row}>
        {MODALITIES.map((option) => {
          const isActive = selected === option.key;
          const ModalityIcon = option.icon;
          return (
            <TouchableOpacity
              key={option.key}
              onPress={() => onSelect(option.key)}
              activeOpacity={0.85}
              style={[styles.chip, isActive && styles.chipActive]}
              accessibilityRole="radio"
              accessibilityState={{ checked: isActive }}
              aria-checked={isActive}
              accessibilityLabel={`${option.label}. ${option.description}`}
            >
              <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
                <ModalityIcon
                  size={IconSize.navigation}
                  strokeWidth={IconStroke.regular}
                  color={isActive ? Colors.textInverse : Colors.primary}
                />
              </View>
              <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                {option.label}
              </Text>
              <Text style={[styles.chipDesc, isActive && styles.chipDescActive]}>
                {option.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs + 2,
  },
  sectionLabel: {
    ...Typography.overline,
    color: Colors.textTertiary,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    ...Shadow.sm,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
  },
  iconContainerActive: {},
  chipLabel: {
    ...Typography.h4,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontSize: 14,
  },
  chipLabelActive: {
    color: Colors.textInverse,
    fontFamily: FontFamily.bodyBold,
  },
  chipDesc: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontSize: 11,
  },
  chipDescActive: {
    color: Colors.textOnBrandMuted,
  },
});
