import type {
  CompositeNavigationProp,
  NavigatorScreenParams,
  RouteProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { Modality } from '../models/Psychologist';

export type PatientTabParamList = {
  Home: undefined;
  Menta: undefined;
  Messages: undefined;
  History: undefined;
  Profile: undefined;
};

export type PsychologistTabParamList = {
  Dashboard: undefined;
  Menta: undefined;
  Messages: undefined;
  History: undefined;
  Profile: undefined;
};

type SessionRouteParams = {
  requestId?: string;
  psychologistName?: string;
  psychologistPhotoURL?: string;
  modality?: Modality;
  amount?: number;
};

export type AppStackParamList = {
  Login: undefined;
  Register: undefined;
  PatientMain: NavigatorScreenParams<PatientTabParamList> | undefined;
  PsychologistMain: NavigatorScreenParams<PsychologistTabParamList> | undefined;
  PsychologistVerification: undefined;
  Radar: undefined;
  Consultation: SessionRouteParams | undefined;
  Route: SessionRouteParams | undefined;
  Profile: undefined;
  PsychologistProfile: {
    psychologistId: string;
    offerAmount?: number;
    onAccept?: () => void;
  };
};

export type AppNavigation = NativeStackNavigationProp<AppStackParamList>;

export type PatientHomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<PatientTabParamList, 'Home'>,
  AppNavigation
>;

export type PsychologistProfileRoute = RouteProp<AppStackParamList, 'PsychologistProfile'>;
