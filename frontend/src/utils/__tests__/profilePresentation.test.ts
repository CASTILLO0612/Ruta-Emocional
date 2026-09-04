import { getProfileRoleLabel, isProfessionalBioValid } from '../profilePresentation';

describe('profilePresentation', () => {
  it('traduce todos los estados profesionales sin exponer códigos internos', () => {
    expect(getProfileRoleLabel(true, 'PENDING')).toBe('Verificación pendiente');
    expect(getProfileRoleLabel(true, 'VERIFIED')).toBe('Profesional verificado');
    expect(getProfileRoleLabel(true, 'REJECTED')).toBe('Requiere corrección');
    expect(getProfileRoleLabel(false, null)).toBe('Paciente');
  });

  it('admite una bio vacía pero no una presentación demasiado breve', () => {
    expect(isProfessionalBioValid('')).toBe(true);
    expect(isProfessionalBioValid('Muy breve')).toBe(false);
    expect(isProfessionalBioValid('Enfoque clínico integrativo y humano.')).toBe(true);
  });
});
