import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { Colors } from '../theme/colors';
import { useAuthStore } from '../store/useAuthStore';

import { LoginScreen, RegisterScreen } from '../screens/auth/AuthScreens';
import { HomeScreen } from '../screens/patient/HomeScreen';
import { RadarScreen } from '../screens/patient/RadarScreen';
import { MentaScreen } from '../screens/patient/MentaScreen';
import { DashboardScreen } from '../screens/psychologist/DashboardScreen';
import { VerificationScreen } from '../screens/psychologist/VerificationScreen';
import { VerificationQueueScreen } from '../screens/admin/VerificationQueueScreen';
import { ClinicalRecordsScreen } from '../screens/psychologist/ClinicalRecordsScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { AgendaScreen } from '../screens/shared/AgendaScreen';
import { PsychologistProfileScreen } from '../screens/shared/PsychologistProfileScreen';
import { InboxScreen } from '../screens/shared/InboxScreen';
import { ConversationScreen } from '../screens/shared/ConversationScreen';
import type {
  AppStackParamList,
  PatientTabParamList,
  PsychologistTabParamList,
} from './navigationTypes';

const Stack = createNativeStackNavigator<AppStackParamList>();
const PatientTab = createBottomTabNavigator<PatientTabParamList>();
const PsychologistTab = createBottomTabNavigator<PsychologistTabParamList>();

function PatientTabs() {
  return (
    <PatientTab.Navigator
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
      <PatientTab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <PatientTab.Screen
        name="Menta"
        component={MentaScreen}
        options={{
          tabBarLabel: 'Orientación',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="health-and-safety" size={size} color={color} />
          ),
        }}
      />
      <PatientTab.Screen
        name="Messages"
        component={InboxScreen}
        options={{
          tabBarLabel: 'Mensajes',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="chat" size={size} color={color} />
          ),
        }}
      />
      <PatientTab.Screen
        name="History"
        component={AgendaScreen}
        options={{
          tabBarLabel: 'Agenda',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="event-note" size={size} color={color} />
          ),
        }}
      />
      <PatientTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />
    </PatientTab.Navigator>
  );
}

function PsychologistTabs() {
  return (
    <PsychologistTab.Navigator
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
      <PsychologistTab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Solicitudes',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="dashboard" size={size} color={color} />
          ),
        }}
      />
      <PsychologistTab.Screen
        name="Clinical"
        component={ClinicalRecordsScreen}
        options={{
          tabBarLabel: 'Pacientes',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="folder-shared" size={size} color={color} />
          ),
        }}
      />
      <PsychologistTab.Screen
        name="Messages"
        component={InboxScreen}
        options={{
          tabBarLabel: 'Mensajes',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="chat" size={size} color={color} />
          ),
        }}
      />
      <PsychologistTab.Screen
        name="History"
        component={AgendaScreen}
        options={{
          tabBarLabel: 'Agenda',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="event-note" size={size} color={color} />
          ),
        }}
      />
      <PsychologistTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />
    </PsychologistTab.Navigator>
  );
}

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, role, userProfile, initializeSession } = useAuthStore();
  const canUsePsychologistWorkspace = userProfile?.capabilities.includes(
    'service_request:read:eligible'
  ) ?? false;
  const canManageProfessionalVerifications = userProfile?.capabilities.includes(
    'psychologist_verification:manage'
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
        ) : canManageProfessionalVerifications ? (
          <Stack.Screen name="AdminVerification" component={VerificationQueueScreen} />
        ) : role === 'psychologist' && canUsePsychologistWorkspace ? (
          <>
            <Stack.Screen name="PsychologistMain" component={PsychologistTabs} />
            <Stack.Screen name="Consultation" component={ConversationScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </>
        ) : role === 'psychologist' ? (
          <Stack.Screen name="PsychologistVerification" component={VerificationScreen} />
        ) : (
          <>
            <Stack.Screen name="PatientMain" component={PatientTabs} />
            <Stack.Screen name="Radar" component={RadarScreen} />
            <Stack.Screen name="Consultation" component={ConversationScreen} />
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
