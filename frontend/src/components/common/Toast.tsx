import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  TouchableOpacity,
} from 'react-native';
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Info,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';
import { IconSize, IconStroke } from '../../theme/icons';
import { MotionDuration } from '../../theme/motion';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';

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

const TOAST_ICONS: Record<ToastType, LucideIcon> = {
  error: CircleX,
  success: CircleCheck,
  info: Info,
  warning: CircleAlert,
};

const TOAST_COLORS: Record<ToastType, string> = {
  error: Colors.error,
  success: Colors.success,
  info: Colors.info,
  warning: Colors.warning,
};

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

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
  const reduceMotion = useReducedMotionPreference();

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 100,
        duration: reduceMotion ? 0 : MotionDuration.fast,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: reduceMotion ? 0 : MotionDuration.fast,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => onHide());
  }, [translateY, opacity, onHide, reduceMotion]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: reduceMotion ? 0 : MotionDuration.normal,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: reduceMotion ? 0 : MotionDuration.fast,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();

      const timer = setTimeout(hide, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, hide, reduceMotion, translateY, opacity]);

  if (!visible) return null;

  const accentColor = TOAST_COLORS[type];
  const StatusIcon = TOAST_ICONS[type];

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
      <StatusIcon size={IconSize.action} strokeWidth={IconStroke.regular} color={accentColor} />
      <Text style={styles.message} numberOfLines={2}>{message}</Text>
      <TouchableOpacity onPress={hide} style={styles.closeBtn} accessibilityLabel="Cerrar notificación">
        <X size={IconSize.inline} strokeWidth={IconStroke.regular} color={Colors.textTertiary} />
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    margin: -Spacing.md,
    marginLeft: 0,
  },
});
