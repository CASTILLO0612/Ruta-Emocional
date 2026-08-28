import { Prisma, PrismaClient } from '../../../../generated/prisma/client';
import { AppError } from '../../../../shared/domain/appError';
import {
  ProfessionalDirectoryRepository,
  RequestAuditContext,
} from '../../application/ports';
import {
  DirectoryFilters,
  DirectoryPage,
  ProfessionalModality,
  ProfessionalProfileView,
  ProfessionalVerificationDecision,
  PublicProfessionalView,
  SpecialtyView,
  VerificationQueuePage,
  WeeklyAvailabilityInput,
} from '../../domain/professionalDirectoryTypes';

const publicProfileInclude = {
  user: { select: { displayName: true, photoUrl: true } },
  specialties: {
    include: { specialty: { select: { code: true, name: true } } },
    orderBy: [{ isPrimary: 'desc' as const }, { specialty: { name: 'asc' as const } }],
  },
  modalities: {
    where: { isEnabled: true },
    orderBy: { modality: 'asc' as const },
  },
  licenses: {
    where: { status: 'VERIFIED' as const },
    select: { authority: true, status: true },
    orderBy: { createdAt: 'asc' as const },
    take: 1,
  },
  availabilityRules: {
    where: { isActive: true },
    select: { id: true },
    take: 1,
  },
} satisfies Prisma.PsychologistProfileInclude;

const ownProfileInclude = {
  user: { select: { id: true, displayName: true, email: true, photoUrl: true } },
  specialties: {
    include: { specialty: { select: { code: true, name: true } } },
    orderBy: [{ isPrimary: 'desc' as const }, { specialty: { name: 'asc' as const } }],
  },
  modalities: { orderBy: { modality: 'asc' as const } },
  licenses: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      verificationSubmissions: {
        orderBy: { submittedAt: 'desc' as const },
        take: 1,
        include: { decision: true },
      },
    },
  },
  availabilityRules: { orderBy: [{ weekday: 'asc' as const }, { startTime: 'asc' as const }] },
  availabilityExceptions: { orderBy: { startsAt: 'desc' as const }, take: 100 },
} satisfies Prisma.PsychologistProfileInclude;

type PublicProfileRow = Prisma.PsychologistProfileGetPayload<{ include: typeof publicProfileInclude }>;
type OwnProfileRow = Prisma.PsychologistProfileGetPayload<{ include: typeof ownProfileInclude }>;

interface DirectoryCandidateRow {
  readonly id: string;
  readonly approximate_distance_km: number | null;
}

interface RatingRow {
  readonly psychologist_profile_id: string;
  readonly average: string | null;
  readonly count: bigint;
}

function encodeCursor(id: string): string {
  return Buffer.from(JSON.stringify({ version: 1, id }), 'utf8').toString('base64url');
}

function timeView(value: Date): string {
  return value.toISOString().slice(11, 16);
}

function dateView(value: Date | null): string | undefined {
  return value?.toISOString().slice(0, 10);
}

