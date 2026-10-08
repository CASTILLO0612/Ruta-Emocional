import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { CircleAlert, RefreshCw } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { IconSize, IconStroke } from '../../theme/icons';

interface ErrorBoundaryState {
  hasError: boolean;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (__DEV__) console.error('[ErrorBoundary]', error.name, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>;

      return (
        <View style={styles.root}>
          <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
          <View style={styles.iconWrapper}>
            <CircleAlert size={40} strokeWidth={IconStroke.regular} color={Colors.error} />
          </View>
          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.subtitle}>
            No pudimos mostrar esta pantalla. Inténtalo nuevamente.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={this.handleRetry}>
            <RefreshCw size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.textInverse} />
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return <>{this.props.children}</>;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.md,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.errorFaded,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    minHeight: 48,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  retryText: {
    ...Typography.button,
    color: Colors.textInverse,
  },
});
