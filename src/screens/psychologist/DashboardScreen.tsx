import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { RequestCard } from '../../components/psychologist/RequestCard';
import { ActiveRequest } from '../../models/ActiveRequest';
import { useRequestStore } from '../../store/useRequestStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CustomAlert } from '../../components/common/CustomAlert';

export const DashboardScreen: React.FC = () => {
  const { userProfile } = useAuthStore();
  const {
    pendingRequests,
    startListeningToPendingRequests,
    submitCounterOffer,
    isLoading,
  } = useRequestStore();

  const [selectedRequest, setSelectedRequest] = useState<ActiveRequest | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [totalEarnings] = useState(4750);

  const [acceptAlertVisible, setAcceptAlertVisible] = useState(false);
  const [targetAcceptReq, setTargetAcceptReq] = useState<ActiveRequest | null>(null);
  const [errorAlertVisible, setErrorAlertVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    startListeningToPendingRequests();
  }, []);

  useEffect(() => {
    if (pendingRequests.length > 0) {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    }
  }, [pendingRequests.length]);

  const handleAccept = useCallback(
    (request: ActiveRequest) => {
      setTargetAcceptReq(request);
      setAcceptAlertVisible(true);
    },
    []
  );

  const handleConfirmAccept = async () => {
    if (!userProfile || !targetAcceptReq) return;
    setAcceptAlertVisible(false);
    
    await submitCounterOffer({
      requestId: targetAcceptReq.id,
      psychologistId: userProfile.id,
      psychologistName: userProfile.displayName,
      psychologistPhotoURL: userProfile.photoURL,
      psychologistRating: 4.8,
      psychologistSpecialty: 'Psicología Clínica',
      amount: targetAcceptReq.proposedBudget,
    });
    
    setTargetAcceptReq(null);
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
      setErrorMessage('Por favor, ingresa un monto válido mayor a C$50');
      setErrorAlertVisible(true);
      return;
    }

    await submitCounterOffer({
      requestId: selectedRequest.id,
      psychologistId: userProfile.id,
      psychologistName: userProfile.displayName,
      psychologistPhotoURL: userProfile.photoURL,
      psychologistRating: 4.8,
      psychologistSpecialty: 'Psicología Clínica',
      amount,
    });

    setShowCounterModal(false);
    setSelectedRequest(null);
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <MaterialIcons name="radar" size={32} color={Colors.textDisabled} />
      </View>
      <Text style={styles.emptyTitle}>Escaneando solicitudes...</Text>
      <Text style={styles.emptySubtitle}>
        Las peticiones de pacientes cerca de ti aparecerán aquí
      </Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      <SafeAreaView style={styles.appBarWrapper}>
        <View style={styles.appBar}>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <MaterialIcons name="radar" size={16} color={Colors.accent} />
            </View>
            <Text style={styles.appName}>Ruta Emocional — Doctor</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>Ganancias totales</Text>
          <Text style={styles.summaryValue}>C${totalEarnings.toLocaleString()}</Text>
        </View>
        <View style={styles.activeRequestsPill}>
          <View style={styles.liveIndicator} />
          <Text style={styles.liveLabel}>{pendingRequests.length} activas</Text>
        </View>
      </View>

      <Animated.FlatList
        data={pendingRequests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RequestCard
            request={item}
            onAccept={handleAccept}
            onCounterOffer={handleCounterOffer}
          />
        )}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        style={{ transform: [{ scale: pulseAnim }] }}
      />

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
          <View style={styles.counterCard}>
            <Text style={styles.counterTitle}>Proponer Tarifa</Text>
            <Text style={styles.counterSubtitle}>
              Ofrece una tarifa alternativa a {selectedRequest?.patientName}
            </Text>

            <View style={styles.counterInputRow}>
              <Text style={styles.currencyPrefix}>C$</Text>
              <TextInput
                style={styles.counterInput}
                value={counterAmount}
                onChangeText={setCounterAmount}
                keyboardType="number-pad"
                autoFocus
              />
            </View>

            <View style={styles.counterBtnRow}>
              <TouchableOpacity
                style={styles.counterCancelBtn}
                onPress={() => setShowCounterModal(false)}
              >
                <Text style={styles.counterCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.counterSendBtn}
                onPress={handleSubmitCounter}
                disabled={isLoading}
              >
                <Text style={styles.counterSendBtnText}>Enviar Oferta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CustomAlert
        visible={acceptAlertVisible}
        title="Aceptar solicitud"
        message={targetAcceptReq ? `¿Deseas atender la solicitud de ${targetAcceptReq.patientName} por la tarifa propuesta de C$${targetAcceptReq.proposedBudget}?` : ''}
        confirmText="Aceptar"
        cancelText="Cancelar"
        showCancel
        onConfirm={handleConfirmAccept}
        onCancel={() => {
          setAcceptAlertVisible(false);
          setTargetAcceptReq(null);
        }}
      />

      <CustomAlert
        visible={errorAlertVisible}
        title="Monto inválido"
        message={errorMessage}
        confirmText="Entendido"
        onConfirm={() => setErrorAlertVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  appBarWrapper: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  logoMark: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    margin: Spacing.base,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.md,
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textInverse,
    marginTop: 2,
  },
  activeRequestsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  liveLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  listContent: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xxl,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.giant,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,36,99,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  counterCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadow.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  counterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  counterSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  counterInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    marginVertical: Spacing.xs,
  },
  currencyPrefix: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
    marginRight: 4,
  },
  counterInput: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 80,
    textAlign: 'left',
    paddingVertical: Spacing.sm,
  },
  counterBtnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  counterCancelBtn: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  counterSendBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  counterSendBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textInverse,
  },
});
