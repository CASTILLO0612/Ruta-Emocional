import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useRequestStore } from '../../store/useRequestStore';
import { Colors } from '../../theme/colors';
import { AppHeader } from '../../components/shared/AppHeader';
import { ActiveSearchSummary } from '../../components/patient/ActiveSearchSummary';
import { RequestWizardScreen } from './RequestWizardScreen';
import type { PatientSearchNavigation } from '../../navigation/navigationTypes';

export const SearchTabScreen: React.FC = () => {
  const activeRequest = useRequestStore((state) => state.activeRequest);
  const incomingOffers = useRequestStore((state) => state.incomingOffers);
  const navigation = useNavigation<PatientSearchNavigation>();

  const hasActiveSearch =
    activeRequest?.status === 'pending' || activeRequest?.status === 'bidding';

  if (hasActiveSearch && activeRequest) {
    return (
      <View style={styles.container}>
        <AppHeader title="Buscar" showBrandMark showMenta showInbox />
        <ActiveSearchSummary
          request={activeRequest}
          incomingOfferCount={incomingOffers.length}
          onOpenRadar={() => navigation.navigate('Radar')}
        />
      </View>
    );
  }

  return <RequestWizardScreen />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
