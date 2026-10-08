import type {
  CompositeNavigationProp,
  NavigationProp,
  NavigatorScreenParams,
  RouteProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Modality } from '../models/Psychologist';

export type PatientTabParamList = {
  Home: undefined;
  Search: undefined;
  Appointments: undefined;
  Profile: undefined;
};

export type PsychologistTabParamList = {
  Dashboard: undefined;
  History: undefined;
  Clinical: undefined;
  Profile: undefined;
};

export type InPersonDestination = {
  readonly name: string;
  readonly address: string;
  readonly directions: string | null;
  readonly latitude: number;
  readonly longitude: number;
};

export type AcceptedOfferSummaryParams = {
  readonly requestId: string;
  readonly offerId: string;
  readonly careRelationshipId: string;
  readonly conversationId: string;
  readonly psychologistId: string;
  readonly psychologistName: string;
  readonly psychologistPhotoURL?: string;
  readonly psychologistSpecialty?: string;
  readonly psychologistRating?: number;
  readonly amountDecimal: string;
  readonly currencyCode: string;
  readonly modality: Modality;
  readonly scheduledFor?: string;
  readonly inPersonDestination?: InPersonDestination;
};

export type LegalSection = 'privacy' | 'terms' | 'help';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { readonly token?: string } | undefined;
  LegalInformation: { readonly section: LegalSection };
};

export type AppStackParamList = {
  PatientMain: NavigatorScreenParams<PatientTabParamList> | undefined;
  PsychologistMain: NavigatorScreenParams<PsychologistTabParamList> | undefined;
  PsychologistVerification: undefined;
  AdminVerification: undefined;
  Radar: undefined;
  AcceptedOffer: AcceptedOfferSummaryParams;
  TurnByTurnNavigation: { readonly destination: InPersonDestination };
  Consultation: { readonly conversationId: string };
  CallSession: {
    readonly conversationId: string;
    readonly mediaType: 'AUDIO' | 'VIDEO';
    readonly direction: 'OUTGOING' | 'INCOMING';
    readonly callId?: string;
  };
  MentaAgent: undefined;
  Inbox: undefined;
  Profile: undefined;
  LegalNotices: undefined;
  PsychologistProfile: {
    readonly psychologistId: string;
  };
  ProfessionalDirectory: undefined;
};

export type AppNavigation = NativeStackNavigationProp<AppStackParamList>;
export type AuthNavigation = NavigationProp<AuthStackParamList>;

export type PatientHomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<PatientTabParamList, 'Home'>,
  AppNavigation
>;

export type PatientSearchNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<PatientTabParamList, 'Search'>,
  AppNavigation
>;

export type PsychologistProfileRoute = RouteProp<
  AppStackParamList,
  'PsychologistProfile'
>;

export type AcceptedOfferRoute = RouteProp<
  AppStackParamList,
  'AcceptedOffer'
>;

export type TurnByTurnNavigationRoute = RouteProp<
  AppStackParamList,
  'TurnByTurnNavigation'
>;
