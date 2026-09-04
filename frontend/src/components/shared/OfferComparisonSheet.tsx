/**
 * OfferComparisonSheet — Modal accesible de comparación monetaria y aceptación de oferta.
 *
 * Principios rectores aplicados:
 * 1. Comparación transparente: Presupuesto del paciente vs Importe del psicólogo (+/- diferencia).
 * 2. Condiciones de tu solicitud separadas visualmente (modalidad y horario solicitado).
 * 3. Cero datos inexistentes: NO muestra duración, NO muestra horario alternativo ni modalidad alterna.
 * 4. Valoración honesta: muestra estrellas solo si rating > 0 (omite si es 0, no inventa "Profesional nuevo").
 * 5. Semántica móvil accesible: foco inicial, accesibilityRole="dialog", accessibilityLabel.
 */
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
  findNodeHandle,
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
  CheckCircle2,
} from 'lucide-react-native';

import { Offer } from '../../models/Offer';
import { ActiveRequest } from '../../models/ActiveRequest';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';
import { IconSize, IconStroke } from '../../theme/icons';
import { AppButton } from '../common/AppButton';
import { formatMoney } from '../../utils/money';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';

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
      const animationFrame = requestAnimationFrame(() => {
        const reactTag = findNodeHandle(sheetRef.current);
        if (reactTag) AccessibilityInfo.setAccessibilityFocus(reactTag);
      });
      return () => cancelAnimationFrame(animationFrame);
    }
    return undefined;
  }, [visible, offer]);

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
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          ref={sheetRef}
          style={styles.sheet}
          role="dialog"
          accessibilityViewIsModal
          accessibilityLabel="Detalle de propuesta del profesional"
          collapsable={false}
        >
          {/* Barra superior de cierre */}
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
            {/* 1. Identidad del profesional */}
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
                {/* Rating solo si > 0 */}
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

            {/* 2. Comparación Monetaria */}
            <View style={styles.comparisonBox}>
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
                  <View style={[styles.diffBadge, styles.diffBadgeOver]}>
                    <ArrowUpRight size={12} color={Colors.warning} />
                    <Text style={[Typography.caption, styles.diffTextOver]}>
                      +{formatMoney(difference, offer.currencyCode)}
                    </Text>
                  </View>
                ) : difference < 0 ? (
                  <View style={[styles.diffBadge, styles.diffBadgeUnder]}>
                    <ArrowDownRight size={12} color={Colors.success} />
                    <Text style={[Typography.caption, styles.diffTextUnder]}>
                      {formatMoney(difference, offer.currencyCode)}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.diffBadge, styles.diffBadgeEqual]}>
                    <Minus size={12} color={Colors.textTertiary} />
                    <Text style={[Typography.caption, styles.diffTextEqual]}>Mismo precio</Text>
                  </View>
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

            {/* 3. Mensaje del psicólogo (si existe) */}
            {offer.message && offer.message.trim().length > 0 && (
              <View style={styles.messageBox}>
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

            {/* 4. Condiciones de tu solicitud (claramente separadas) */}
            <View style={styles.conditionsBox}>
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

          {/* Barra de acciones inferior */}
          <View style={styles.actionsBar}>
            <AppButton
              label={isAccepting ? 'Aceptando...' : 'Aceptar oferta'}
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
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    maxHeight: '90%',
    ...Shadow.xl,
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
  comparisonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
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
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  diffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 2,
  },
  diffBadgeOver: {
    backgroundColor: Colors.warningSurface,
  },
  diffTextOver: {
    color: Colors.warning,
    fontFamily: Typography.button.fontFamily,
    fontSize: 11,
  },
  diffBadgeUnder: {
    backgroundColor: Colors.successSurface,
  },
  diffTextUnder: {
    color: Colors.success,
    fontFamily: Typography.button.fontFamily,
    fontSize: 11,
  },
  diffBadgeEqual: {
    backgroundColor: Colors.surfaceMuted,
  },
  diffTextEqual: {
    color: Colors.textTertiary,
    fontSize: 11,
  },
  messageBox: {
    backgroundColor: Colors.primaryTint,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
    borderLeftWidth: 3,
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
  conditionsBox: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
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
