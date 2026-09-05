import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { BadgeCheck, Star, UserRound } from 'lucide-react-native';

import { Psychologist } from '../../models/Psychologist';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { IconStroke } from '../../theme/icons';
import { formatDecimalMoney } from '../../utils/formatDecimalMoney';

interface ProfessionalCompactCardProps {
  readonly psychologist: Psychologist;
  readonly onPress: () => void;
  readonly isLast?: boolean;
}

export const ProfessionalCompactCard: React.FC<ProfessionalCompactCardProps> = ({
  psychologist,
  onPress,
  isLast = false,
}) => {
  const hasReviews = psychologist.totalReviews > 0;
  const specialtyName = psychologist.specialty || 'Psicología general';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      style={[styles.row, isLast && styles.lastRow]}
      accessibilityRole="button"
      accessibilityLabel={`Perfil de ${psychologist.displayName}, especialidad ${specialtyName}`}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {psychologist.photoURL ? (
          <Image source={{ uri: psychologist.photoURL }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <UserRound size={24} color={Colors.primary} strokeWidth={IconStroke.regular} />
          </View>
        )}
      </View>

      {/* Info central */}
      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={[Typography.h4, styles.name]} numberOfLines={1}>
            {psychologist.displayName}
          </Text>
          <BadgeCheck size={16} color={Colors.success} strokeWidth={IconStroke.emphasized} />
        </View>

        <Text style={[Typography.bodySmall, styles.specialty]} numberOfLines={1}>
          {specialtyName}
        </Text>

        {hasReviews ? (
          <View style={styles.ratingRow}>
            <Star size={13} color={Colors.starFilled} fill={Colors.starFilled} />
            <Text style={[Typography.caption, styles.ratingText]}>
              {psychologist.rating.toFixed(1)} · {psychologist.totalReviews}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Tarifa base */}
      <View style={styles.rateContainer}>
        <Text style={[Typography.priceSm, styles.rateText]}>
          {formatDecimalMoney(psychologist.pricePerHour, psychologist.currencyCode)}
        </Text>
        <Text style={[Typography.caption, styles.rateUnit]}>por hora</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    minHeight: 76,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  avatarContainer: {
    marginRight: Spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  name: {
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  specialty: {
    color: Colors.textSecondary,
    marginVertical: Spacing.xxs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  ratingText: {
    color: Colors.textTertiary,
  },
  rateContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: Spacing.sm,
  },
  rateText: {
    color: Colors.primary,
    fontSize: 15,
  },
  rateUnit: {
    color: Colors.textTertiary,
  },
});
