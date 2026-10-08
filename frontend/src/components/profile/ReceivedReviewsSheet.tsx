import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MessageSquareQuote, UserRound, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useModalAccessibilityFocus } from '../../hooks/useModalAccessibilityFocus';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';
import {
  fetchReceivedReviews,
  ReceivedReview,
} from '../../repositories/AppointmentRepository';
import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { presentUserError } from '../../utils/userFacingError';
import { AppButton } from '../common/AppButton';
import { StarRating } from '../common/StarRating';

interface ReceivedReviewsSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
}

export function ReceivedReviewsSheet({ visible, onClose }: ReceivedReviewsSheetProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const sheetRef = useRef<View>(null);
  const [items, setItems] = useState<readonly ReceivedReview[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useModalAccessibilityFocus(sheetRef, visible);

  const load = useCallback(async (cursor?: string, signal?: AbortSignal) => {
    cursor ? setIsLoadingMore(true) : setIsLoading(true);
    setError(null);
    try {
      const page = await fetchReceivedReviews(cursor, signal);
      setItems((current) => cursor ? [...current, ...page.data] : page.data);
      setNextCursor(page.meta.nextCursor);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === 'AbortError') return;
      setError(presentUserError(loadError, 'No pudimos cargar las opiniones.'));
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    void load(undefined, controller.signal);
    return () => controller.abort();
  }, [load, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View
          ref={sheetRef}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}
          role="dialog"
          accessibilityViewIsModal
          accessibilityLabel="Opiniones recibidas"
          collapsable={false}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <MessageSquareQuote size={IconSize.action} color={Colors.primary} strokeWidth={IconStroke.regular} />
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Opiniones recibidas</Text>
              <Text style={styles.subtitle}>Feedback de atenciones completadas.</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Cerrar opiniones"
            >
              <X size={IconSize.action} color={Colors.textSecondary} strokeWidth={IconStroke.regular} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.centered} accessibilityRole="progressbar">
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.supporting}>Cargando opiniones</Text>
            </View>
          ) : error && items.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.supporting}>{error}</Text>
              <AppButton label="Volver a intentar" variant="outline" onPress={() => void load()} />
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={({ id }) => id}
              contentContainerStyle={items.length ? styles.list : styles.emptyList}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <View style={styles.reviewRow}>
                  {item.patient.photoUrl ? (
                    <Image source={{ uri: item.patient.photoUrl }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <UserRound size={IconSize.action} color={Colors.primary} strokeWidth={IconStroke.regular} />
                    </View>
                  )}
                  <View style={styles.reviewCopy}>
                    <Text style={styles.patientName}>{item.patient.displayName}</Text>
                    <StarRating rating={item.rating} showValue={false} size={16} />
                    {item.comment ? <Text style={styles.comment}>{item.comment}</Text> : null}
                    <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={(
                <View style={styles.centered}>
                  <MessageSquareQuote size={40} color={Colors.textTertiary} strokeWidth={IconStroke.regular} />
                  <Text style={styles.emptyTitle}>Aún no hay opiniones</Text>
                  <Text style={styles.supporting}>Aparecerán después de atenciones completadas.</Text>
                </View>
              )}
              ListFooterComponent={nextCursor ? (
                <AppButton
                  label="Ver más"
                  variant="ghost"
                  isLoading={isLoadingMore}
                  onPress={() => void load(nextCursor)}
                />
              ) : null}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  sheet: {
    width: '100%', maxWidth: 680, height: '78%', alignSelf: 'center', paddingTop: Spacing.sm,
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    backgroundColor: Colors.surface, ...Shadow.lg,
  },
  handle: { width: 36, height: 4, alignSelf: 'center', borderRadius: BorderRadius.full, backgroundColor: Colors.borderStrong },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.base,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  headerCopy: { flex: 1 },
  title: { ...Typography.h3, color: Colors.textPrimary },
  subtitle: { ...Typography.caption, color: Colors.textSecondary, marginTop: Spacing.xxs },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  emptyList: { flexGrow: 1 },
  separator: { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: Spacing.base },
  reviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: BorderRadius.full },
  avatarFallback: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: BorderRadius.full, backgroundColor: Colors.primaryTint,
  },
  reviewCopy: { flex: 1, gap: Spacing.xs },
  patientName: { ...Typography.label, color: Colors.textPrimary },
  comment: { ...Typography.bodySmall, color: Colors.textSecondary },
  date: { ...Typography.caption, color: Colors.textTertiary },
  centered: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  emptyTitle: { ...Typography.h4, color: Colors.textPrimary },
  supporting: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'center' },
});
