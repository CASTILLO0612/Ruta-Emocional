import 'react-native-gesture-handler';
import React from 'react';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import type { AuthStackParamList } from './src/navigation/navigationTypes';
import { AlertProvider } from './src/components/common/AlertProvider';
import { BrandLogo } from './src/components/common/BrandLogo';
import { ErrorBoundary } from './src/components/common/ErrorBoundary';
import { useAuthStore } from './src/store/useAuthStore';
import { Colors } from './src/theme/colors';
import { Spacing } from './src/theme/spacing';

const authLinking: LinkingOptions<AuthStackParamList> = {
  prefixes: ['rutaemocional://'],
  config: {
    screens: {
      Login: 'ingresar',
      Register: 'crear-cuenta',
      ForgotPassword: 'recuperar-acceso',
      ResetPassword: 'restablecer-contrasena',
      LegalInformation: 'informacion/:section',
    },
  },
};

void SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const { isAuthenticated, isLoading, initializeSession } = useAuthStore();

  React.useEffect(() => {
    void initializeSession();
  }, [initializeSession]);

  React.useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const content = isLoading ? (
      <View style={styles.loading}>
        <BrandLogo size="standard" variant="positive" />
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
  ) : (
    <GestureHandlerRootView style={styles.root}>
      <AlertProvider>
        <NavigationContainer linking={isAuthenticated ? undefined : authLinking}>
          {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
        </NavigationContainer>
      </AlertProvider>
    </GestureHandlerRootView>
  );

  return <ErrorBoundary>{content}</ErrorBoundary>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: Spacing.md,
  },
});
