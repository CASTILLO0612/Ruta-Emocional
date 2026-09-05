import { prioritizeHomeSections } from '../prioritizeHomeSections';
import type { ActiveRequest } from '../../models/ActiveRequest';
import type { Offer } from '../../models/Offer';
import type { Psychologist } from '../../models/Psychologist';

describe('prioritizeHomeSections', () => {
  it('genera solo saludo y acción primaria cuando el usuario no tiene actividad previa', () => {
    const sections = prioritizeHomeSections({
      userName: 'Carlos',
    });

    expect(sections).toHaveLength(2);
    expect(sections[0].type).toBe('GREETING');
    expect(sections[1].type).toBe('PRIMARY_ACTION');
  });

  it('incluye tarjeta de decisión pendiente y sugerencia MENTA cuando hay ofertas pendientes', () => {
    const mockRequest: ActiveRequest = {
      id: 'req-1',
      modality: 'chat',
      proposedBudget: 500,
      currencyCode: 'NIO',
      status: 'bidding',
      expiresAt: new Date(),
      createdAt: new Date(),
    };

    const mockOffer: Offer = {
      id: 'off-1',
      requestId: 'req-1',
      psychologistId: 'psy-1',
      psychologistName: 'Dra. Andrea Morales',
      psychologistRating: 4.8,
      amount: 550,
      currencyCode: 'NIO',
      status: 'pending',
      createdAt: new Date(),
    };

    const sections = prioritizeHomeSections({
      userName: 'Sofía',
      activeRequest: mockRequest,
      incomingOffers: [mockOffer],
    });

    const types = sections.map((s) => s.type);
    expect(types).toContain('PENDING_DECISION');
    expect(types).not.toContain('PRIMARY_ACTION');
    expect(types).toContain('MENTA_SUGGESTION');

    const mentaSection = sections.find((s) => s.type === 'MENTA_SUGGESTION');
    if (mentaSection?.type === 'MENTA_SUGGESTION') {
      expect(mentaSection.targetRoute).toBe('Radar');
    }
  });

  it('incluye próxima cita y sugerencia contextual cuando existe una cita confirmada', () => {
    const sections = prioritizeHomeSections({
      userName: 'Martín',
      nextAppointment: {
        id: 'apt-1',
        professionalName: 'Lic. Roberto Díaz',
        scheduledFor: new Date('2026-09-10T15:00:00Z'),
        modality: 'in-person',
      },
    });

    const types = sections.map((s) => s.type);
    expect(types).toContain('NEXT_APPOINTMENT');
    expect(types).toContain('MENTA_SUGGESTION');

    const mentaSection = sections.find((s) => s.type === 'MENTA_SUGGESTION');
    if (mentaSection?.type === 'MENTA_SUGGESTION') {
      expect(mentaSection.targetRoute).toBe('MentaAgent');
    }
  });

  it('limita el preview del directorio profesional a dos opciones', () => {
    const mockPsychologists: Psychologist[] = Array.from({ length: 10 }, (_, i) => ({
      id: `psy-${i}`,
      displayName: `Psicólogo ${i}`,
      rating: 4.5,
      totalReviews: 12,
      pricePerHour: '600.00',
      currencyCode: 'NIO',
      specialty: 'Ansiedad',
      specialties: [{ code: 'ans', name: 'Ansiedad' }],
      modalities: ['chat', 'call'],
      isAvailable: true,
      credentialAuthority: 'MINSA',
      bio: 'Bio profesional',
    }));

    const sections = prioritizeHomeSections({
      userName: 'Lucía',
      featuredPsychologists: mockPsychologists,
    });

    const dirSection = sections.find((s) => s.type === 'DIRECTORY_PREVIEW');
    expect(dirSection).toBeDefined();
    if (dirSection?.type === 'DIRECTORY_PREVIEW') {
      expect(dirSection.professionals).toHaveLength(2);
    }
  });
});
