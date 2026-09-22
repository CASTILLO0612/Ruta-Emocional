import {
  clearMessageDraft,
  loadMessageDraft,
  saveMessageDraft,
} from '../messageDraftPersistence';

const mockSecureDrafts = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureDrafts.set(key, value);
  }),
  getItemAsync: jest.fn(async (key: string) => mockSecureDrafts.get(key) ?? null),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureDrafts.delete(key);
  }),
}));

describe('messageDraftPersistence', () => {
  beforeEach(() => mockSecureDrafts.clear());

  it('aísla los borradores por usuario y conversación', async () => {
    await saveMessageDraft('user-a', 'conversation-a', 'Primer borrador');
    await saveMessageDraft('user-b', 'conversation-a', 'Segundo borrador');

    await expect(loadMessageDraft('user-a', 'conversation-a')).resolves.toBe('Primer borrador');
    await expect(loadMessageDraft('user-b', 'conversation-a')).resolves.toBe('Segundo borrador');
    await expect(loadMessageDraft('user-a', 'conversation-b')).resolves.toBeNull();
  });

  it('elimina el borrador al enviar el mensaje', async () => {
    await saveMessageDraft('user-a', 'conversation-a', 'Mensaje listo');
    await clearMessageDraft('user-a', 'conversation-a');

    await expect(loadMessageDraft('user-a', 'conversation-a')).resolves.toBeNull();
  });
});
