import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';

export type ToastType = 'error' | 'success' | 'info' | 'warning';

interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss?: () => void;
}

interface ToastProps extends ToastConfig {
  visible: boolean;
  onHide: () => void;
}

const TOAST_ICONS: Record<ToastType, keyof typeof MaterialIcons.glyphMap> = {
  error: 'error-outline',
  success: 'check-circle-outline',
  info: 'info-outline',
  warning: 'warning-amber',
};

const TOAST_COLORS: Record<ToastType, string> = {
  error: Colors.error,
  success: Colors.accent,
  info: Colors.info,
  warning: Colors.warning,
};

/** Toast no-intrusivo tipo iOS — aparece abajo y desaparece solo */
export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type = 'error',
  duration = 3500,
  onHide,
}) => {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 100, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => onHide());
  }, [translateY, opacity, onHide]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(hide, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, hide, translateY, opacity]);

  if (!visible) return null;

  const accentColor = TOAST_COLORS[type];

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }], opacity },
        { borderLeftColor: accentColor },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <MaterialIcons name={TOAST_ICONS[type]} size={18} color={accentColor} />
      <Text style={styles.message} numberOfLines={2}>{message}</Text>
      <TouchableOpacity onPress={hide} style={styles.closeBtn} accessibilityLabel="Cerrar notificación">
        <MaterialIcons name="close" size={14} color={Colors.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
};

/** Hook sencillo para manejar el estado del Toast */
export function useToast() {
  const [toastConfig, setToastConfig] = React.useState<ToastConfig & { visible: boolean }>({
    visible: false,
    message: '',
    type: 'error',
  });

  const showToast = useCallback((message: string, type: ToastType = 'error', duration = 3500) => {
    setToastConfig({ visible: true, message, type, duration });
  }, []);

  const hideToast = useCallback(() => {
    setToastConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  return { toastConfig, showToast, hideToast };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: Spacing.base,
    right: Spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    borderLeftWidth: 4,
    zIndex: 9999,
    ...Shadow.lg,
  },
  message: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
});
