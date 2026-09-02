import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RadioTower, Send, Stethoscope } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { RequestCard } from '../../components/psychologist/RequestCard';
import { ActiveRequest } from '../../models/ActiveRequest';
import { useRequestStore } from '../../store/useRequestStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CustomAlert } from '../../components/common/CustomAlert';
import { Toast, useToast } from '../../components/common/Toast';
import {
  getServiceRequestPolicy,
  ServiceRequestPolicy,
} from '../../repositories/RequestRepository';
import { formatMoney } from '../../utils/money';

export const DashboardScreen: React.FC = () => {
  const { userProfile } = useAuthStore();
  const { toastConfig, showToast, hideToast } = useToast();
  const {
    pendingRequests,
    startListeningToPendingRequests,
    stopListeningToPendingRequests,
    submitCounterOffer,
    isLoading,
    error,
    clearError,
  } = useRequestStore();

  const [selectedRequest, setSelectedRequest] = useState<ActiveRequest | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [requestPolicy, setRequestPolicy] = useState<ServiceRequestPolicy | null>(null);

  const [acceptAlertVisible, setAcceptAlertVisible] = useState(false);
  const [targetAcceptReq, setTargetAcceptReq] = useState<ActiveRequest | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    startListeningToPendingRequests();
    void getServiceRequestPolicy(controller.signal)
      .then(setRequestPolicy)
      .catch((policyError) => {
        if (policyError instanceof Error && policyError.name === 'AbortError') return;
        showToast('No pudimos cargar las reglas de ofertas.', 'error');
      });
    return () => {
      controller.abort();
      stopListeningToPendingRequests();
    };
  }, [showToast, startListeningToPendingRequests, stopListeningToPendingRequests]);

  useEffect(() => {
    if (!error) return;
    showToast(error, 'error');
    clearError();
  }, [clearError, error, showToast]);

  const handleAccept = useCallback((request: ActiveRequest) => {
    setTargetAcceptReq(request);
    setAcceptAlertVisible(true);
  }, []);

  const handleConfirmAccept = async () => {
    if (!targetAcceptReq) return;
    setAcceptAlertVisible(false);
    const req = targetAcceptReq;
    setTargetAcceptReq(null);

    try {
      await submitCounterOffer({
        requestId: req.id,
        amount: req.proposedBudget,
      });
      showToast('Oferta enviada. Esperando confirmación del paciente...', 'success');
    } catch (submissionError) {
      clearError();
      showToast(
        submissionError instanceof Error
          ? submissionError.message
          : 'No se pudo aceptar la solicitud. Intenta nuevamente.',
        'error'
      );
    }
  };

  const handleCounterOffer = useCallback((request: ActiveRequest) => {
    setSelectedRequest(request);
    setCounterAmount(request.proposedBudget.toString());
    setShowCounterModal(true);
  }, []);

  const handleSubmitCounter = async () => {
    if (!selectedRequest) return;
    if (!requestPolicy) {
      showToast('Las reglas de ofertas todavía se están cargando.', 'warning');
      return;
    }
    const amount = Number(counterAmount);
    const minimum = Number(requestPolicy.minimumAmount);
    const maximum = Number(requestPolicy.maximumAmount);
    if (!Number.isFinite(amount) || amount < minimum || amount > maximum) {
      showToast(
        `Ingresa un monto entre ${formatMoney(minimum, selectedRequest.currencyCode)} y ${formatMoney(maximum, selectedRequest.currencyCode)}.`,
        'warning'
      );
      return;
    }

    try {
      await submitCounterOffer({
        requestId: selectedRequest.id,
        amount,
      });
      setShowCounterModal(false);
      setSelectedRequest(null);
      showToast('Contraoferta enviada correctamente.', 'success');
    } catch (submissionError) {
      clearError();
      showToast(
        submissionError instanceof Error
          ? submissionError.message
          : 'No se pudo enviar la contraoferta.',
        'error'
      );
    }
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconBox}>
        <RadioTower size={28} color={Colors.textDisabled} strokeWidth={1.8} />
      </View>
      <Text style={styles.emptyTitle}>Buscando solicitudes</Text>
      <Text style={styles.emptySub}>Las solicitudes disponibles aparecerán aquí.</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      <SafeAreaView style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoMark}>
              <Stethoscope size={16} color={Colors.accent} strokeWidth={2} />
            </View>
            <View>
              <Text style={styles.greeting}>Panel de Psicólogo</Text>
              <Text style={styles.subGreeting}>{userProfile?.displayName || 'Doctor'}</Text>
            </View>
          </View>

        </View>

        {/* Barra de solicitudes activas */}
        <View style={styles.activeBar}>
          <View style={styles.activeDot} />
          <Text style={styles.activeText}>
            {pendingRequests.length > 0
              ? `${pendingRequests.length} solicitud${pendingRequests.length !== 1 ? 'es' : ''} pendiente${pendingRequests.length !== 1 ? 's' : ''}`
              : 'Sin solicitudes pendientes'}
          </Text>
        </View>
      </SafeAreaView>

      <Text style={styles.listSectionLabel}>Solicitudes disponibles</Text>

      <FlatList
        data={pendingRequests}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View>
            <RequestCard request={item} onAccept={handleAccept} onCounterOffer={handleCounterOffer} />
            {index < pendingRequests.length - 1 && <View style={styles.separator} />}
          </View>
        )}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Modal de contraoferta */}
      <Modal
        visible={showCounterModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCounterModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>Proponer tarifa</Text>
            <Text style={styles.modalSub}>
              La identidad del paciente permanecerá protegida hasta que acepte una oferta.
            </Text>

            <View style={styles.amountRow}>
              <Text style={styles.currencySymbol}>
                {selectedRequest?.currencyCode ?? ''}
              </Text>
              <TextInput
                style={styles.amountInput}
                value={counterAmount}
                onChangeText={setCounterAmount}
                keyboardType="number-pad"
                autoFocus
                accessibilityLabel="Counter offer amount"
                placeholder="0"
                placeholderTextColor={Colors.textDisabled}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCounterModal(false)}
                accessibilityLabel="Cancelar contraoferta"
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSendBtn, isLoading && styles.btnDisabled]}
                onPress={handleSubmitCounter}
                disabled={isLoading}
                accessibilityLabel="Enviar contraoferta"
              >
                <Send size={16} color={Colors.textInverse} strokeWidth={2} />
                <Text style={styles.modalSendText}>Enviar oferta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CustomAlert
        visible={acceptAlertVisible}
        title="Aceptar solicitud"
        message={
          targetAcceptReq
            ? `¿Enviar una oferta por ${formatMoney(targetAcceptReq.proposedBudget, targetAcceptReq.currencyCode)}?`
            : ''
        }
        confirmText="Aceptar"
        cancelText="Cancelar"
        showCancel
        onConfirm={handleConfirmAccept}
        onCancel={() => { setAcceptAlertVisible(false); setTargetAcceptReq(null); }}
      />

      <Toast {...toastConfig} onHide={hideToast} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  headerSafe: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: { ...Typography.overline, color: Colors.textTertiary },
  subGreeting: { ...Typography.h4, color: Colors.textPrimary },

  activeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  activeText: { ...Typography.bodySmall, color: Colors.textSecondary },

  listSectionLabel: {
    ...Typography.overline,
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  listContent: { flexGrow: 1, backgroundColor: Colors.surface },
  separator: { height: 1, backgroundColor: Colors.borderSubtle, marginLeft: Spacing.base + 52 },

  emptyState: {
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...Typography.h3, color: Colors.textPrimary },
  emptySub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', maxWidth: 260 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    alignSelf: 'center',
    marginBottom: Spacing.xs,
  },
  modalTitle: { ...Typography.h2, color: Colors.textPrimary },
  modalSub: { ...Typography.body, color: Colors.textSecondary, marginTop: -Spacing.sm },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    paddingBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  currencySymbol: { ...Typography.h1, color: Colors.primary },
  amountInput: { ...Typography.display, color: Colors.textPrimary, flex: 1, padding: 0 },

  modalActions: { flexDirection: 'row', gap: Spacing.md },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  modalCancelText: { ...Typography.button, color: Colors.textSecondary },
  modalSendBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  modalSendText: { ...Typography.button, color: Colors.textInverse },
  btnDisabled: { opacity: 0.6 },
});
