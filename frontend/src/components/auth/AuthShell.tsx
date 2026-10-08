import React, { PropsWithChildren, useEffect, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../common/BrandLogo';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';
import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { Layout } from '../../theme/layout';
import { MotionDuration } from '../../theme/motion';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

interface AuthShellProps extends PropsWithChildren {
  readonly title: string;
  readonly subtitle?: string;
  readonly onBack?: () => void;
  readonly footer?: React.ReactNode;
  readonly overlay?: React.ReactNode;
}

export const AuthShell: React.FC<AuthShellProps> = ({
  title,
  subtitle,
  onBack,
  footer,
  overlay,
  children,
}) => {
  const reduceMotion = useReducedMotionPreference();
  const { width } = useWindowDimensions();
  const compact = width <= Layout.compactWidth;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: reduceMotion ? 0 : MotionDuration.normal,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: reduceMotion ? 0 : MotionDuration.normal,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [opacity, reduceMotion, translateY]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <View style={[styles.brandHeader, compact && styles.brandHeaderCompact]}>
        <SafeAreaView edges={['top']}>
          <View style={styles.brandContent}>
            <BrandLogo size="compact" variant="negative" />
          </View>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.content, { opacity, transform: [{ translateY }] }]}>
            {onBack ? (
              <TouchableOpacity
                onPress={onBack}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Volver"
              >
                <ChevronLeft
                  size={IconSize.action}
                  strokeWidth={IconStroke.emphasized}
                  color={Colors.primary}
                />
                <Text style={styles.backText}>Volver</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.heading}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>

            {children}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      {overlay}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  brandHeader: {
    minHeight: 112,
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingBottom: Spacing.sm,
  },
  brandHeaderCompact: { minHeight: 104, paddingBottom: Spacing.xs },
  brandContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    gap: Spacing.base,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: Spacing.xl,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: Layout.minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginLeft: -Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  backText: { ...Typography.bodySmall, color: Colors.primary },
  heading: { gap: Spacing.xs },
  title: { ...Typography.h1, color: Colors.textPrimary },
  subtitle: { ...Typography.body, color: Colors.textSecondary },
});
