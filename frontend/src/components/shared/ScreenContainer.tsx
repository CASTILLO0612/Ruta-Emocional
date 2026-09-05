import React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
  ScrollViewProps,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';

import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

interface ScreenContainerProps extends Omit<ScrollViewProps, 'style'> {
  readonly children: React.ReactNode;
  readonly edges?: Edge[];
  readonly contentStyle?: ViewStyle;
  readonly backgroundColor?: string;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  edges = ['top', 'bottom', 'left', 'right'],
  contentStyle,
  backgroundColor = Colors.background,
  ...scrollProps
}) => (
  <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={edges}>
    <ScrollView
      {...scrollProps}
      style={styles.scroll}
      contentContainerStyle={[styles.content, contentStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  </SafeAreaView>
);

interface ScreenListContainerProps {
  readonly children: React.ReactNode;
  readonly edges?: Edge[];
  readonly backgroundColor?: string;
  readonly style?: ViewStyle;
}

export const ScreenListContainer: React.FC<ScreenListContainerProps> = ({
  children,
  edges = ['top', 'bottom', 'left', 'right'],
  backgroundColor = Colors.background,
  style,
}) => (
  <SafeAreaView
    style={[styles.safeArea, { backgroundColor }, style]}
    edges={edges}
  >
    <View style={styles.flex}>{children}</View>
  </SafeAreaView>
);

import { KeyboardAvoidingView, Platform } from 'react-native';

interface KeyboardScreenContainerProps {
  readonly children: React.ReactNode;
  readonly edges?: Edge[];
  readonly backgroundColor?: string;
  readonly contentStyle?: ViewStyle;
}

export const KeyboardScreenContainer: React.FC<
  KeyboardScreenContainerProps
> = ({
  children,
  edges = ['top', 'bottom', 'left', 'right'],
  backgroundColor = Colors.background,
  contentStyle,
}) => (
  <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={edges}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xxl,
  },
  flex: {
    flex: 1,
  },
});
