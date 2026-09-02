import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Star, StarHalf } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import { IconStroke } from '../../theme/icons';

interface StarRatingProps {
  rating?: number;
  maxStars?: number;
  size?: number;
  showValue?: boolean;
  totalReviews?: number;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating = 5.0,
  maxStars = 5,
  size = 16,
  showValue = true,
  totalReviews,
}) => {
  const safeRating = typeof rating === 'number' && !isNaN(rating) ? rating : 5.0;

  return (
    <View style={styles.container}>
      {Array.from({ length: maxStars }, (_, index) => {
        const starValue = index + 1;
        if (safeRating >= starValue) {
          return (
            <Star
              key={index}
              size={size}
              strokeWidth={IconStroke.regular}
              color={Colors.starFilled}
              fill={Colors.starFilled}
            />
          );
        }
        if (safeRating >= starValue - 0.5) {
          return (
            <StarHalf
              key={index}
              size={size}
              strokeWidth={IconStroke.regular}
              color={Colors.starFilled}
              fill={Colors.starFilled}
            />
          );
        }
        return (
          <Star
            key={index}
            size={size}
            strokeWidth={IconStroke.regular}
            color={Colors.starEmpty}
          />
        );
      })}
      {showValue && (
        <Text style={[styles.value, { fontSize: size - 2 }]}>
          {safeRating.toFixed(1)}
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
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.textPrimary,
    marginLeft: Spacing.xs,
  },
  reviews: {
    fontFamily: FontFamily.bodyRegular,
    color: Colors.textSecondary,
  },
});
