import { apiV1Request } from '../services/apiClient';
import { resolveApiAssetUrl } from '../config/runtimeConfig';
import { DirectoryModality, Modality, Psychologist } from '../models/Psychologist';

interface DirectoryDto {
  readonly id: string;
  readonly displayName: string;
  readonly photoUrl: string | null;
  readonly bio: string | null;
  readonly specialties: readonly { readonly code: string; readonly name: string }[];
  readonly primarySpecialty: { readonly code: string; readonly name: string } | null;
  readonly modalities: readonly {
    readonly code: DirectoryModality;
    readonly pricePerHour: { readonly amount: string; readonly currency: string };
  }[];
  readonly rating: { readonly average: string | null; readonly count: number };
  readonly availability: { readonly hasWeeklySchedule: boolean };
  readonly credential: { readonly authority: string; readonly status: 'VERIFIED' };
  readonly approximateDistanceKm?: string;
}

interface DirectoryEnvelope {
  readonly data: readonly DirectoryDto[];
  readonly meta: { readonly nextCursor: string | null; readonly requestId: string };
}

interface DetailEnvelope {
  readonly data: DirectoryDto;
}

export interface DirectoryQuery {
  readonly specialty?: string;
  readonly modality?: DirectoryModality;
  readonly minPrice?: string;
  readonly maxPrice?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly radiusKm?: number;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface PsychologistDirectoryPage {
  readonly items: readonly Psychologist[];
  readonly nextCursor: string | null;
}

const MODALITY_VIEW: Readonly<Record<DirectoryModality, Modality>> = {
  CHAT: 'chat',
  CALL: 'call',
  IN_PERSON: 'in-person',
};

function toView(dto: DirectoryDto): Psychologist {
  const lowestPrice = dto.modalities.reduce<DirectoryDto['modalities'][number] | null>(
    (selected, modality) => !selected || Number(modality.pricePerHour.amount) < Number(selected.pricePerHour.amount)
      ? modality
      : selected,
    null
  );
  if (!lowestPrice) {
    throw new Error('El perfil público no contiene una modalidad habilitada.');
  }

  return {
    id: dto.id,
    displayName: dto.displayName,
    photoURL: resolveApiAssetUrl(dto.photoUrl) ?? undefined,
    specialty: dto.primarySpecialty?.name ?? dto.specialties[0]?.name ?? '',
    specialties: dto.specialties,
    rating: dto.rating.average === null ? 0 : Number(dto.rating.average),
    totalReviews: dto.rating.count,
    pricePerHour: lowestPrice.pricePerHour.amount,
    currencyCode: lowestPrice.pricePerHour.currency,
    modalities: dto.modalities.map(({ code }) => MODALITY_VIEW[code]),
    isAvailable: dto.availability.hasWeeklySchedule,
    bio: dto.bio ?? undefined,
    credentialAuthority: dto.credential.authority,
    approximateDistanceKm: dto.approximateDistanceKm,
  };
}

function queryString(query: DirectoryQuery): string {
  const parameters = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) parameters.set(key, String(value));
  });
  const value = parameters.toString();
  return value ? `?${value}` : '';
}

export async function getAvailablePsychologists(
  query: DirectoryQuery = {},
  signal?: AbortSignal
): Promise<Psychologist[]> {
  return [...(await getAvailablePsychologistPage(query, signal)).items];
}

export async function getAvailablePsychologistPage(
  query: DirectoryQuery = {},
  signal?: AbortSignal
): Promise<PsychologistDirectoryPage> {
  const response = await apiV1Request<DirectoryEnvelope>(
    `/psychologists${queryString(query)}`,
    'GET',
    undefined,
    { authenticated: false, signal }
  );
  return {
    items: response.data.map(toView),
    nextCursor: response.meta.nextCursor,
  };
}

export async function getPsychologistById(
  psychologistId: string,
  signal?: AbortSignal
): Promise<Psychologist> {
  const response = await apiV1Request<DetailEnvelope>(
    `/psychologists/${encodeURIComponent(psychologistId)}`,
    'GET',
    undefined,
    { authenticated: false, signal }
  );
  return toView(response.data);
}

export function getNearbyPsychologists(
  latitude: number,
  longitude: number,
  radiusKm: number,
  signal?: AbortSignal
): Promise<Psychologist[]> {
  return getAvailablePsychologists({ latitude, longitude, radiusKm }, signal);
}
