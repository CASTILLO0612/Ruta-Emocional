import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevation?: 'sm' | 'md' | 'lg' | 'xl';
  padding?: number;
  noPadding?: boolean;
}

export const AppCard: React.FC<AppCardProps> = ({
  children,
  style,
  elevation = 'md',
  padding = Spacing.base,
  noPadding = false,
}) => {
  return (
    <View
      style={[
        styles.card,
        Shadow[elevation],
        !noPadding && { padding },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
});
