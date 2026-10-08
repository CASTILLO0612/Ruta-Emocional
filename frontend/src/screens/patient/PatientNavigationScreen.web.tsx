import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { AppButton } from '../../components/common/AppButton';
import { AppHeader } from '../../components/shared/AppHeader';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { openExternalNavigation } from '../../utils/externalNavigation';
import type {
  AppNavigation,
  TurnByTurnNavigationRoute,
} from '../../navigation/navigationTypes';

export const PatientNavigationScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigation>();
  const route = useRoute<TurnByTurnNavigationRoute>();
  const destination = route.params.destination;

  const openNavigation = async (provider: 'GOOGLE_MAPS' | 'WAZE') => {
    await openExternalNavigation(provider, destination);
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Cómo llegar" showBack onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <Text style={styles.title}>Continúa en tu navegador</Text>
        <Text style={styles.body}>
          Abre la ruta hacia {destination.name} con el servicio que prefieras.
        </Text>
        <View style={styles.actions}>
          <AppButton
            label="Abrir Google Maps"
            onPress={() => void openNavigation('GOOGLE_MAPS')}
            variant="primary"
            fullWidth
          />
          <AppButton
            label="Abrir Waze"
            onPress={() => void openNavigation('WAZE')}
            variant="outline"
            fullWidth
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    alignSelf: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 520,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  body: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
