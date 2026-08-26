import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Offer } from '../../models/Offer';
import { StarRating } from '../common/StarRating';
import { AppButton } from '../common/AppButton';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing, Shadow } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

interface OfferCardProps {
  offer: Offer;
  patientBudget: number;
  onAccept: (offer: Offer) => void;
}

export const OfferCard: React.FC<OfferCardProps> = ({
  offer,
  patientBudget,
  onAccept,
}) => {
  const navigation = useNavigation<any>();
  const discount = patientBudget - offer.amount;
  const isBelowBudget = offer.amount <= patientBudget;

  const handleViewProfile = () => {
    const mockPsychologist = {
      id: offer.psychologistId,
      displayName: offer.psychologistName,
      specialty: offer.psychologistSpecialty,
      rating: offer.psychologistRating,
      totalReviews: 0,
      photoURL: offer.psychologistPhotoURL,
      isVerified: true,
      isAvailable: true,
      modalities: ['chat', 'call'],
      pricePerHour: offer.amount,
      licenseNumber: 'PSY-NI-VERIFICADO',
      bio: undefined,
    };

    navigation.navigate('PsychologistProfile', {
      psychologist: mockPsychologist,
      offerAmount: offer.amount,
      onAccept: () => onAccept(offer),
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleViewProfile} style={styles.avatarContainer}>
          {offer.psychologistPhotoURL ? (
            <Image source={{ uri: offer.psychologistPhotoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <MaterialIcons name="person" size={28} color={Colors.primary} />
            </View>
          )}
          <View style={styles.onlineDot} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.info} onPress={handleViewProfile} activeOpacity={0.7}>
          <Text style={styles.name} numberOfLines={1}>
            {offer.psychologistName}
          </Text>
          <Text style={styles.specialty} numberOfLines={1}>
            {offer.psychologistSpecialty}
          </Text>
          <StarRating
            rating={offer.psychologistRating}
            size={13}
            showValue={true}
          />
        </TouchableOpacity>

        <View style={styles.priceCol}>
          <Text style={[styles.price, !isBelowBudget && styles.priceOver]}>
            C${offer.amount}
          </Text>
          {isBelowBudget && discount > 0 && (
            <View style={styles.savingsBadge}>
              <MaterialIcons name="arrow-downward" size={10} color={Colors.accentDark} />
              <Text style={styles.savingsText}>C${discount} menos</Text>
            </View>
          )}
          {!isBelowBudget && (
            <View style={styles.overBudgetBadge}>
              <MaterialIcons name="arrow-upward" size={10} color={Colors.error} />
              <Text style={styles.overBudgetText}>Sobre tu límite</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.actions}>
        <TouchableOpacity style={styles.profileBtn} onPress={handleViewProfile}>
          <MaterialIcons name="person-outline" size={16} color={Colors.primary} />
          <Text style={styles.profileBtnText}>Ver perfil</Text>
        </TouchableOpacity>

        <AppButton
          label="Aceptar oferta"
          onPress={() => onAccept(offer)}
          variant="primary"
          size="sm"
          icon={<MaterialIcons name="check-circle" size={16} color={Colors.primary} />}
        />
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
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    ...Shadow.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  avatarPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  info: {
    flex: 1,
    gap: Spacing.xxs,
  },
  name: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  specialty: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  priceCol: {
    alignItems: 'flex-end',
    gap: Spacing.xxs,
  },
  price: {
    ...Typography.priceSm,
    color: Colors.primary,
  },
  priceOver: {
    color: Colors.error,
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 2,
    gap: 4,
  },
  savingsText: {
    ...Typography.caption,
    color: Colors.accentDark,
    fontWeight: '600',
  },
  overBudgetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 2,
    gap: 4,
  },
  overBudgetText: {
    ...Typography.caption,
    color: Colors.error,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  profileBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'transparent',
  },
  profileBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
});
