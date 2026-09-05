import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LoginScreen, RegisterScreen } from '../screens/auth/AuthScreens';
import { LegalInformationScreen } from '../screens/auth/LegalInformationScreen';
import {
  ForgotPasswordScreen,
  ResetPasswordScreen,
} from '../screens/auth/PasswordRecoveryScreens';
import type { AuthStackParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="LegalInformation" component={LegalInformationScreen} />
    </Stack.Navigator>
  );
}
