import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { Colors } from '../theme/colors';
import { useAuthStore } from '../store/useAuthStore';

import { LoginScreen, RegisterScreen } from '../screens/auth/AuthScreens';
import { HomeScreen } from '../screens/patient/HomeScreen';
import { RadarScreen } from '../screens/patient/RadarScreen';
import { DashboardScreen } from '../screens/psychologist/DashboardScreen';
import { VerificationScreen } from '../screens/psychologist/VerificationScreen';
import { MentaScreen } from '../screens/shared/MentaScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { HistoryScreen } from '../screens/shared/HistoryScreen';
import { PsychologistProfileScreen } from '../screens/shared/PsychologistProfileScreen';
import { InboxScreen } from '../screens/shared/InboxScreen';
import {
  ConsultationScreen,
  RouteTrackingScreen,
} from '../screens/shared/ConsultationAndRoute';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function PatientTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.divider,
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 6,
          height: 62,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textDisabled,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Menta"
        component={MentaScreen}
        options={{
          tabBarLabel: 'MENTA',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="psychology" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={InboxScreen}
        options={{
          tabBarLabel: 'Mensajes',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="chat" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'Historial',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="history" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function PsychologistTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.divider,
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 6,
          height: 62,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textDisabled,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Solicitudes',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Menta"
        component={MentaScreen}
        options={{
          tabBarLabel: 'MENTA',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="psychology" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={InboxScreen}
        options={{
          tabBarLabel: 'Mensajes',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="chat" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'Historial',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="history" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, role, userProfile, initializeSession } = useAuthStore();
  const canUsePsychologistWorkspace = userProfile?.capabilities.includes(
    'service_request:read:eligible'
  ) ?? false;

  useEffect(() => {
    void initializeSession();
  }, [initializeSession]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : role === 'psychologist' && canUsePsychologistWorkspace ? (
          <>
            <Stack.Screen name="PsychologistMain" component={PsychologistTabs} />
            <Stack.Screen name="Consultation" component={ConsultationScreen} />
            <Stack.Screen name="Route" component={RouteTrackingScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </>
        ) : role === 'psychologist' ? (
          <Stack.Screen name="PsychologistVerification" component={VerificationScreen} />
        ) : (
          <>
            <Stack.Screen name="PatientMain" component={PatientTabs} />
            <Stack.Screen name="Radar" component={RadarScreen} />
            <Stack.Screen name="Consultation" component={ConsultationScreen} />
            <Stack.Screen name="Route" component={RouteTrackingScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="PsychologistProfile" component={PsychologistProfileScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
