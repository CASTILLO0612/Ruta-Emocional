import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BadgeCheck,
  CircleCheckBig,
  CircleX,
  ListChecks,
  LogOut,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import {
  decideVerification,
  getPendingVerifications,
  VerificationQueueItem,
} from '../../repositories/AdminVerificationRepository';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import { showAlert } from '../../utils/alert';

const REJECTION_REASON_MIN_LENGTH = 10;

interface ReviewCardProps {
  readonly item: VerificationQueueItem;
  readonly onDecided: (submissionId: string) => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ item, onDecided }) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const evidenceName = item.evidenceObjectKey.split('/').pop() ?? 'Evidencia privada';

  const submitDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    const normalizedReason = reason.trim();
    if (decision === 'REJECTED' && normalizedReason.length < REJECTION_REASON_MIN_LENGTH) {
      showAlert(
        'Motivo requerido',
        `Explica la corrección necesaria con al menos ${REJECTION_REASON_MIN_LENGTH} caracteres.`
      );
      return;
    }
    setIsSubmitting(true);
    try {
      await decideVerification({
        submissionId: item.submissionId,
        decision,
        ...(decision === 'REJECTED' ? { publicReason: normalizedReason } : {}),
      });
      onDecided(item.submissionId);
      showAlert(
        decision === 'APPROVED' ? 'Profesional aprobado' : 'Corrección solicitada',
        decision === 'APPROVED'
          ? 'El acceso profesional fue habilitado y la decisión quedó auditada.'
          : 'El profesional recibirá el motivo indicado.'
      );
    } catch (error) {
      showAlert(
        'No pudimos registrar la decisión',
        error instanceof Error ? error.message : 'Inténtalo nuevamente.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.reviewCard}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <UserRound size={24} color={Colors.primary} strokeWidth={1.9} />
        </View>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.professionalName}>{item.psychologistName}</Text>
          <Text style={styles.licenseText}>{item.license.authority} · {item.license.number}</Text>
        </View>
      </View>

      <View style={styles.evidenceRow}>
        <BadgeCheck size={20} color={Colors.primary} strokeWidth={1.9} />
        <View style={styles.evidenceCopy}>
          <Text style={styles.evidenceLabel}>Evidencia privada recibida</Text>
          <Text style={styles.evidenceName} numberOfLines={1}>{evidenceName}</Text>
          <Text style={styles.dateText}>
            {new Date(item.submittedAt).toLocaleString()}
          </Text>
        </View>
      </View>

      <TextInput
        style={[styles.input, styles.reasonInput]}
        value={reason}
        onChangeText={setReason}
        placeholder="Motivo público si solicitas una corrección"
        multiline
        maxLength={500}
        accessibilityLabel="Motivo de corrección"
      />

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.rejectButton, isSubmitting && styles.disabledButton]}
          onPress={() => void submitDecision('REJECTED')}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={`Solicitar corrección a ${item.psychologistName}`}
        >
          <CircleX size={19} color={Colors.error} strokeWidth={2} />
          <Text style={styles.rejectButtonText}>Solicitar corrección</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.approveButton, isSubmitting && styles.disabledButton]}
          onPress={() => void submitDecision('APPROVED')}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={`Aprobar a ${item.psychologistName}`}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <>
              <CircleCheckBig size={19} color={Colors.textInverse} strokeWidth={2} />
              <Text style={styles.approveButtonText}>Aprobar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const VerificationQueueScreen: React.FC = () => {
  const userProfile = useAuthStore((state) => state.userProfile);
  const signOut = useAuthStore((state) => state.signOut);
  const [items, setItems] = useState<readonly VerificationQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const loadQueue = useCallback(async (signal?: AbortSignal) => {
    const response = await getPendingVerifications(signal);
    setItems(response.data);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadQueue(controller.signal)
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        showAlert(
          'No pudimos cargar las verificaciones',
          error instanceof Error ? error.message : 'Inténtalo nuevamente.'
        );
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [loadQueue]);

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await loadQueue();
    } catch (error) {
      showAlert(
        'No pudimos actualizar la cola',
        error instanceof Error ? error.message : 'Inténtalo nuevamente.'
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void refresh()} />}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <ShieldCheck size={30} color={Colors.primary} strokeWidth={1.8} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.overline}>Administración local</Text>
            <Text style={styles.title}>Verificación profesional</Text>
            <Text style={styles.subtitle}>
              Revisa solicitudes pendientes. Cada decisión conserva actor, fecha y auditoría.
            </Text>
          </View>
        </View>

        <View style={styles.sessionCard}>
          <Text style={styles.sessionLabel}>Sesión administrativa</Text>
          <Text style={styles.sessionName}>{userProfile?.displayName}</Text>
          <Text style={styles.sessionEmail}>{userProfile?.email}</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.primary} />
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <ListChecks size={40} color={Colors.success} strokeWidth={1.7} />
            <Text style={styles.emptyTitle}>Sin solicitudes pendientes</Text>
            <Text style={styles.subtitle}>La cola está al día.</Text>
          </View>
        ) : (
          <View style={styles.queue}>
            <Text style={styles.queueCount}>
              {items.length} {items.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}
            </Text>
            {items.map((item) => (
              <ReviewCard
                key={item.submissionId}
                item={item}
                onDecided={(submissionId) => {
                  setItems((current) => current.filter((entry) => entry.submissionId !== submissionId));
                }}
              />
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.signOutButton, isSigningOut && styles.disabledButton]}
          onPress={() => void handleSignOut()}
          disabled={isSigningOut}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión administrativa"
        >
          {isSigningOut ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <>
              <LogOut size={19} color={Colors.textInverse} strokeWidth={2} />
              <Text style={styles.approveButtonText}>Cerrar sesión</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  header: {
    width: '100%',
    maxWidth: 720,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.borderSubtle,
  },
  headerCopy: { flex: 1, gap: Spacing.xs },
  overline: { ...Typography.overline, color: Colors.primary },
  title: { ...Typography.h2, color: Colors.textPrimary },
  subtitle: { ...Typography.body, color: Colors.textSecondary },
  sessionCard: {
    width: '100%',
    maxWidth: 720,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sessionLabel: { ...Typography.label, color: Colors.textTertiary },
  sessionName: { ...Typography.bodyLarge, color: Colors.textPrimary, fontFamily: FontFamily.bodyBold },
  sessionEmail: { ...Typography.bodySmall, color: Colors.textSecondary },
  queue: { width: '100%', maxWidth: 720, gap: Spacing.md },
  queueCount: { ...Typography.h4, color: Colors.textPrimary },
  reviewCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    ...Shadow.sm,
    gap: Spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.borderSubtle,
  },
  cardHeaderCopy: { flex: 1 },
  professionalName: { ...Typography.h4, color: Colors.textPrimary },
  licenseText: { ...Typography.bodySmall, color: Colors.textSecondary },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.borderSubtle,
  },
  evidenceCopy: { flex: 1 },
  evidenceLabel: { ...Typography.body, color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold },
  evidenceName: { ...Typography.bodySmall, color: Colors.textSecondary },
  dateText: { ...Typography.caption, color: Colors.textTertiary, marginTop: Spacing.xs },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  reasonInput: { minHeight: 88, textAlignVertical: 'top' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  rejectButton: {
    minHeight: 46,
    flex: 1,
    minWidth: 210,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error,
    backgroundColor: Colors.surface,
  },
  rejectButtonText: { ...Typography.button, color: Colors.error },
  approveButton: {
    minHeight: 46,
    flex: 1,
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  approveButtonText: { ...Typography.button, color: Colors.textInverse },
  emptyCard: {
    width: '100%',
    maxWidth: 720,
    alignItems: 'center',
    padding: Spacing.xxl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  emptyTitle: { ...Typography.h4, color: Colors.textPrimary },
  signOutButton: {
    minWidth: 190,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  disabledButton: { opacity: 0.6 },
});
