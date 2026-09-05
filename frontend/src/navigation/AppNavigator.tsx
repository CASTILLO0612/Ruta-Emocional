import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import {
  CalendarDays,
  CircleUserRound,
  ClipboardList,
  FolderHeart,
  Home,
  Search,
} from 'lucide-react-native';

import { Colors } from '../theme/colors';
import { IconStroke } from '../theme/icons';
import { FontFamily, FontSize } from '../theme/typography';
import { useAuthStore } from '../store/useAuthStore';
import { useRequestStore } from '../store/useRequestStore';
import { HomeScreen } from '../screens/patient/HomeScreen';
import { SearchTabScreen } from '../screens/patient/SearchTabScreen';
import { RadarScreen } from '../screens/patient/RadarScreen';
import { AcceptedOfferScreen } from '../screens/patient/AcceptedOfferScreen';
import { MentaScreen as MentaSafetyScreen } from '../screens/patient/MentaScreen';
import { MentaAgentScreen } from '../screens/shared/MentaAgentScreen';
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

const tabScreenOptions = {
  headerShown: false,
  sceneStyle: { backgroundColor: Colors.background },
  tabBarStyle: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.divider,
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingTop: 8,
    height: 68,
  },
  tabBarActiveTintColor: Colors.primary,
  tabBarInactiveTintColor: Colors.textTertiary,
  tabBarLabelStyle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
  },
} satisfies BottomTabNavigationOptions;

const professionalTabScreenOptions = {
  ...tabScreenOptions,
  tabBarLabelStyle: {
    ...tabScreenOptions.tabBarLabelStyle,
    fontSize: FontSize.navigation,
  },
} satisfies BottomTabNavigationOptions;

const tabIconProps = (size: number, color: string) => ({
  size,
  color,
  strokeWidth: IconStroke.regular,
});

function PatientTabs() {
  return (
    <PatientTab.Navigator screenOptions={tabScreenOptions}>
      <PatientTab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <Home {...tabIconProps(size, color)} />
          ),
        }}
      />
      <PatientTab.Screen
        name="Search"
        component={SearchTabScreen}
        options={{
          tabBarLabel: 'Buscar',
          tabBarIcon: ({ color, size }) => (
            <Search {...tabIconProps(size, color)} />
          ),
        }}
      />
      <PatientTab.Screen
        name="Appointments"
        component={AgendaScreen}
        options={{
          tabBarLabel: 'Citas',
          tabBarIcon: ({ color, size }) => (
            <CalendarDays {...tabIconProps(size, color)} />
          ),
        }}
      />
      <PatientTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <CircleUserRound {...tabIconProps(size, color)} />
          ),
        }}
      />
    </PatientTab.Navigator>
  );
}

function PsychologistTabs() {
  return (
    <PsychologistTab.Navigator screenOptions={professionalTabScreenOptions}>
      <PsychologistTab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Solicitudes',
          tabBarIcon: ({ color, size }) => (
            <ClipboardList {...tabIconProps(size, color)} />
          ),
        }}
      />
      <PsychologistTab.Screen
        name="History"
        component={AgendaScreen}
        options={{
          tabBarLabel: 'Agenda',
          tabBarIcon: ({ color, size }) => (
            <CalendarDays {...tabIconProps(size, color)} />
          ),
        }}
      />
      <PsychologistTab.Screen
        name="Clinical"
        component={ClinicalRecordsScreen}
        options={{
          tabBarLabel: 'Pacientes',
          tabBarIcon: ({ color, size }) => (
            <FolderHeart {...tabIconProps(size, color)} />
          ),
        }}
      />
      <PsychologistTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <CircleUserRound {...tabIconProps(size, color)} />
          ),
        }}
      />
    </PsychologistTab.Navigator>
  );
}

export const AppNavigator: React.FC = () => {
  const { role, userProfile } = useAuthStore();
  const canUsePsychologistWorkspace = userProfile?.capabilities.includes(
    'service_request:read:eligible'
  ) ?? false;
  const canManageProfessionalVerifications = userProfile?.capabilities.includes(
    'psychologist_verification:manage'
  ) ?? false;

  useEffect(() => {
    if (!userProfile?.id) return;

    useRequestStore.getState().bindSession(userProfile.id);
    if (role === 'patient') {
      void useRequestStore.getState().rehydrateActiveSearch(userProfile.id);
    }
  }, [role, userProfile?.id]);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {canManageProfessionalVerifications ? (
        <Stack.Screen name="AdminVerification" component={VerificationQueueScreen} />
      ) : role === 'psychologist' && canUsePsychologistWorkspace ? (
        <>
          <Stack.Screen name="PsychologistMain" component={PsychologistTabs} />
          <Stack.Screen name="Consultation" component={ConversationScreen} />
          <Stack.Screen name="MentaAgent" component={MentaAgentScreen} />
          <Stack.Screen name="Inbox" component={InboxScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
        </>
      ) : role === 'psychologist' ? (
        <Stack.Screen name="PsychologistVerification" component={VerificationScreen} />
      ) : (
        <>
          <Stack.Screen name="PatientMain" component={PatientTabs} />
          <Stack.Screen name="Radar" component={RadarScreen} />
          <Stack.Screen name="AcceptedOffer" component={AcceptedOfferScreen} />
          <Stack.Screen name="Consultation" component={ConversationScreen} />
          <Stack.Screen name="MentaAgent" component={MentaAgentScreen} />
          <Stack.Screen name="Inbox" component={InboxScreen} />
          <Stack.Screen name="MentaSafety" component={MentaSafetyScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="PsychologistProfile" component={PsychologistProfileScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};
