import React from 'react';
import {
  NavigationProvider,
  TaskRemovedBehavior,
} from '@googlemaps/react-native-navigation-sdk';

import { Colors } from '../theme/colors';

interface GoogleNavigationProviderProps {
  readonly children: React.ReactNode;
}

export const GoogleNavigationProvider: React.FC<GoogleNavigationProviderProps> = ({
  children,
}) => (
  <NavigationProvider
    taskRemovedBehavior={TaskRemovedBehavior.QUIT_SERVICE}
    termsAndConditionsDialogOptions={{
      title: 'Navegación de Ruta Emocional',
      companyName: 'Ruta Emocional',
      showOnlyDisclaimer: false,
      uiParams: {
        backgroundColor: Colors.background,
        titleColor: Colors.textPrimary,
        mainTextColor: Colors.textSecondary,
        acceptButtonTextColor: Colors.primary,
        cancelButtonTextColor: Colors.textTertiary,
      },
    }}
  >
    {children}
  </NavigationProvider>
);
