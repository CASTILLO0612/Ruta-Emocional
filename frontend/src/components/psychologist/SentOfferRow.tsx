import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../common/AppButton';
import type { OwnOffer } from '../../repositories/OfferRepository';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import { formatMoney } from '../../utils/money';
import { formatModalityLabel } from '../../utils/modality';

const STATUS_LABELS: Readonly<Record<OwnOffer['offer']['status'], string>> = {
  pending: 'Esperando respuesta',
  accepted: 'Aceptada',
  rejected: 'No seleccionada',
  withdrawn: 'Retirada',
};

interface SentOfferRowProps {
  readonly item: OwnOffer;
  readonly isWithdrawing: boolean;
  readonly onWithdraw: (item: OwnOffer) => void;
}

export const SentOfferRow: React.FC<SentOfferRowProps> = ({ item, isWithdrawing, onWithdraw }) => (
  <View style={styles.row}>
    <View style={styles.heading}>
      <View style={styles.copy}>
        <Text style={styles.title}>{item.request.primaryNeed || 'Solicitud de acompañamiento'}</Text>
        <Text style={styles.metadata}>
          {formatModalityLabel(item.request.modality)} · {STATUS_LABELS[item.offer.status]}
        </Text>
      </View>
      <Text style={styles.amount}>{formatMoney(item.offer.amount, item.offer.currencyCode)}</Text>
    </View>
    {item.offer.status === 'pending' ? (
      <AppButton
        label="Retirar oferta"
        variant="dangerGhost"
        size="sm"
        isLoading={isWithdrawing}
        onPress={() => onWithdraw(item)}
        accessibilityHint="La solicitud volverá a estar disponible si no tiene otras ofertas"
      />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  row: {
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: Spacing.sm,
  },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  copy: { flex: 1, minWidth: 0 },
  title: { ...Typography.body, fontFamily: FontFamily.bodySemiBold, color: Colors.textPrimary },
  metadata: { ...Typography.caption, color: Colors.textSecondary, marginTop: Spacing.xxs },
  amount: { ...Typography.priceSm, color: Colors.primary },
});
