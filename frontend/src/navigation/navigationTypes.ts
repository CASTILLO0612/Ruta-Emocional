import type {
  CompositeNavigationProp,
  NavigatorScreenParams,
  RouteProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type PatientTabParamList = {
  Home: undefined;
  Messages: undefined;
  History: undefined;
  Profile: undefined;
};

export type PsychologistTabParamList = {
  Dashboard: undefined;
  Clinical: undefined;
  Messages: undefined;
  History: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  Login: undefined;
  Register: undefined;
  PatientMain: NavigatorScreenParams<PatientTabParamList> | undefined;
  PsychologistMain: NavigatorScreenParams<PsychologistTabParamList> | undefined;
  PsychologistVerification: undefined;
  AdminVerification: undefined;
  Radar: undefined;
  Consultation: { conversationId: string };
  Profile: undefined;
  PsychologistProfile: {
    psychologistId: string;
  };
};

export type AppNavigation = NativeStackNavigationProp<AppStackParamList>;

export type PatientHomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<PatientTabParamList, 'Home'>,
  AppNavigation
>;

export type PsychologistProfileRoute = RouteProp<AppStackParamList, 'PsychologistProfile'>;
