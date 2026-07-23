import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { ActiveRequest } from '../../models/ActiveRequest';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing, Shadow } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

const MODALITY_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  chat: 'chat-bubble-outline',
  call: 'phone',
  'in-person': 'location-on',
};

const MODALITY_LABELS: Record<string, string> = {
  chat: 'Chat',
  call: 'Llamada',
  'in-person': 'Presencial',
};

interface RequestCardProps {
  request: ActiveRequest;
  onAccept: (request: ActiveRequest) => void;
  onCounterOffer: (request: ActiveRequest) => void;
}

export const RequestCard: React.FC<RequestCardProps> = ({
  request,
  onAccept,
  onCounterOffer,
}) => {
  const timeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h`;
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.modalityBadge}>
          <MaterialIcons
            name={MODALITY_ICONS[request.modality] ?? 'help-outline'}
            size={16}
            color={Colors.primary}
          />
          <Text style={styles.modalityText}>
            {MODALITY_LABELS[request.modality]}
          </Text>
        </View>

        {request.status === 'bidding' && (
          <View style={styles.biddingBadge}>
            <View style={styles.biddingDot} />
            <Text style={styles.biddingText}>En subasta</Text>
          </View>
        )}

        <Text style={styles.timeAgo}>
          {request.createdAt ? timeAgo(request.createdAt) : '--'}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.patientName}>{request.patientName}</Text>
        {request.primaryNeed && (
          <Text style={styles.need} numberOfLines={2}>
            {request.primaryNeed}
          </Text>
        )}
      </View>

      <View style={styles.budgetRow}>
        <MaterialIcons name="account-balance-wallet" size={16} color={Colors.textSecondary} />
        <Text style={styles.budgetLabel}>Presupuesto del paciente</Text>
        <Text style={styles.budgetAmount}>C${request.proposedBudget}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => onAccept(request)}
          activeOpacity={0.82}
        >
          <MaterialIcons name="check" size={18} color={Colors.primary} />
          <Text style={styles.acceptBtnText}>Aceptar C${request.proposedBudget}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.counterBtn}
          onPress={() => onCounterOffer(request)}
          activeOpacity={0.82}
        >
          <MaterialIcons name="swap-horiz" size={18} color={Colors.textInverse} />
          <Text style={styles.counterBtnText}>Contraofertar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    gap: Spacing.md,
    ...Shadow.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  modalityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  modalityText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  biddingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accentFaded,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  biddingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  biddingText: {
    ...Typography.caption,
    color: Colors.accentDark,
    fontWeight: '700',
  },
  timeAgo: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginLeft: 'auto',
  },
  body: {
    gap: Spacing.xxs,
  },
  patientName: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  need: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.background,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  budgetLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  budgetAmount: {
    ...Typography.priceSm,
    color: Colors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.accent,
    ...Shadow.sm,
  },
  acceptBtnText: {
    ...Typography.button,
    color: Colors.primary,
    fontSize: 13,
  },
  counterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    ...Shadow.sm,
  },
  counterBtnText: {
    ...Typography.button,
    color: Colors.textInverse,
    fontSize: 13,
  },
});
