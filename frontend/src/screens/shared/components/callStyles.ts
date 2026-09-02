import { StyleSheet } from 'react-native';
import { Colors } from '../../../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../../../theme/spacing';
import { FontFamily, Typography } from '../../../theme/typography';

export const callStyles = StyleSheet.create({
  // Incoming overlay
  incomingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.callBackground,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  incomingCard: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    width: '100%',
  },
  incomingSubtitle: {
    ...Typography.button,
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  incomingTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  incomingAvatarWrapper: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.surfaceOnBrand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.borderOnBrand,
  },
  incomingAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.callControl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingName: {
    ...Typography.h2,
    color: Colors.textInverse,
    textAlign: 'center',
  },
  incomingRole: {
    ...Typography.bodySmall,
    color: Colors.textOnBrandMuted,
    textAlign: 'center',
  },
  incomingActions: {
    flexDirection: 'row',
    gap: 60,
    marginTop: Spacing.xl,
  },
  rejectBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
  },
  acceptBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
  },

  // Outgoing call
  outgoingRoot: {
    flex: 1,
    backgroundColor: Colors.callBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outgoingInner: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  outgoingAvatarWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surfaceOnBrand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  outgoingName: {
    ...Typography.h2,
    color: Colors.textInverse,
  },
  outgoingStatus: {
    ...Typography.button,
    color: Colors.accent,
  },
  cancelCallBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxxl,
    ...Shadow.lg,
  },
  cancelCallLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.textOnBrandMuted,
  },

  // Active call
  activeRoot: {
    flex: 1,
    backgroundColor: Colors.callBackground,
  },
  activeRemote: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeAvatarWrapper: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: Colors.surfaceOnBrand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  activeAudioAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeVideoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  activeVideoLabel: {
    ...Typography.caption,
    color: Colors.textOnBrandMuted,
  },
  activeName: {
    ...Typography.h2,
    color: Colors.textInverse,
  },
  activeTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  activeLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  activeTimer: {
    ...Typography.h3,
    color: Colors.textInverse,
    letterSpacing: 2,
  },
  activeSelfPreview: {
    position: 'absolute',
    top: 60,
    right: Spacing.base,
    width: 90,
    height: 120,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.callPreview,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.accent,
    zIndex: 10,
  },
  activeSelfLabel: {
    ...Typography.caption,
    color: Colors.textOnBrandMuted,
    marginTop: 4,
  },
  activeControls: {
    paddingBottom: Spacing.xl,
  },
  activeControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  activeControlCol: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  activeBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.callControl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBtnOff: {
    backgroundColor: Colors.callControlDisabled,
  },
  activeEndBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
  },
  activeBtnLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.textOnBrandMuted,
  },
});
