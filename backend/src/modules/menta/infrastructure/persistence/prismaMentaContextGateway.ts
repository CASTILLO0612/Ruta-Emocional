import { AppointmentStatus, PrismaClient } from '../../../../generated/prisma/client';
import { AppError } from '../../../../shared/domain/appError';
import type { ClinicalContentCipher } from '../../../clinical-record/application/ports';
import type { AuthenticatedActor } from '../../../identity/application/identityService';
import type { MentaContextGateway } from '../../application/ports';
import type {
  MentaScope,
  MentaToolCode,
  MentaToolExecution,
} from '../../domain/mentaTypes';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_RELATIONSHIP_STATUSES = ['ACTIVE', 'PAUSED'] as const;
const ACTIVE_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
];
const DIRECTORY_MODALITIES = new Set(['CHAT', 'CALL', 'IN_PERSON']);
const SEARCH_STOP_WORDS = new Set(['para', 'como', 'con', 'que', 'por', 'una', 'uno', 'del', 'las', 'los']);

function normalizedSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function relevantSearchTokens(value: string): readonly string[] {
  return normalizedSearchText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !SEARCH_STOP_WORDS.has(token));
}

function searchScore(query: string, ...values: (string | null | undefined)[]): number {
  const tokens = relevantSearchTokens(query);
  if (tokens.length === 0) return 0;
  const haystack = normalizedSearchText(values.filter(Boolean).join(' '));
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

export class PrismaMentaContextGateway implements MentaContextGateway {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly cipher: ClinicalContentCipher
  ) {}

  execute(
    actor: AuthenticatedActor,
    scope: MentaScope,
    toolCode: MentaToolCode,
    argumentsValue: Readonly<Record<string, unknown>>
  ): Promise<MentaToolExecution> {
    switch (toolCode) {
      case 'get_my_agenda':
        return this.getAgenda(actor, scope);
      case 'get_my_requests':
        return this.getRequests(actor, scope);
      case 'find_psychologists':
        return this.findPsychologists(actor, scope, argumentsValue);
      case 'list_my_patients':
        return this.listPatients(actor, scope);
      case 'get_patient_context':
        return this.getPatientContext(actor, scope, argumentsValue);
    }
  }

  private async getAgenda(actor: AuthenticatedActor, scope: MentaScope): Promise<MentaToolExecution> {
    this.assertRoleScope(actor, scope);
    const now = new Date();
    const appointments = await this.prisma.appointment.findMany({
      where: {
        startsAt: { gte: now },
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        ...(scope === 'PATIENT'
          ? { patientProfile: { userId: actor.user.id } }
          : { psychologistProfile: { userId: actor.user.id } }),
      },
      orderBy: { startsAt: 'asc' },
      take: 10,
      include: {
        patientProfile: { include: { user: { select: { displayName: true } } } },
        psychologistProfile: { include: { user: { select: { displayName: true } } } },
      },
    });
    return {
      resourceType: 'appointment',
      resourceCount: appointments.length,
      data: {
        timezoneNotice: 'Cada cita incluye la zona horaria persistida por Ruta Emocional.',
        appointments: appointments.map((appointment) => ({
          startsAt: appointment.startsAt.toISOString(),
          endsAt: appointment.endsAt.toISOString(),
          timezone: appointment.timezone,
          modality: appointment.modality,
          status: appointment.status,
          with: scope === 'PATIENT'
            ? appointment.psychologistProfile.user.displayName
            : appointment.patientProfile.user.displayName,
        })),
      },
    };
  }

  private async getRequests(actor: AuthenticatedActor, scope: MentaScope): Promise<MentaToolExecution> {
    if (scope !== 'PATIENT' || !actor.user.roles.includes('patient')) {
      throw AppError.forbidden('MENTA_PATIENT_TOOL_REQUIRED');
    }
    const requests = await this.prisma.serviceRequest.findMany({
      where: { patientProfile: { userId: actor.user.id } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        offers: {
          orderBy: { createdAt: 'desc' },
          include: {
            psychologistProfile: { include: { user: { select: { displayName: true } } } },
          },
        },
      },
    });
    return {
      resourceType: 'service_request',
      resourceCount: requests.length,
      data: requests.map((request) => ({
        modality: request.modality,
        primaryNeed: request.primaryNeed,
        status: request.status,
        proposedBudget: request.proposedBudget.toFixed(2),
        currency: request.currencyCode,
        scheduledFor: request.scheduledFor?.toISOString() ?? null,
        expiresAt: request.expiresAt.toISOString(),
        offers: request.offers.map((offer) => ({
          psychologist: offer.psychologistProfile.user.displayName,
          amount: offer.amount.toFixed(2),
          status: offer.status,
        })),
      })),
    };
  }

  private async findPsychologists(
    actor: AuthenticatedActor,
    scope: MentaScope,
    argumentsValue: Readonly<Record<string, unknown>>
  ): Promise<MentaToolExecution> {
    if (scope !== 'PATIENT' || !actor.user.roles.includes('patient')) {
      throw AppError.forbidden('MENTA_PATIENT_TOOL_REQUIRED');
    }
    const modality = typeof argumentsValue.modality === 'string'
      && DIRECTORY_MODALITIES.has(argumentsValue.modality)
      ? argumentsValue.modality as 'CHAT' | 'CALL' | 'IN_PERSON'
      : undefined;
    const specialtyQuery = typeof argumentsValue.specialty_query === 'string'
      ? argumentsValue.specialty_query.trim().slice(0, 120)
      : '';
    const profiles = await this.prisma.psychologistProfile.findMany({
      where: {
        verificationStatus: 'VERIFIED',
        licenses: { some: { status: 'VERIFIED' } },
        modalities: {
          some: {
            isEnabled: true,
            pricePerHour: { gt: 0 },
            ...(modality ? { modality } : {}),
          },
        },
        specialties: {
          some: {
            isPrimary: true,
            specialty: {
              isActive: true,
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 25,
      include: {
        user: { select: { displayName: true } },
        specialties: {
          where: { isPrimary: true },
          include: { specialty: { select: { name: true } } },
        },
        modalities: {
          where: { isEnabled: true, pricePerHour: { gt: 0 } },
          orderBy: { pricePerHour: 'asc' },
        },
        availabilityRules: { where: { isActive: true }, take: 1 },
        appointments: {
          where: { review: { isNot: null } },
          take: 50,
          select: { review: { select: { rating: true } } },
        },
      },
    });
    const rankedProfiles = profiles.map((profile) => {
      const ratings = profile.appointments
        .map(({ review }) => review?.rating)
        .filter((rating): rating is number => rating !== undefined);
      const rating = ratings.length > 0
        ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
        : null;
      const primarySpecialty = profile.specialties[0]?.specialty.name ?? null;
      return {
        matchScore: searchScore(specialtyQuery, primarySpecialty, profile.bio),
        rating,
        hasWeeklyAvailability: profile.availabilityRules.length > 0,
        data: {
          profileId: profile.id,
          displayName: profile.user.displayName,
          primarySpecialty,
          modalities: profile.modalities.map((item) => ({
            code: item.modality,
            pricePerHour: item.pricePerHour.toFixed(2),
            currency: item.currencyCode,
          })),
          rating: rating === null ? null : Number(rating.toFixed(2)),
          reviewCount: ratings.length,
          hasWeeklyAvailability: profile.availabilityRules.length > 0,
        },
      };
    }).sort((left, right) => (
      right.matchScore - left.matchScore
      || Number(right.hasWeeklyAvailability) - Number(left.hasWeeklyAvailability)
      || (right.rating ?? 0) - (left.rating ?? 0)
    )).slice(0, 5);

    return {
      resourceType: 'psychologist_profile',
      resourceCount: rankedProfiles.length,
      data: rankedProfiles.map(({ data }) => data),
    };
  }

  private async listPatients(actor: AuthenticatedActor, scope: MentaScope): Promise<MentaToolExecution> {
    this.assertClinicalScope(actor, scope);
    const relationships = await this.prisma.careRelationship.findMany({
      where: {
        psychologistProfile: { userId: actor.user.id },
        status: { in: [...ACTIVE_RELATIONSHIP_STATUSES] },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: {
        patientProfile: { include: { user: { select: { id: true, displayName: true } } } },
        appointments: { orderBy: { startsAt: 'desc' }, take: 1 },
      },
    });
    return {
      resourceType: 'care_relationship',
      resourceCount: relationships.length,
      data: relationships.map((relationship) => ({
        patientUserId: relationship.patientProfile.user.id,
        displayName: relationship.patientProfile.user.displayName,
        relationshipStatus: relationship.status,
        relationshipStartedAt: relationship.startedAt.toISOString(),
        latestAppointment: relationship.appointments[0]
          ? {
              startsAt: relationship.appointments[0].startsAt.toISOString(),
              status: relationship.appointments[0].status,
            }
          : null,
      })),
    };
  }

  private async getPatientContext(
    actor: AuthenticatedActor,
    scope: MentaScope,
    argumentsValue: Readonly<Record<string, unknown>>
  ): Promise<MentaToolExecution> {
    this.assertClinicalScope(actor, scope);
    const patientUserId = typeof argumentsValue.patient_user_id === 'string'
      ? argumentsValue.patient_user_id.trim()
      : '';
    if (!UUID_PATTERN.test(patientUserId)) {
      throw AppError.badRequest(
        'MENTA_PATIENT_ID_INVALID',
        'Selecciona un paciente de la lista autorizada antes de consultar su contexto.'
      );
    }
    const relationship = await this.prisma.careRelationship.findFirst({
      where: {
        psychologistProfile: { userId: actor.user.id },
        patientProfile: { userId: patientUserId },
        status: { in: [...ACTIVE_RELATIONSHIP_STATUSES] },
      },
      orderBy: { startedAt: 'desc' },
      include: {
        patientProfile: { include: { user: { select: { displayName: true } } } },
        appointments: { orderBy: { startsAt: 'desc' }, take: 8 },
        conversation: {
          include: {
            participants: {
              include: {
                user: { select: { displayName: true } },
                messages: { orderBy: { sentAt: 'desc' }, take: 10 },
              },
            },
          },
        },
        clinicalEncounters: {
          orderBy: { startedAt: 'desc' },
          take: 5,
          include: {
            notes: {
              orderBy: { createdAt: 'desc' },
              include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
            },
          },
        },
        treatmentPlans: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: { goals: { orderBy: { targetDate: 'asc' } } },
        },
        source: {
          include: {
            triageAssessment: {
              select: {
                orientationSummary: true,
                riskLevel: true,
                evaluatorVersion: true,
                createdAt: true,
                consentWithdrawal: { select: { withdrawnAt: true } },
                erasureRequest: { select: { status: true } },
              },
            },
          },
        },
      },
    });
    if (!relationship) throw AppError.notFound('MENTA_PATIENT_CONTEXT_NOT_FOUND');

    const messages = relationship.conversation?.participants
      .flatMap((participant) => participant.messages.map((message) => ({
        sender: participant.user.displayName,
        content: message.content,
        sentAt: message.sentAt.toISOString(),
      })))
      .sort((left, right) => right.sentAt.localeCompare(left.sentAt))
      .slice(0, 15) ?? [];
    const encounters = relationship.clinicalEncounters.map((encounter) => ({
      startedAt: encounter.startedAt.toISOString(),
      endedAt: encounter.endedAt?.toISOString() ?? null,
      reason: encounter.reason,
      notes: encounter.notes.flatMap((note) => {
        const latest = note.versions[0];
        if (!latest) return [];
        return [{
          status: note.status,
          version: latest.versionNumber,
          content: this.cipher.decrypt(
            latest.content,
            `clinical-note:${note.id}:version:${latest.versionNumber}`
          ),
          createdAt: latest.createdAt.toISOString(),
        }];
      }),
    }));
    const treatmentPlans = relationship.treatmentPlans.map((plan) => ({
      status: plan.status,
      summary: plan.summary
        ? this.cipher.decrypt(plan.summary, `treatment-plan:${plan.id}:summary`)
        : null,
      startsAt: plan.startsAt.toISOString(),
      goals: plan.goals.map((goal) => ({
        description: this.cipher.decrypt(
          goal.description,
          `treatment-goal:${goal.id}:description`
        ),
        status: goal.status,
        targetDate: goal.targetDate?.toISOString().slice(0, 10) ?? null,
      })),
    }));
    const triage = relationship.source?.triageAssessment;

    return {
      resourceType: 'clinical_record_context',
      resourceCount: 1,
      data: {
        patient: relationship.patientProfile.user.displayName,
        relationship: {
          status: relationship.status,
          startedAt: relationship.startedAt.toISOString(),
        },
        appointments: relationship.appointments.map((appointment) => ({
          startsAt: appointment.startsAt.toISOString(),
          endsAt: appointment.endsAt.toISOString(),
          modality: appointment.modality,
          status: appointment.status,
        })),
        recentMessages: messages,
        recentEncounters: encounters,
        treatmentPlans,
        linkedTriage: triage && !triage.consentWithdrawal && !triage.erasureRequest
          ? {
              summary: triage.orientationSummary,
              riskLevel: triage.riskLevel,
              evaluatorVersion: triage.evaluatorVersion,
              createdAt: triage.createdAt.toISOString(),
            }
          : null,
        limitation:
          'Este contexto es una proyección autorizada para preparar un borrador. El profesional debe verificar exactitud, pertinencia y lenguaje clínico antes de guardar cualquier nota.',
      },
    };
  }

  private assertRoleScope(actor: AuthenticatedActor, scope: MentaScope): void {
    const requiredRole = scope === 'PATIENT' ? 'patient' : 'psychologist';
    if (!actor.user.roles.includes(requiredRole)) {
      throw AppError.forbidden('MENTA_SCOPE_NOT_AVAILABLE');
    }
  }

  private assertClinicalScope(actor: AuthenticatedActor, scope: MentaScope): void {
    if (
      scope !== 'PSYCHOLOGIST'
      || !actor.user.roles.includes('psychologist')
      || !actor.user.capabilities.includes('clinical:read:authorized')
    ) {
      throw AppError.forbidden('MENTA_CLINICAL_CONTEXT_REQUIRED');
    }
  }
}
