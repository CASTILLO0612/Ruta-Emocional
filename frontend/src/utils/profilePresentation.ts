import type { VerificationStatus } from '../services/AuthService';
import { PROFESSIONAL_BIO_MIN_LENGTH } from '../config/professionalProfile';

const VERIFICATION_LABELS: Readonly<Record<VerificationStatus, string>> = {
  PENDING: 'Verificación pendiente',
  VERIFIED: 'Profesional verificado',
  REJECTED: 'Requiere corrección',
};

export function getProfileRoleLabel(
  isPsychologist: boolean,
  status: VerificationStatus | null | undefined
): string {
  if (!isPsychologist) return 'Paciente';
  return status ? VERIFICATION_LABELS[status] : 'Cuenta profesional';
}

export function isProfessionalBioValid(value: string): boolean {
  const length = value.trim().length;
  return length === 0 || length >= PROFESSIONAL_BIO_MIN_LENGTH;
}
