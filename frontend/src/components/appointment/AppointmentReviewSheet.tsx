import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Star, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useModalAccessibilityFocus } from '../../hooks/useModalAccessibilityFocus';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';
import type { Appointment } from '../../repositories/AppointmentRepository';
import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { AppButton } from '../common/AppButton';

interface AppointmentReviewSheetProps {
  readonly appointment: Appointment | null;
  readonly isSubmitting: boolean;
  readonly error: string | null;
  readonly onSubmit: (appointment: Appointment, rating: number, comment: string | null) => void;
  readonly onClose: () => void;
}

export function AppointmentReviewSheet({
  appointment,
  isSubmitting,
  error,
  onSubmit,
  onClose,
}: AppointmentReviewSheetProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const sheetRef = useRef<View>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  useModalAccessibilityFocus(sheetRef, Boolean(appointment));

  useEffect(() => {
    setRating(0);
    setComment('');
  }, [appointment]);

  return (
    <Modal
      visible={Boolean(appointment)}
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={isSubmitting ? () => undefined : onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={isSubmitting ? undefined : onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        {appointment ? (
          <View
            ref={sheetRef}
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}
            role="dialog"
            accessibilityViewIsModal
            accessibilityLabel="Calificar atención"
            collapsable={false}
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>¿Cómo fue tu atención?</Text>
                <Text style={styles.subtitle}>{appointment.counterpart.displayName}</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                disabled={isSubmitting}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Cerrar calificación"
              >
                <X size={IconSize.action} color={Colors.textSecondary} strokeWidth={IconStroke.regular} />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <View style={styles.ratingRow} accessibilityRole="radiogroup">
                {Array.from({ length: 5 }, (_, index) => {
                  const value = index + 1;
                  const selected = value <= rating;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setRating(value)}
                      disabled={isSubmitting}
                      style={styles.starButton}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: rating === value }}
                      aria-checked={rating === value}
                      accessibilityLabel={`${value} ${value === 1 ? 'estrella' : 'estrellas'}`}
                    >
                      <Star
                        size={32}
                        color={selected ? Colors.starFilled : Colors.starEmpty}
                        fill={selected ? Colors.starFilled : 'transparent'}
                        strokeWidth={IconStroke.regular}
                      />
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Comentario opcional</Text>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                  placeholder="Comparte una observación útil y respetuosa"
                  placeholderTextColor={Colors.textTertiary}
                  style={styles.commentInput}
                  accessibilityLabel="Comentario sobre la atención"
                />
                <Text style={styles.counter}>{comment.length}/1000</Text>
              </View>

              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

              <AppButton
                label="Enviar opinión"
                onPress={() => onSubmit(appointment, rating, comment.trim() || null)}
                disabled={rating === 0}
                isLoading={isSubmitting}
                fullWidth
                size="lg"
              />
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  sheet: {
    width: '100%', maxWidth: 600, alignSelf: 'center', paddingTop: Spacing.sm,
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    backgroundColor: Colors.surface, ...Shadow.lg,
  },
  handle: {
    width: 36, height: 4, alignSelf: 'center', borderRadius: BorderRadius.full,
    backgroundColor: Colors.borderStrong,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  headerCopy: { flex: 1 },
  title: { ...Typography.h3, color: Colors.textPrimary },
  subtitle: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.xxs },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.xl, gap: Spacing.lg },
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  starButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  fieldGroup: { gap: Spacing.xs },
  label: { ...Typography.label, color: Colors.textSecondary },
  commentInput: {
    ...Typography.body, minHeight: 120, padding: Spacing.md, borderWidth: 1,
    borderColor: Colors.border, borderRadius: BorderRadius.md,
    backgroundColor: Colors.background, color: Colors.textPrimary,
  },
  counter: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'right' },
  error: { ...Typography.bodySmall, color: Colors.error },
});