function timeValue(value: string): Date {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

function dateValue(value: string | undefined): Date | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export class PrismaProfessionalDirectoryRepository implements ProfessionalDirectoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listSpecialties(): Promise<readonly SpecialtyView[]> {
    return this.prisma.specialty.findMany({
      where: { isActive: true },
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
      select: { code: true, name: true },
    });
  }

  async createSpecialty(
    input: { code: string; name: string },
    audit: RequestAuditContext
  ): Promise<SpecialtyView> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const specialty = await transaction.specialty.create({
          data: input,
          select: { id: true, code: true, name: true },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: audit.actorUserId,
            action: 'catalog.specialty_created',
            resourceType: 'specialty',
            resourceId: specialty.id,
            requestId: audit.requestId,
            ipAddress: audit.ipAddress,
          },
        });
        return { code: specialty.code, name: specialty.name };
      });
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw AppError.conflict('SPECIALTY_ALREADY_EXISTS', 'El código o nombre ya está registrado.');
      }
      throw error;
    }
  }

  async setSpecialtyStatus(
    code: string,
    isActive: boolean,
    audit: RequestAuditContext
  ): Promise<SpecialtyView> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.specialty.findUnique({ where: { code } });
      if (!current) throw AppError.notFound('SPECIALTY_NOT_FOUND');
      const specialty = await transaction.specialty.update({
        where: { code },
        data: { isActive },
        select: { code: true, name: true },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: audit.actorUserId,
          action: isActive ? 'catalog.specialty_activated' : 'catalog.specialty_deactivated',
          resourceType: 'specialty',
          resourceId: current.id,
          requestId: audit.requestId,
          ipAddress: audit.ipAddress,
        },
      });
      return specialty;
    });
  }

  async listPublic(filters: DirectoryFilters): Promise<DirectoryPage> {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`p."verification_status" = 'VERIFIED'::"verification_status"`,
      Prisma.sql`u."status" = 'ACTIVE'::"account_status"`,
      Prisma.sql`EXISTS (
        SELECT 1 FROM "professional_licenses" license
        WHERE license."psychologist_profile_id" = p."id"
          AND license."status" = 'VERIFIED'::"verification_status"
      )`,
      Prisma.sql`EXISTS (
        SELECT 1 FROM "psychologist_modalities" enabled_modality
        WHERE enabled_modality."psychologist_profile_id" = p."id"
          AND enabled_modality."is_enabled" = true
          AND enabled_modality."price_per_hour" > 0
      )`,
    ];

    if (filters.cursor) conditions.push(Prisma.sql`p."id" > ${filters.cursor}::uuid`);
    if (filters.specialty) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "psychologist_specialties" ps
        JOIN "specialties" s ON s."id" = ps."specialty_id"
        WHERE ps."psychologist_profile_id" = p."id"
          AND s."code" = ${filters.specialty}
          AND s."is_active" = true
      )`);
    }
    if (filters.modality || filters.minPrice || filters.maxPrice) {
      const modalityConditions: Prisma.Sql[] = [Prisma.sql`pm."is_enabled" = true`];
      if (filters.modality) {
        modalityConditions.push(Prisma.sql`pm."modality" = ${filters.modality}::"modality"`);
      }
      if (filters.minPrice) {
        modalityConditions.push(Prisma.sql`pm."price_per_hour" >= ${filters.minPrice}::numeric`);
      }
      if (filters.maxPrice) {
        modalityConditions.push(Prisma.sql`pm."price_per_hour" <= ${filters.maxPrice}::numeric`);
      }
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "psychologist_modalities" pm
        WHERE pm."psychologist_profile_id" = p."id"
          AND ${Prisma.join(modalityConditions, ' AND ')}
      )`);
    }
    if (filters.availableFrom && filters.availableUntil) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "availability_rules" ar
        WHERE ar."psychologist_profile_id" = p."id"
          AND ar."is_active" = true
          AND (ar."effective_from" IS NULL OR ar."effective_from" <= ${filters.availableUntil}::date)
          AND (ar."effective_until" IS NULL OR ar."effective_until" >= ${filters.availableFrom}::date)
      )`);
    }

    const hasLocation = filters.latitude !== undefined
      && filters.longitude !== undefined
      && filters.radiusKm !== undefined;
    if (hasLocation) {
      conditions.push(Prisma.sql`p."location" IS NOT NULL AND ST_DWithin(
        p."location",
        ST_SetSRID(ST_MakePoint(${filters.longitude}, ${filters.latitude}), 4326)::geography,
        ${filters.radiusKm} * 1000
      )`);
    }

    const distance = hasLocation
      ? Prisma.sql`ROUND((ST_Distance(
          p."location",
          ST_SetSRID(ST_MakePoint(${filters.longitude}, ${filters.latitude}), 4326)::geography
        ) / 1000.0)::numeric, 1)::double precision`
      : Prisma.sql`NULL::double precision`;

    const candidates = await this.prisma.$queryRaw<DirectoryCandidateRow[]>(Prisma.sql`
      SELECT p."id", ${distance} AS "approximate_distance_km"
      FROM "psychologist_profiles" p
      JOIN "users" u ON u."id" = p."user_id"
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY p."id" ASC
      LIMIT ${filters.limit + 1}
    `);

    const hasNextPage = candidates.length > filters.limit;
    const selected = hasNextPage ? candidates.slice(0, filters.limit) : candidates;
    if (selected.length === 0) return { items: [], nextCursor: null };

    const ids = selected.map(({ id }) => id);
    const [profiles, ratings] = await Promise.all([
      this.prisma.psychologistProfile.findMany({
        where: { id: { in: ids } },
        include: publicProfileInclude,
      }),
      this.prisma.$queryRaw<RatingRow[]>(Prisma.sql`
        SELECT a."psychologist_profile_id",
               ROUND(AVG(r."rating")::numeric, 2)::text AS "average",
               COUNT(*) AS "count"
        FROM "reviews" r
        JOIN "appointments" a ON a."id" = r."appointment_id"
        WHERE a."psychologist_profile_id"::text IN (${Prisma.join(ids)})
        GROUP BY a."psychologist_profile_id"
      `),
    ]);

    const byId = new Map(profiles.map((profile) => [profile.id, profile]));
    const ratingsById = new Map(ratings.map((rating) => [rating.psychologist_profile_id, rating]));
    const distanceById = new Map(selected.map((candidate) => [candidate.id, candidate.approximate_distance_km]));
    const items = ids.flatMap((id) => {
      const profile = byId.get(id);
      return profile ? [this.toPublicView(profile, ratingsById.get(id), distanceById.get(id))] : [];
    });

    return {
      items,
      nextCursor: hasNextPage ? encodeCursor(items[items.length - 1].id) : null,
    };
  }

  async findPublicById(profileId: string): Promise<PublicProfessionalView | null> {
    const profile = await this.prisma.psychologistProfile.findFirst({
      where: {
        id: profileId,
        verificationStatus: 'VERIFIED',
        user: { status: 'ACTIVE' },
        licenses: { some: { status: 'VERIFIED' } },
        modalities: { some: { isEnabled: true, pricePerHour: { gt: 0 } } },
      },
      include: publicProfileInclude,
    });
    if (!profile) return null;
    const ratings = await this.ratingRows([profileId]);
    return this.toPublicView(profile, ratings[0], null);
  }

  async findOwnProfile(userId: string): Promise<ProfessionalProfileView | null> {
    const profile = await this.prisma.psychologistProfile.findUnique({
      where: { userId },
      include: ownProfileInclude,
    });
    return profile ? this.toOwnView(profile) : null;
  }

  async updateOwnBio(
    userId: string,
    bio: string | null,
    audit: RequestAuditContext
  ): Promise<ProfessionalProfileView> {
    await this.prisma.$transaction(async (transaction) => {
      const profile = await this.requireProfile(transaction, userId);
      await transaction.psychologistProfile.update({ where: { id: profile.id }, data: { bio } });
      await this.audit(transaction, audit, 'psychologist.profile_updated', 'psychologist_profile', profile.id);
    });
    return this.requireOwnView(userId);
  }

  async replaceOwnSpecialties(
    userId: string,
    specialtyCodes: readonly string[],
    primarySpecialtyCode: string,
    audit: RequestAuditContext
  ): Promise<ProfessionalProfileView> {
    await this.prisma.$transaction(async (transaction) => {
      const profile = await this.requireProfile(transaction, userId);
      const specialties = await transaction.specialty.findMany({
        where: { code: { in: [...specialtyCodes] }, isActive: true },
        select: { id: true, code: true },
      });
      if (specialties.length !== specialtyCodes.length) {
        throw AppError.validation([{
          field: 'specialtyCodes',
          code: 'UNKNOWN_SPECIALTY',
          message: 'Una o más especialidades no están disponibles.',
        }]);
      }
      await transaction.psychologistSpecialty.deleteMany({
        where: { psychologistProfileId: profile.id },
      });
      await transaction.psychologistSpecialty.createMany({
        data: specialties.map((specialty) => ({
          psychologistProfileId: profile.id,
          specialtyId: specialty.id,
          isPrimary: specialty.code === primarySpecialtyCode,
        })),
      });
      await this.audit(
        transaction,
        audit,
        'psychologist.specialties_replaced',
        'psychologist_profile',
        profile.id
      );
    });
    return this.requireOwnView(userId);
  }

  async upsertOwnModality(
    userId: string,
    modality: ProfessionalModality,
    amount: string,
    currency: string,
    isEnabled: boolean,
    audit: RequestAuditContext
  ): Promise<ProfessionalProfileView> {
    await this.prisma.$transaction(async (transaction) => {
      const profile = await this.requireProfile(transaction, userId);
      await transaction.psychologistModality.upsert({
        where: { psychologistProfileId_modality: { psychologistProfileId: profile.id, modality } },
        create: {
          psychologistProfileId: profile.id,
          modality,
          pricePerHour: new Prisma.Decimal(amount),
          currencyCode: currency,
          isEnabled,
        },
        update: { pricePerHour: new Prisma.Decimal(amount), currencyCode: currency, isEnabled },
      });
      await this.audit(
        transaction,
        audit,
        'psychologist.modality_configured',
        'psychologist_profile',
        profile.id,
        { modality, isEnabled }
      );
    });
    return this.requireOwnView(userId);
  }

  async replaceOwnAvailability(
    userId: string,
    timezone: string,
    rules: readonly WeeklyAvailabilityInput[],
    audit: RequestAuditContext
  ): Promise<ProfessionalProfileView> {
    await this.prisma.$transaction(async (transaction) => {
      const profile = await this.requireProfile(transaction, userId);
      await transaction.availabilityRule.deleteMany({ where: { psychologistProfileId: profile.id } });
      if (rules.length > 0) {
        await transaction.availabilityRule.createMany({
          data: rules.map((rule) => ({
            psychologistProfileId: profile.id,
            weekday: rule.weekday,
            startTime: timeValue(rule.startTime),
            endTime: timeValue(rule.endTime),
            timezone,
            effectiveFrom: dateValue(rule.effectiveFrom),
            effectiveUntil: dateValue(rule.effectiveUntil),
            isActive: rule.isActive,
          })),
        });
      }
      await this.audit(
        transaction,
        audit,
        'psychologist.availability_replaced',
        'psychologist_profile',
        profile.id,
        { ruleCount: rules.length, timezone }
      );
    });
    return this.requireOwnView(userId);
  }

  async addOwnAvailabilityException(
    userId: string,
    input: { startsAt: Date; endsAt: Date; type: 'AVAILABLE' | 'UNAVAILABLE'; reason?: string },
    audit: RequestAuditContext
  ): Promise<ProfessionalProfileView> {
    await this.prisma.$transaction(async (transaction) => {
      const profile = await this.requireProfile(transaction, userId);
      const exception = await transaction.availabilityException.create({
        data: { psychologistProfileId: profile.id, ...input },
      });
      await this.audit(
        transaction,
        audit,
        'psychologist.availability_exception_created',
        'availability_exception',
        exception.id,
        { type: input.type }
      );
    });
    return this.requireOwnView(userId);
  }

  async submitVerificationEvidence(
    userId: string,
    licenseId: string,
    evidenceObjectKey: string,
    audit: RequestAuditContext
  ): Promise<ProfessionalProfileView> {
    await this.prisma.$transaction(async (transaction) => {
      const profile = await this.requireProfile(transaction, userId);
      const license = await transaction.professionalLicense.findFirst({
        where: { id: licenseId, psychologistProfileId: profile.id },
      });
      if (!license) throw AppError.notFound('PROFESSIONAL_LICENSE_NOT_FOUND');
      await transaction.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${licenseId}, 0))
      `);
      const pending = await transaction.professionalVerificationSubmission.findFirst({
        where: { professionalLicenseId: licenseId, decision: { is: null } },
        select: { id: true },
      });
      if (pending) {
        throw AppError.conflict(
          'VERIFICATION_ALREADY_PENDING',
          'Ya existe una evidencia pendiente de revisión para esta licencia.'
        );
      }
      const submission = await transaction.professionalVerificationSubmission.create({
        data: { professionalLicenseId: licenseId, evidenceObjectKey },
      });
      await transaction.professionalLicense.update({
        where: { id: licenseId },
        data: { status: 'PENDING', verifiedAt: null },
      });
      await transaction.psychologistProfile.update({
        where: { id: profile.id },
        data: { verificationStatus: 'PENDING' },
      });
      await this.audit(
        transaction,
        audit,
        'psychologist.verification_evidence_submitted',
        'professional_verification_submission',
        submission.id
      );
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.requireOwnView(userId);
  }

  async listPendingVerifications(
    cursor: string | undefined,
    limit: number
  ): Promise<VerificationQueuePage> {
    const submissions = await this.prisma.professionalVerificationSubmission.findMany({
      where: { decision: { is: null }, ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: 'asc' },
      take: limit + 1,
      include: {
        professionalLicense: {
          include: {
            psychologistProfile: { include: { user: { select: { displayName: true } } } },
          },
        },
      },
    });
    const hasNextPage = submissions.length > limit;
    const selected = hasNextPage ? submissions.slice(0, limit) : submissions;
    return {
      items: selected.map((submission) => ({
        submissionId: submission.id,
        psychologistProfileId: submission.professionalLicense.psychologistProfileId,
        psychologistName: submission.professionalLicense.psychologistProfile.user.displayName,
        license: {
          id: submission.professionalLicense.id,
          authority: submission.professionalLicense.authority,
          number: submission.professionalLicense.licenseNumber,
        },
        evidenceObjectKey: submission.evidenceObjectKey,
        submittedAt: submission.submittedAt.toISOString(),
      })),
      nextCursor: hasNextPage ? encodeCursor(selected[selected.length - 1].id) : null,
    };
  }

  async decideVerification(
    submissionId: string,
    decision: ProfessionalVerificationDecision,
    publicReason: string | undefined,
    internalReason: string | undefined,
    audit: RequestAuditContext
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`
        SELECT "id" FROM "professional_verification_submissions"
        WHERE "id" = ${submissionId}::uuid FOR UPDATE
      `);
      const submission = await transaction.professionalVerificationSubmission.findUnique({
        where: { id: submissionId },
        include: {
          decision: true,
          professionalLicense: {
            include: {
              psychologistProfile: {
                include: {
                  modalities: { where: { isEnabled: true } },
                  specialties: { where: { isPrimary: true } },
                },
              },
            },
          },
        },
      });
      if (!submission) throw AppError.notFound('VERIFICATION_SUBMISSION_NOT_FOUND');
      if (submission.decision) {
        throw AppError.conflict('VERIFICATION_ALREADY_DECIDED', 'La solicitud ya fue resuelta.');
      }
      if (decision === 'APPROVED') {
        const dossierComplete = submission.professionalLicense.psychologistProfile.modalities.some(
          (modality) => modality.pricePerHour.gt(0)
        ) && submission.professionalLicense.psychologistProfile.specialties.length === 1;
        if (!dossierComplete) {
          throw AppError.conflict(
            'PROFESSIONAL_DOSSIER_INCOMPLETE',
            'El perfil requiere una especialidad principal y una modalidad habilitada con precio válido.'
          );
        }
      }

      const status = decision === 'APPROVED' ? 'VERIFIED' : 'REJECTED';
      const record = await transaction.professionalVerificationDecision.create({
        data: {
          submissionId,
          reviewerUserId: audit.actorUserId,
          decision,
          publicReason,
          internalReason,
        },
      });
      await transaction.professionalLicense.update({
        where: { id: submission.professionalLicenseId },
        data: { status, verifiedAt: status === 'VERIFIED' ? new Date() : null },
      });
      await transaction.psychologistProfile.update({
        where: { id: submission.professionalLicense.psychologistProfileId },
        data: { verificationStatus: status },
      });
      await this.audit(
        transaction,
        audit,
        decision === 'APPROVED'
          ? 'administrator.psychologist_verification_approved'
          : 'administrator.psychologist_verification_rejected',
        'professional_verification_decision',
        record.id,
        { submissionId, decision }
      );
      await transaction.outboxEvent.create({
        data: {
          aggregateType: 'psychologist_profile',
          aggregateId: submission.professionalLicense.psychologistProfileId,
          eventType: decision === 'APPROVED'
            ? 'psychologist.verification_approved'
            : 'psychologist.verification_rejected',
          payload: { submissionId, status },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async ratingRows(profileIds: readonly string[]): Promise<RatingRow[]> {
    return this.prisma.$queryRaw<RatingRow[]>(Prisma.sql`
      SELECT a."psychologist_profile_id",
             ROUND(AVG(r."rating")::numeric, 2)::text AS "average",
             COUNT(*) AS "count"
      FROM "reviews" r
      JOIN "appointments" a ON a."id" = r."appointment_id"
      WHERE a."psychologist_profile_id"::text IN (${Prisma.join(profileIds)})
      GROUP BY a."psychologist_profile_id"
    `);
  }

  private toPublicView(
    profile: PublicProfileRow,
    rating: RatingRow | undefined,
    approximateDistanceKm: number | null | undefined
  ): PublicProfessionalView {
    const specialties = profile.specialties.map(({ specialty }) => specialty);
    const primary = profile.specialties.find(({ isPrimary }) => isPrimary)?.specialty ?? null;
    const credential = profile.licenses[0];
    if (!credential) throw new Error('Verified public profile has no verified license');

    return {
      id: profile.id,
      displayName: profile.user.displayName,
      photoUrl: profile.user.photoUrl,
      bio: profile.bio,
      specialties,
      primarySpecialty: primary,
      modalities: profile.modalities.map((modality) => ({
        code: modality.modality as ProfessionalModality,
        pricePerHour: {
          amount: modality.pricePerHour.toFixed(2),
          currency: modality.currencyCode,
        },
      })),
      rating: {
        average: rating?.average ?? null,
        count: Number(rating?.count ?? 0),
      },
      availability: { hasWeeklySchedule: profile.availabilityRules.length > 0 },
      credential: { authority: credential.authority, status: 'VERIFIED' },
      ...(approximateDistanceKm === null || approximateDistanceKm === undefined
        ? {}
        : { approximateDistanceKm: approximateDistanceKm.toFixed(1) }),
    };
  }

  private toOwnView(profile: OwnProfileRow): ProfessionalProfileView {
    const timezone = profile.availabilityRules[0]?.timezone ?? null;
    return {
      id: profile.id,
      userId: profile.user.id,
      displayName: profile.user.displayName,
      email: profile.user.email,
      photoUrl: profile.user.photoUrl,
      bio: profile.bio,
      verificationStatus: profile.verificationStatus,
      specialties: profile.specialties.map(({ specialty, isPrimary }) => ({ ...specialty, isPrimary })),
      modalities: profile.modalities.map((modality) => ({
        code: modality.modality as ProfessionalModality,
        isEnabled: modality.isEnabled,
        pricePerHour: {
          amount: modality.pricePerHour.toFixed(2),
          currency: modality.currencyCode,
        },
      })),
      licenses: profile.licenses.map((license) => {
        const latest = license.verificationSubmissions[0];
        return {
          id: license.id,
          authority: license.authority,
          number: license.licenseNumber,
          status: license.status,
          evidenceSubmitted: Boolean(latest),
          latestPublicDecisionReason: latest?.decision?.publicReason ?? null,
        };
      }),
      availability: {
        timezone,
        weeklyRules: profile.availabilityRules.map((rule) => ({
          weekday: rule.weekday,
          startTime: timeView(rule.startTime),
          endTime: timeView(rule.endTime),
          effectiveFrom: dateView(rule.effectiveFrom),
          effectiveUntil: dateView(rule.effectiveUntil),
          isActive: rule.isActive,
        })),
        exceptions: profile.availabilityExceptions.map((exception) => ({
          id: exception.id,
          startsAt: exception.startsAt.toISOString(),
          endsAt: exception.endsAt.toISOString(),
          type: exception.type,
          reason: exception.reason,
        })),
      },
    };
  }

  private async requireOwnView(userId: string): Promise<ProfessionalProfileView> {
    const profile = await this.findOwnProfile(userId);
    if (!profile) throw AppError.notFound('PSYCHOLOGIST_PROFILE_NOT_FOUND');
    return profile;
  }

  private async requireProfile(
    transaction: Prisma.TransactionClient,
    userId: string
  ): Promise<{ id: string }> {
    const profile = await transaction.psychologistProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw AppError.notFound('PSYCHOLOGIST_PROFILE_NOT_FOUND');
    return profile;
  }

  private audit(
    transaction: Prisma.TransactionClient,
    audit: RequestAuditContext,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata?: Prisma.InputJsonValue
  ) {
    return transaction.auditEvent.create({
      data: {
        actorUserId: audit.actorUserId,
        action,
        resourceType,
        resourceId,
        requestId: audit.requestId,
        ipAddress: audit.ipAddress,
        metadata,
      },
    });
  }
}
