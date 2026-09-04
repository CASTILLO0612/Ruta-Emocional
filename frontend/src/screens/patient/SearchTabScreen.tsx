/**
 * SearchTabScreen — Controlador principal de la pestaña Buscar del paciente.
 *
 * Arquitectura 10/10:
 * - Si el paciente tiene una solicitud activa (PENDING o BIDDING), muestra
 *   ActiveSearchSummary con el botón para abrir RadarScreen en AppStack.
 * - Si no existe solicitud activa, muestra RequestWizardScreen para crear una.
 * - RadarScreen NUNCA se renderiza como hijo directo del navegador de pestañas;
 *   permanece registrado en el AppStack raíz para preservar la semántica de navegación
 *   (replace, goBack y el botón físico de Android).
 */
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
        <AppHeader title="Búsqueda activa" showBrandMark showMenta showInbox />
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
