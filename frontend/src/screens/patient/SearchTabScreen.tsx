import React, { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useRequestStore } from '../../store/useRequestStore';
import { Colors } from '../../theme/colors';
import { RequestWizardScreen } from './RequestWizardScreen';
import type { PatientSearchNavigation } from '../../navigation/navigationTypes';

export const SearchTabScreen: React.FC = () => {
  const activeRequest = useRequestStore((state) => state.activeRequest);
  const incomingOffers = useRequestStore((state) => state.incomingOffers);
  const navigation = useNavigation<PatientSearchNavigation>();

  const hasActiveSearch =
    activeRequest?.status === 'pending' || activeRequest?.status === 'bidding';

  useEffect(() => {
    if (hasActiveSearch) navigation.navigate('Radar');
  }, [hasActiveSearch, navigation]);

  if (hasActiveSearch) {
    return (
      <View
        style={styles.transition}
        accessibilityLabel={incomingOffers.length > 0
          ? 'Abriendo propuestas recibidas'
          : 'Abriendo búsqueda activa'}
      >
        <ActivityIndicator
          size="small"
          color={Colors.primary}
        />
      </View>
    );
  }

  return <RequestWizardScreen />;
};

const styles = StyleSheet.create({
  transition: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
