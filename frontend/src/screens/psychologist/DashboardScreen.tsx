import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  StatusBar,
} from 'react-native';
import { RadioTower, Send } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { AppHeader } from '../../components/shared/AppHeader';
import { RequestCard } from '../../components/psychologist/RequestCard';
import { ProfessionalOfferSheet } from '../../components/psychologist/ProfessionalOfferSheet';
import { SentOfferRow } from '../../components/psychologist/SentOfferRow';
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
import { getOwnOffers, OwnOffer, withdrawOffer } from '../../repositories/OfferRepository';

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
  const [section, setSection] = useState<'AVAILABLE' | 'SENT'>('AVAILABLE');
  const [sentOffers, setSentOffers] = useState<readonly OwnOffer[]>([]);
  const [nextOffersCursor, setNextOffersCursor] = useState<string | null | undefined>(undefined);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [offersLoadingMode, setOffersLoadingMode] = useState<'initial' | 'refresh' | 'more' | null>(null);
  const isLoadingOffersRef = useRef(false);
  const hasLoadedOffersRef = useRef(false);
  const [withdrawingOfferId, setWithdrawingOfferId] = useState<string | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<OwnOffer | null>(null);
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

  const loadOwnOffers = useCallback(async (cursor?: string, signal?: AbortSignal) => {
    if (isLoadingOffersRef.current) return;
    isLoadingOffersRef.current = true;
    const loadingMode = cursor ? 'more' : hasLoadedOffersRef.current ? 'refresh' : 'initial';
    setOffersLoadingMode(loadingMode);
    setIsLoadingOffers(true);
    try {
      const page = await getOwnOffers(cursor, signal);
      if (!signal?.aborted) {
        setSentOffers((current) => {
          if (!cursor) return page.items;
          const knownIds = new Set(current.map(({ offer }) => offer.id));
          return [...current, ...page.items.filter(({ offer }) => !knownIds.has(offer.id))];
        });
        setNextOffersCursor(page.nextCursor);
        hasLoadedOffersRef.current = true;
      }
    } catch (loadError) {
      if (signal?.aborted || (loadError instanceof Error && loadError.name === 'AbortError')) return;
      showToast(presentUserError(loadError, 'No pudimos cargar tus ofertas enviadas.'), 'error');
    } finally {
      isLoadingOffersRef.current = false;
      if (!signal?.aborted) {
        setIsLoadingOffers(false);
        setOffersLoadingMode(null);
      }
    }
  }, [showToast]);

  useEffect(() => {
    const controller = new AbortController();
    void loadOwnOffers(undefined, controller.signal);
    return () => controller.abort();
  }, [loadOwnOffers]);

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
      void loadOwnOffers();
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
      void loadOwnOffers();
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

  const handleConfirmWithdraw = async () => {
    if (!withdrawTarget) return;
    const target = withdrawTarget;
    setWithdrawTarget(null);
    setWithdrawingOfferId(target.offer.id);
    try {
      const updated = await withdrawOffer(target.offer.requestId, target.offer.id);
      setSentOffers((current) => current.map((item) => (
        item.offer.id === updated.id ? { ...item, offer: updated } : item
      )));
      showToast('La oferta fue retirada.', 'success');
    } catch (withdrawError) {
      showToast(presentUserError(withdrawError, 'No pudimos retirar la oferta.'), 'error');
    } finally {
      setWithdrawingOfferId(null);
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

      <View style={styles.primaryNavigation} accessibilityRole="tablist">
        {(['AVAILABLE', 'SENT'] as const).map((value) => {
          const selected = section === value;
          return (
            <Pressable
              key={value}
              onPress={() => setSection(value)}
              style={[styles.primaryNavigationItem, selected && styles.primaryNavigationItemActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              aria-selected={selected}
            >
              <Text style={[styles.primaryNavigationText, selected && styles.primaryNavigationTextActive]}>
                {value === 'AVAILABLE' ? 'Disponibles' : 'Enviadas'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {section === 'AVAILABLE' ? <FlatList
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
      /> : <FlatList
        data={sentOffers}
        keyExtractor={({ offer }) => offer.id}
        renderItem={({ item }) => (
          <SentOfferRow
            item={item}
            isWithdrawing={withdrawingOfferId === item.offer.id}
            onWithdraw={setWithdrawTarget}
          />
        )}
        ListHeaderComponent={sentOffers.length > 0 ? (
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Tus propuestas</Text>
            <Text style={styles.listSubtitle}>Puedes retirar las que aún esperan respuesta.</Text>
          </View>
        ) : null}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              {isLoadingOffers ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Send size={28} color={Colors.primary} strokeWidth={1.8} />
              )}
            </View>
            <Text style={styles.emptyTitle}>
              {isLoadingOffers ? 'Cargando ofertas' : 'Aún no has enviado ofertas'}
            </Text>
            <Text style={styles.emptySub}>Las propuestas enviadas y su estado aparecerán aquí.</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={offersLoadingMode === 'refresh'}
        onRefresh={() => void loadOwnOffers()}
        onEndReached={() => {
          if (nextOffersCursor && !isLoadingOffersRef.current) {
            void loadOwnOffers(nextOffersCursor);
          }
        }}
        onEndReachedThreshold={0.35}
        ListFooterComponent={sentOffers.length > 0 && offersLoadingMode === 'more' ? (
          <View style={styles.paginationLoader}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : null}
        initialNumToRender={8}
        windowSize={7}
      />}

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
        visible={Boolean(withdrawTarget)}
        title="Retirar oferta"
        message="El paciente dejará de ver esta propuesta. Esta acción no se puede deshacer."
        confirmText="Retirar"
        cancelText="Cancelar"
        tone="warning"
        showCancel
        onConfirm={() => void handleConfirmWithdraw()}
        onCancel={() => setWithdrawTarget(null)}
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
  primaryNavigation: {
    minHeight: 52, flexDirection: 'row', paddingHorizontal: Spacing.base,
    gap: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  primaryNavigationItem: {
    flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  primaryNavigationItemActive: { borderBottomColor: Colors.primary },
  primaryNavigationText: { ...Typography.bodySmall, color: Colors.textSecondary },
  primaryNavigationTextActive: { color: Colors.primary },
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
  paginationLoader: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
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
