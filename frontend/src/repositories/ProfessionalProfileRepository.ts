import { DirectoryModality } from '../models/Psychologist';
import {
  ProfessionalCatalogs,
  ProfessionalProfile,
  SpecialtyCatalogItem,
  WeeklyAvailabilityRule,
} from '../models/ProfessionalProfile';
import { apiV1Request } from '../services/apiClient';

interface Envelope<T> {
  readonly data: T;
}

export async function getSpecialtyCatalog(signal?: AbortSignal): Promise<readonly SpecialtyCatalogItem[]> {
  const response = await apiV1Request<Envelope<readonly SpecialtyCatalogItem[]>>(
    '/catalogs/specialties',
    'GET',
    undefined,
    { authenticated: false, signal }
  );
  return response.data;
}

export async function getProfessionalCatalogs(signal?: AbortSignal): Promise<ProfessionalCatalogs> {
  const response = await apiV1Request<Envelope<{
    readonly codes: readonly DirectoryModality[];
    readonly currencies: readonly string[];
  }>>('/catalogs/modalities', 'GET', undefined, { authenticated: false, signal });
  return { modalities: response.data.codes, currencies: response.data.currencies };
}

export async function getOwnProfessionalProfile(signal?: AbortSignal): Promise<ProfessionalProfile> {
  const response = await apiV1Request<Envelope<ProfessionalProfile>>(
    '/psychologists/me',
    'GET',
    undefined,
    { signal }
  );
  return response.data;
}

export async function updateProfessionalBio(bio: string | null): Promise<ProfessionalProfile> {
  const response = await apiV1Request<Envelope<ProfessionalProfile>>(
    '/psychologists/me',
    'PATCH',
    { bio }
  );
  return response.data;
}

export async function replaceProfessionalSpecialties(
  specialtyCodes: readonly string[],
  primarySpecialtyCode: string
): Promise<ProfessionalProfile> {
  const response = await apiV1Request<Envelope<ProfessionalProfile>>(
    '/psychologists/me/specialties',
    'PUT',
    { specialtyCodes, primarySpecialtyCode }
  );
  return response.data;
}

export async function configureProfessionalModality(
  modality: DirectoryModality,
  amount: string,
  currency: string,
  isEnabled: boolean
): Promise<ProfessionalProfile> {
  const response = await apiV1Request<Envelope<ProfessionalProfile>>(
    `/psychologists/me/modalities/${modality}`,
    'PUT',
    { pricePerHour: { amount, currency }, isEnabled }
  );
  return response.data;
}

export async function replaceProfessionalAvailability(
  timezone: string,
  rules: readonly WeeklyAvailabilityRule[]
): Promise<ProfessionalProfile> {
  const response = await apiV1Request<Envelope<ProfessionalProfile>>(
    '/psychologists/me/availability',
    'PUT',
    { timezone, rules }
  );
  return response.data;
}
