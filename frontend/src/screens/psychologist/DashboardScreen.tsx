import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
} from 'react-native';
import { RadioTower } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { AppHeader } from '../../components/shared/AppHeader';
import { RequestCard } from '../../components/psychologist/RequestCard';
import { ProfessionalOfferSheet } from '../../components/psychologist/ProfessionalOfferSheet';
import { ActiveRequest } from '../../models/ActiveRequest';
import { useRequestStore } from '../../store/useRequestStore';
import { CustomAlert } from '../../components/common/CustomAlert';
import { Toast, useToast } from '../../components/common/Toast';
import {
  getServiceRequestPolicy,
  ServiceRequestPolicy,
} from '../../repositories/RequestRepository';
import { formatMoney } from '../../utils/money';
import { presentUserError } from '../../utils/userFacingError';

export const DashboardScreen: React.FC = () => {
  const { toastConfig, showToast, hideToast } = useToast();
  const {
    pendingRequests,
    startListeningToPendingRequests,
    stopListeningToPendingRequests,
    submitCounterOffer,
    isLoading,
    isPendingRequestsLoading,
    error,
    clearError,
  } = useRequestStore();

  const [selectedRequest, setSelectedRequest] = useState<ActiveRequest | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
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

  const handleOfferProposedAmount = useCallback((request: ActiveRequest) => {
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
      showToast('Oferta enviada. El paciente podrá revisarla y responder.', 'success');
    } catch (submissionError) {
      clearError();
      showToast(
        presentUserError(submissionError, 'No pudimos enviar la oferta. Inténtalo nuevamente.'),
        'error'
      );
    }
  };

  const handleAdjustRate = useCallback((request: ActiveRequest) => {
    setSelectedRequest(request);
    setCounterAmount(request.proposedBudget.toString());
  }, []);

  const handleCloseOfferSheet = useCallback(() => {
    if (isLoading) return;
    setSelectedRequest(null);
    setCounterAmount('');
  }, [isLoading]);

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
      setSelectedRequest(null);
      setCounterAmount('');
      showToast('Contraoferta enviada correctamente.', 'success');
    } catch (submissionError) {
      clearError();
      showToast(
        presentUserError(submissionError, 'No pudimos enviar la contraoferta. Inténtalo nuevamente.'),
        'error'
      );
    }
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconBox}>
        {isPendingRequestsLoading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <RadioTower size={28} color={Colors.primary} strokeWidth={1.8} />
        )}
      </View>
      <Text style={styles.emptyTitle}>
        {isPendingRequestsLoading ? 'Buscando solicitudes' : 'Todo está al día'}
      </Text>
      <Text style={styles.emptySub}>
        {isPendingRequestsLoading
          ? 'Estamos consultando oportunidades compatibles con tu perfil.'
          : 'Las nuevas solicitudes compatibles aparecerán aquí automáticamente.'}
      </Text>
    </View>
  );

  const requestCountLabel = pendingRequests.length === 1
    ? '1 solicitud disponible'
    : `${pendingRequests.length} solicitudes disponibles`;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      <AppHeader
        title="Solicitudes"
        subtitle="Oportunidades compatibles"
        showBrand={false}
        showBrandMark
        showMenta
        showInbox
      />

      <FlatList
        data={pendingRequests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RequestCard
            request={item}
            isSubmitting={isLoading}
            onOfferProposedAmount={handleOfferProposedAmount}
            onAdjustRate={handleAdjustRate}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={pendingRequests.length > 0 ? (
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Por revisar</Text>
            <Text style={styles.listSubtitle}>{requestCountLabel}</Text>
          </View>
        ) : null}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        windowSize={7}
      />

      <ProfessionalOfferSheet
        request={selectedRequest}
        amountInput={counterAmount}
        minimumAmount={requestPolicy ? Number(requestPolicy.minimumAmount) : undefined}
        maximumAmount={requestPolicy ? Number(requestPolicy.maximumAmount) : undefined}
        isSubmitting={isLoading}
        onAmountChange={setCounterAmount}
        onSubmit={() => void handleSubmitCounter()}
        onClose={handleCloseOfferSheet}
      />

      <CustomAlert
        visible={acceptAlertVisible}
        title="Enviar oferta"
        message={
          targetAcceptReq
            ? `Se enviará una oferta por ${formatMoney(targetAcceptReq.proposedBudget, targetAcceptReq.currencyCode)}. El paciente deberá aceptarla para iniciar la atención.`
            : ''
        }
        confirmText="Enviar"
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
  listContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  listHeader: {
    marginBottom: Spacing.md,
    gap: Spacing.xxs,
  },
  listTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  listSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  separator: {
    height: Spacing.md,
  },

  emptyState: {
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...Typography.h3, color: Colors.textPrimary },
  emptySub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', maxWidth: 260 },
});
