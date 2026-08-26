import { apiRequest } from '../services/apiClient';
import { Psychologist } from '../models/Psychologist';
import { MOCK_PSYCHOLOGISTS } from '../scripts/seedData';

export async function getAvailablePsychologists(): Promise<Psychologist[]> {
  try {
    const list = await apiRequest<any[]>('/psychologists', 'GET');
    if (Array.isArray(list) && list.length > 0) {
      return list.map((item) => ({
        ...item,
        id: item._id || item.id,
      }));
    }
    return MOCK_PSYCHOLOGISTS;
  } catch (error) {
    console.warn('[PsychologistRepository] Usando psicólogos iniciales por defecto:', error);
    return MOCK_PSYCHOLOGISTS;
  }
}

export async function getNearbyPsychologists(
  latitude: number,
  longitude: number,
  radiusKm: number = 10
): Promise<Psychologist[]> {
  try {
    const list = await apiRequest<any[]>(
      `/psychologists/nearby?lat=${latitude}&lng=${longitude}&radiusKm=${radiusKm}`,
      'GET'
    );
    if (Array.isArray(list) && list.length > 0) {
      return list.map((item) => ({
        ...item,
        id: item._id || item.id,
      }));
    }
    return MOCK_PSYCHOLOGISTS;
  } catch (error) {
    return MOCK_PSYCHOLOGISTS;
  }
}

export async function upsertPsychologist(
  psychologist: Partial<Psychologist> & { userId?: string; id?: string }
): Promise<void> {
  try {
    await apiRequest('/psychologists/location', 'PUT', psychologist);
  } catch (error) {
    console.warn(`[upsertPsychologist warning]: ${error}`);
  }
}

export function listenToPsychologistAvailability(
  psychologistId: string,
  callback: (psychologist: Psychologist | null) => void
): () => void {
  let isSubscribed = true;

  const fetchPsychologist = async () => {
    try {
      const list = await getAvailablePsychologists();
      const match = list.find((p) => p.id === psychologistId);
      if (isSubscribed) {
        callback(match || null);
      }
    } catch (err) {
      console.warn('[PsychologistRepository] Error consultando psicólogo:', err);
    }
  };

  fetchPsychologist();
  const intervalId = setInterval(fetchPsychologist, 3000);

  return () => {
    isSubscribed = false;
    clearInterval(intervalId);
  };
}
