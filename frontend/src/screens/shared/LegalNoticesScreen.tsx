import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { WebView } from '@expo/dom-webview';
import { Asset } from 'expo-asset';

import { AppHeader } from '../../components/shared/AppHeader';
import type { AppNavigation } from '../../navigation/navigationTypes';
import { Colors } from '../../theme/colors';

const legalNoticesAsset = Asset.fromModule(
  require('../../../assets/legal/google-navigation-legal.html')
);

export const LegalNoticesScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigation>();

  return (
    <View style={styles.root}>
      <AppHeader
        title="Avisos legales"
        showBack
        showBrand={false}
        onBack={() => navigation.goBack()}
      />
      <WebView
        source={{ uri: legalNoticesAsset.uri }}
        containerStyle={styles.content}
        style={styles.content}
        showsHorizontalScrollIndicator={false}
        accessibilityLabel="Atribuciones y licencias de navegación"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
