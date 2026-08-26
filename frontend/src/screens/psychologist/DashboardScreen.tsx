import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { RequestCard } from '../../components/psychologist/RequestCard';
import { ActiveRequest } from '../../models/ActiveRequest';
import { useRequestStore } from '../../store/useRequestStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CustomAlert } from '../../components/common/CustomAlert';
import { Toast, useToast } from '../../components/common/Toast';
import { getSocket } from '../../services/socketClient';

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { userProfile } = useAuthStore();
  const { toastConfig, showToast, hideToast } = useToast();
  const { pendingRequests, startListeningToPendingRequests, submitCounterOffer, isLoading } = useRequestStore();

  const [selectedRequest, setSelectedRequest] = useState<ActiveRequest | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [totalEarnings] = useState(4750);

  const [acceptAlertVisible, setAcceptAlertVisible] = useState(false);
  const [targetAcceptReq, setTargetAcceptReq] = useState<ActiveRequest | null>(null);

  useEffect(() => {
    try {
      startListeningToPendingRequests();
    } catch (err) {
      showToast('Error al cargar solicitudes. Verifica tu conexión.', 'error');
    }
  }, []);

  useEffect(() => {
    if (!userProfile?.id) return;
    const socket = getSocket();

    const onOfferWasAccepted = (data: any) => {
      if (!data?.requestId && !data?.offerId) return;
      const req = pendingRequests.find(
        (r) => String(r.id) === String(data.requestId) || String((r as any)._id) === String(data.requestId)
      ) || targetAcceptReq || selectedRequest;

      showToast('¡Tu oferta fue confirmada por el paciente! Iniciando seguimiento de ruta...', 'success');
      const modality = data.modality || req?.modality || 'in-person';
      const patientName = data.patientName || req?.patientName || 'Norman Castillo';
      const amount = data.finalPrice || req?.proposedBudget || 730;

      if (modality === 'in-person' || modality === 'presencial' || modality === 'Presencial') {
        navigation.navigate('Route', {
          requestId: data.requestId || req?.id || 'room_live',
          psychologistName: patientName,
          amount: amount,
        });
      } else {
        navigation.navigate('Consultation', {
          requestId: data.requestId || req?.id || 'room_live',
          psychologistName: patientName,
          modality: modality,
        });
      }
    };

    socket.on('offer_was_accepted', onOfferWasAccepted);
    socket.on('broadcast_offer_accepted', onOfferWasAccepted);

    return () => {
      socket.off('offer_was_accepted', onOfferWasAccepted);
      socket.off('broadcast_offer_accepted', onOfferWasAccepted);
    };
  }, [userProfile?.id, pendingRequests, targetAcceptReq, selectedRequest, navigation]);

  const handleAccept = useCallback((request: ActiveRequest) => {
    setTargetAcceptReq(request);
    setAcceptAlertVisible(true);
  }, []);

  const handleConfirmAccept = async () => {
    if (!userProfile || !targetAcceptReq) return;
    setAcceptAlertVisible(false);
    const req = targetAcceptReq;
    setTargetAcceptReq(null);

    try {
      await submitCounterOffer({
        requestId: req.id,
        psychologistId: userProfile.id,
        psychologistName: userProfile.displayName,
        psychologistPhotoURL: userProfile.photoURL,
        psychologistRating: 4.8,
        psychologistSpecialty: userProfile.specialty || 'Psicología Clínica',
        amount: req.proposedBudget,
      });
      showToast('Oferta enviada. Esperando confirmación del paciente...', 'success');
    } catch (err: any) {
      showToast(err?.message || 'No se pudo aceptar la solicitud. Intenta nuevamente.', 'error');
    }
  };

  const handleCounterOffer = useCallback((request: ActiveRequest) => {
    setSelectedRequest(request);
    setCounterAmount(request.proposedBudget.toString());
    setShowCounterModal(true);
  }, []);

  const handleSubmitCounter = async () => {
    if (!userProfile || !selectedRequest) return;
    const amount = parseInt(counterAmount, 10);
    if (isNaN(amount) || amount < 50) {
      showToast('Ingresa un monto válido mayor a C$50.', 'warning');
      return;
    }

    try {
      await submitCounterOffer({
        requestId: selectedRequest.id,
        psychologistId: userProfile.id,
        psychologistName: userProfile.displayName,
        psychologistPhotoURL: userProfile.photoURL,
        psychologistRating: 4.8,
        psychologistSpecialty: userProfile.specialty || 'Psicología Clínica',
        amount,
      });
      setShowCounterModal(false);
      setSelectedRequest(null);
      showToast('Contraoferta enviada correctamente.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'No se pudo enviar la contraoferta.', 'error');
    }
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconBox}>
        <MaterialIcons name="wifi-tethering" size={28} color={Colors.textDisabled} />
      </View>
      <Text style={styles.emptyTitle}>Escaneando solicitudes</Text>
      <Text style={styles.emptySub}>Las peticiones de pacientes aparecerán aquí en tiempo real.</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      <SafeAreaView style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoMark}>
              <MaterialIcons name="psychology" size={14} color={Colors.accent} />
            </View>
            <View>
              <Text style={styles.greeting}>Panel de Psicólogo</Text>
              <Text style={styles.subGreeting}>{userProfile?.displayName || 'Doctor'}</Text>
            </View>
          </View>

          {/* Earnings inline */}
          <View style={styles.earningsBadge}>
            <Text style={styles.earningsLabel}>Ganancias</Text>
            <Text style={styles.earningsValue}>C${totalEarnings.toLocaleString()}</Text>
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

      <Text style={styles.listSectionLabel}>Solicitudes en tiempo real</Text>

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
              Enviarás una contraoferta a{' '}
              <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>
                {selectedRequest?.patientName}
              </Text>
            </Text>

            <View style={styles.amountRow}>
              <Text style={styles.currencySymbol}>C$</Text>
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
                <MaterialIcons name="send" size={16} color={Colors.textInverse} />
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
            ? `¿Atender a ${targetAcceptReq.patientName} por C$${targetAcceptReq.proposedBudget}?`
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

  earningsBadge: { alignItems: 'flex-end' },
  earningsLabel: { ...Typography.caption, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  earningsValue: { ...Typography.h3, color: Colors.primary },

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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
    borderRadius: BorderRadius.full,
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
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  modalSendText: { ...Typography.button, color: Colors.textInverse },
  btnDisabled: { opacity: 0.6 },
});
