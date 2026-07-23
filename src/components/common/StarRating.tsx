import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: number;
  showValue?: boolean;
  totalReviews?: number;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxStars = 5,
  size = 16,
  showValue = true,
  totalReviews,
}) => {
  const stars = Array.from({ length: maxStars }, (_, i) => {
    const starValue = i + 1;
    if (rating >= starValue) return 'star';
    if (rating >= starValue - 0.5) return 'star-half';
    return 'star-border';
  });

  return (
    <View style={styles.container}>
      {stars.map((iconName, i) => (
        <MaterialIcons
          key={i}
          name={iconName as any}
          size={size}
          color={Colors.starFilled}
        />
      ))}
      {showValue && (
        <Text style={[styles.value, { fontSize: size - 2 }]}>
          {rating.toFixed(1)}
          {totalReviews !== undefined && (
            <Text style={styles.reviews}> ({totalReviews})</Text>
          )}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  value: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginLeft: Spacing.xs,
  },
  reviews: {
    color: Colors.textSecondary,
    fontWeight: '400',
  },
});
