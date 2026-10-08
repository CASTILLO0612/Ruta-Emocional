jest.mock('expo-constants', () => ({ expoConfig: null, easConfig: null }));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
jest.mock('../../services/apiClient', () => ({ apiV1Request: jest.fn() }));

import { readPushNavigationData } from '../../services/pushNotifications';

describe('readPushNavigationData', () => {
  it('acepta exclusivamente destinos internos conocidos', () => {
    expect(readPushNavigationData({
      kind: 'MESSAGE',
      conversationId: 'conversation-1',
      text: 'contenido que no debe usarse para navegar',
    })).toEqual({ kind: 'MESSAGE', conversationId: 'conversation-1' });
    expect(readPushNavigationData({
      kind: 'APPOINTMENT',
      appointmentId: 'appointment-1',
    })).toEqual({ kind: 'APPOINTMENT', appointmentId: 'appointment-1' });
    expect(readPushNavigationData({ kind: 'VERIFICATION' })).toEqual({ kind: 'VERIFICATION' });
  });

  it('ignora cargas incompletas o destinos manipulados', () => {
    expect(readPushNavigationData({ kind: 'MESSAGE' })).toBeNull();
    expect(readPushNavigationData({ kind: 'EXTERNAL_URL', url: 'https://example.test' })).toBeNull();
    expect(readPushNavigationData({})).toBeNull();
  });
});
