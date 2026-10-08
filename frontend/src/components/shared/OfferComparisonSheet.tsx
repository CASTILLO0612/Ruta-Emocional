import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import {
  X,
  Star,
  UserRound,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  MessageSquareQuote,
  Calendar,
  MapPin,
  MessageCircle,
  Phone,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Offer } from '../../models/Offer';
import { ActiveRequest } from '../../models/ActiveRequest';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { IconSize, IconStroke } from '../../theme/icons';
import { AppButton } from '../common/AppButton';
import { formatMoney } from '../../utils/money';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';
import { useModalAccessibilityFocus } from '../../hooks/useModalAccessibilityFocus';

interface OfferComparisonSheetProps {
  readonly visible: boolean;
  readonly offer: Offer | null;
  readonly request: ActiveRequest | null;
  readonly isAccepting?: boolean;
  readonly onAccept: (offer: Offer) => void;
  readonly onViewProfile: (psychologistId: string) => void;
  readonly onClose: () => void;
}

export const OfferComparisonSheet: React.FC<OfferComparisonSheetProps> = ({
  visible,
  offer,
  request,
  isAccepting = false,
  onAccept,
  onViewProfile,
  onClose,
}) => {
  const sheetRef = useRef<View>(null);
  const reduceMotion = useReducedMotionPreference();

  useEffect(() => {
    if (visible && offer) {
      const message = `Propuesta de ${offer.psychologistName} por ${formatMoney(offer.amount, offer.currencyCode)}`;
      AccessibilityInfo.announceForAccessibility(message);
    }
    return undefined;
  }, [visible, offer]);
  useModalAccessibilityFocus(sheetRef, visible && Boolean(offer));

  if (!offer || !request) return null;

  const budget = request.proposedBudget;
  const offerAmount = offer.amount;
  const difference = offerAmount - budget;
  const hasRating = typeof offer.psychologistRating === 'number' && offer.psychologistRating > 0;

  const getModalityLabel = (modality: string) => {
    switch (modality) {
      case 'chat':
        return { label: 'Chat en línea', icon: MessageCircle };
      case 'call':
        return { label: 'Llamada de voz', icon: Phone };
      case 'in-person':
        return { label: 'Atención presencial', icon: MapPin };
      default:
        return { label: modality, icon: MessageCircle };
    }
  };

  const modalityInfo = getModalityLabel(request.modality);
  const ModalityIcon = modalityInfo.icon;

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View
          ref={sheetRef}
          style={styles.sheet}
          role="dialog"
          accessibilityViewIsModal
          accessibilityLabel="Detalle de propuesta del profesional"
          collapsable={false}
        >
          <View style={styles.headerBar}>
            <Text style={[Typography.h4, styles.sheetTitle]}>Propuesta de atención</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Cerrar propuesta"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.profileSection}>
              <TouchableOpacity
                onPress={() => onViewProfile(offer.psychologistId)}
                style={styles.avatarContainer}
                accessibilityRole="button"
                accessibilityLabel="Ver perfil del profesional"
              >
                {offer.psychologistPhotoURL ? (
                  <Image source={{ uri: offer.psychologistPhotoURL }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <UserRound size={28} color={Colors.primary} strokeWidth={IconStroke.regular} />
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.profileInfo}>
                <Text style={[Typography.h3, styles.psychologistName]}>
                  {offer.psychologistName}
                </Text>
                {offer.psychologistSpecialty && (
                  <Text style={[Typography.bodySmall, styles.specialty]}>
                    {offer.psychologistSpecialty}
                  </Text>
                )}
                {hasRating && (
                  <View style={styles.ratingRow}>
                    <Star size={13} color={Colors.starFilled} fill={Colors.starFilled} />
                    <Text style={[Typography.caption, styles.ratingText]}>
                      {offer.psychologistRating.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.comparisonSection}>
              <View style={styles.comparisonCol}>
                <Text style={[Typography.caption, styles.comparisonLabel]}>
                  TU PRESUPUESTO
                </Text>
                <Text style={[Typography.bodyLarge, styles.patientAmount]}>
                  {formatMoney(budget, request.currencyCode)}
                </Text>
              </View>

              <View style={styles.differenceIndicator}>
                {difference > 0 ? (
                  <>
                    <ArrowUpRight size={12} color={Colors.warning} />
                    <Text style={[Typography.caption, styles.diffTextOver]}>
                      +{formatMoney(difference, offer.currencyCode)}
                    </Text>
                  </>
                ) : difference < 0 ? (
                  <>
                    <ArrowDownRight size={12} color={Colors.success} />
                    <Text style={[Typography.caption, styles.diffTextUnder]}>
                      {formatMoney(difference, offer.currencyCode)}
                    </Text>
                  </>
                ) : (
                  <>
                    <Minus size={12} color={Colors.textTertiary} />
                    <Text style={[Typography.caption, styles.diffTextEqual]}>Mismo precio</Text>
                  </>
                )}
              </View>

              <View style={[styles.comparisonCol, styles.alignRight]}>
                <Text style={[Typography.caption, styles.comparisonLabel]}>
                  PROPUESTA PROFESIONAL
                </Text>
                <Text style={[Typography.priceSm, styles.offerAmount]}>
                  {formatMoney(offerAmount, offer.currencyCode)}
                </Text>
              </View>
            </View>

            {offer.message && offer.message.trim().length > 0 && (
              <View style={styles.messageSection}>
                <View style={styles.messageHeader}>
                  <MessageSquareQuote size={14} color={Colors.primary} />
                  <Text style={[Typography.caption, styles.messageTitle]}>
                    MENSAJE DEL PROFESIONAL
                  </Text>
                </View>
                <Text style={[Typography.body, styles.messageText]}>
                  {offer.message}
                </Text>
              </View>
            )}

            <View style={styles.conditionsSection}>
              <Text style={[Typography.caption, styles.conditionsTitle]}>
                CONDICIONES DE TU SOLICITUD
              </Text>

              <View style={styles.conditionRow}>
                <ModalityIcon size={IconSize.inline} color={Colors.textSecondary} />
                <Text style={[Typography.bodySmall, styles.conditionText]}>
                  Modalidad: {modalityInfo.label}
                </Text>
              </View>

              <View style={styles.conditionRow}>
                <Calendar size={IconSize.inline} color={Colors.textSecondary} />
                <Text style={[Typography.bodySmall, styles.conditionText]}>
                  Horario solicitado:{' '}
                  {request.scheduledFor
                    ? `${request.scheduledFor.toLocaleDateString()} a las ${request.scheduledFor.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Atención inmediata'}
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.actionsBar}>
            <AppButton
              label={isAccepting ? 'Aceptando' : 'Aceptar oferta'}
              onPress={() => onAccept(offer)}
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isAccepting}
              disabled={isAccepting}
              accessibilityLabel={`Aceptar oferta de ${offer.psychologistName} por ${formatMoney(offerAmount, offer.currencyCode)}`}
            />

            <View style={styles.secondaryActionsRow}>
              <TouchableOpacity
                onPress={() => onViewProfile(offer.psychologistId)}
                style={styles.secondaryBtn}
                accessibilityRole="button"
                accessibilityLabel="Ver perfil completo del profesional"
              >
                <Text style={[Typography.button, styles.secondaryBtnText]}>
                  Ver perfil completo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={styles.secondaryBtn}
                accessibilityRole="button"
                accessibilityLabel="Cerrar propuesta ahora"
              >
                <Text style={[Typography.button, styles.cancelBtnText]}>
                  Ahora no
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  sheet: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sheetTitle: {
    color: Colors.textPrimary,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: Spacing.xl,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatarContainer: {
    marginRight: Spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  psychologistName: {
    color: Colors.textPrimary,
  },
  specialty: {
    color: Colors.textSecondary,
    marginVertical: Spacing.xxs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  ratingText: {
    color: Colors.textTertiary,
  },
  comparisonSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.base,
    marginBottom: Spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.divider,
  },
  comparisonCol: {
    flex: 1,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  comparisonLabel: {
    color: Colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: Spacing.xxs,
  },
  patientAmount: {
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  offerAmount: {
    color: Colors.primary,
  },
  differenceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
    gap: 2,
  },
  diffTextOver: {
    color: Colors.warning,
    fontFamily: Typography.button.fontFamily,
    fontSize: 11,
  },
  diffTextUnder: {
    color: Colors.success,
    fontFamily: Typography.button.fontFamily,
    fontSize: 11,
  },
  diffTextEqual: {
    color: Colors.textTertiary,
    fontSize: 11,
  },
  messageSection: {
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.md,
    marginBottom: Spacing.lg,
    borderLeftWidth: 2,
    borderLeftColor: Colors.primary,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  messageTitle: {
    color: Colors.primary,
    fontFamily: Typography.button.fontFamily,
    letterSpacing: 0.6,
  },
  messageText: {
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  conditionsSection: {
    paddingVertical: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  conditionsTitle: {
    color: Colors.textTertiary,
    fontFamily: Typography.button.fontFamily,
    letterSpacing: 0.6,
    marginBottom: Spacing.xxs,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  conditionText: {
    color: Colors.textSecondary,
  },
  actionsBar: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  secondaryBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  secondaryBtnText: {
    color: Colors.primary,
    fontSize: 14,
  },
  cancelBtnText: {
    color: Colors.textTertiary,
    fontSize: 14,
  },
});
