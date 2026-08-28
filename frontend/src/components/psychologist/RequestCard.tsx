import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ActiveRequest } from '../../models/ActiveRequest';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing, Shadow } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { formatMoney } from '../../utils/money';

const MODALITY_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  chat: 'chat-bubble-outline',
  call: 'phone',
  video: 'videocam',
  'in-person': 'location-on',
};

const MODALITY_LABELS: Record<string, string> = {
  chat: 'Chat',
  call: 'Llamada',
  video: 'Video',
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
  const timeAgo = (dateInput?: Date | string | number) => {
    if (!dateInput) return 'ahora';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'ahora';
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seconds < 60) return `${Math.max(1, seconds)}s`;
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
            {MODALITY_LABELS[request.modality] || request.modality}
          </Text>
        </View>

        {request.status === 'bidding' && (
          <View style={styles.biddingBadge}>
            <View style={styles.biddingDot} />
            <Text style={styles.biddingText}>En subasta</Text>
          </View>
        )}

        <Text style={styles.timeAgo}>
          {timeAgo(request.createdAt)}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.requestTitle}>Solicitud de atención</Text>
        {request.primaryNeed ? (
          <Text style={styles.need} numberOfLines={2}>
            {request.primaryNeed}
          </Text>
        ) : null}
      </View>

      <View style={styles.budgetRow}>
        <MaterialIcons name="account-balance-wallet" size={16} color={Colors.textSecondary} />
        <Text style={styles.budgetLabel}>Presupuesto: </Text>
        <Text style={styles.budgetAmount}>
          {formatMoney(request.proposedBudget, request.currencyCode)}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.counterBtn}
          onPress={() => onCounterOffer(request)}
          activeOpacity={0.82}
          accessibilityLabel="Proponer otra tarifa"
        >
          <MaterialIcons name="swap-horiz" size={18} color={Colors.textSecondary} />
          <Text style={styles.counterBtnText}>Contraofertar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => onAccept(request)}
          activeOpacity={0.82}
          accessibilityLabel={`Ofertar ${formatMoney(request.proposedBudget, request.currencyCode)}`}
        >
          <MaterialIcons name="check" size={18} color={Colors.textInverse} />
          <Text style={styles.acceptBtnText}>
            Ofertar {formatMoney(request.proposedBudget, request.currencyCode)}
          </Text>
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
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
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
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
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
  requestTitle: {
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
    backgroundColor: 'transparent',
    paddingVertical: 2,
  },
  budgetLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  budgetAmount: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  counterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'transparent',
  },
  counterBtnText: {
    ...Typography.button,
    color: Colors.textSecondary,
    fontSize: 13,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
  },
  acceptBtnText: {
    ...Typography.button,
    color: Colors.textInverse,
    fontSize: 13,
  },
});
