import { AppError } from '../../../../shared/domain/appError';
import { Prisma, PrismaClient, UserRoleAssignmentStatus } from '../../../../generated/prisma/client';
import {
  CreateSessionData,
  IdentityRepository,
  RegisterPatientData,
  RegisterPsychologistData,
  RegistrationSessionData,
} from '../../application/ports';
import {
  AccountStatus,
  IdentitySession,
  IdentityUser,
  RoleCode,
  VerificationStatus,
} from '../../domain/identityTypes';

const VALID_ROLES = new Set<RoleCode>([
  'patient',
  'psychologist',
  'administrator',
  'clinical_auditor',
]);

const identityUserInclude = {
  roles: {
    where: { status: UserRoleAssignmentStatus.ACTIVE },
    include: { role: true },
  },
  patientProfile: { select: { id: true } },
  psychologistProfile: { select: { id: true, verificationStatus: true } },
} satisfies Prisma.UserInclude;

type IdentityUserRow = Prisma.UserGetPayload<{ include: typeof identityUserInclude }>;

function mapUser(row: IdentityUserRow): IdentityUser {
  const roles = row.roles
    .map(({ role }) => role.code)
    .filter((role): role is RoleCode => VALID_ROLES.has(role as RoleCode));

  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    passwordHash: row.passwordHash,
    photoUrl: row.photoUrl,
    status: row.status as AccountStatus,
    roles,
    patientProfileId: row.patientProfile?.id ?? null,
    psychologistProfileId: row.psychologistProfile?.id ?? null,
    psychologistVerificationStatus:
      (row.psychologistProfile?.verificationStatus as VerificationStatus | undefined) ?? null,
  };
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserByEmail(email: string): Promise<IdentityUser | null> {
    const row = await this.prisma.user.findUnique({ where: { email }, include: identityUserInclude });
    return row ? mapUser(row) : null;
  }

  async findUserById(id: string): Promise<IdentityUser | null> {
    const row = await this.prisma.user.findUnique({ where: { id }, include: identityUserInclude });
    return row ? mapUser(row) : null;
  }

  async registerPatient(data: RegisterPatientData, session: RegistrationSessionData): Promise<IdentityUser> {
    try {
      const row = await this.prisma.$transaction(async (transaction) => {
        const role = await transaction.role.findUnique({ where: { code: 'patient' } });
        if (!role) throw this.missingRole('patient');

        const user = await transaction.user.create({
          data: {
            email: data.email,
            displayName: data.displayName,
            passwordHash: data.passwordHash,
            patientProfile: { create: {} },
            roles: { create: { roleId: role.id } },
          },
          include: identityUserInclude,
        });

        await transaction.authSession.create({
          data: {
            id: session.id,
            userId: user.id,
            refreshTokenHash: session.refreshTokenHash,
            deviceName: session.deviceName,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            expiresAt: session.expiresAt,
          },
        });

        await transaction.auditEvent.create({
          data: {
            actorUserId: user.id,
            action: 'identity.patient_registered',
            resourceType: 'user',
            resourceId: user.id,
            requestId: data.requestId,
            ipAddress: data.ipAddress,
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: user.id,
            action: 'identity.session_created',
            resourceType: 'auth_session',
            resourceId: session.id,
            requestId: session.requestId,
            ipAddress: session.ipAddress,
          },
        });
        return user;
      });
      return mapUser(row);
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw AppError.conflict('ACCOUNT_ALREADY_EXISTS', 'No fue posible crear la cuenta con esos datos.');
      }
      throw error;
    }
  }

  async registerPsychologist(
    data: RegisterPsychologistData,
    session: RegistrationSessionData
  ): Promise<IdentityUser> {
    try {
      const row = await this.prisma.$transaction(async (transaction) => {
        const role = await transaction.role.findUnique({ where: { code: 'psychologist' } });
        if (!role) throw this.missingRole('psychologist');

        const user = await transaction.user.create({
          data: {
            email: data.email,
            displayName: data.displayName,
            passwordHash: data.passwordHash,
            psychologistProfile: {
              create: {
                licenses: {
                  create: {
                    authority: data.licenseAuthority,
                    licenseNumber: data.licenseNumber,
                  },
                },
              },
            },
            roles: { create: { roleId: role.id } },
          },
          include: identityUserInclude,
        });

        await transaction.authSession.create({
          data: {
            id: session.id,
            userId: user.id,
            refreshTokenHash: session.refreshTokenHash,
            deviceName: session.deviceName,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            expiresAt: session.expiresAt,
          },
        });

        await transaction.auditEvent.create({
          data: {
            actorUserId: user.id,
            action: 'identity.psychologist_registration_requested',
            resourceType: 'user',
            resourceId: user.id,
            requestId: data.requestId,
            ipAddress: data.ipAddress,
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: user.id,
            action: 'identity.session_created',
            resourceType: 'auth_session',
            resourceId: session.id,
            requestId: session.requestId,
            ipAddress: session.ipAddress,
          },
        });
        return user;
      });
      return mapUser(row);
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw AppError.conflict('ACCOUNT_ALREADY_EXISTS', 'No fue posible crear la cuenta con esos datos.');
      }
      throw error;
    }
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async createSession(data: CreateSessionData): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.authSession.create({
        data: {
          id: data.id,
          userId: data.userId,
          refreshTokenHash: data.refreshTokenHash,
          deviceName: data.deviceName,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          expiresAt: data.expiresAt,
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: data.userId,
          action: 'identity.session_created',
          resourceType: 'auth_session',
          resourceId: data.id,
          requestId: data.requestId,
          ipAddress: data.ipAddress,
        },
      });
    });
  }

  async findSessionById(sessionId: string): Promise<IdentitySession | null> {
    const row = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: { include: identityUserInclude } },
    });
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      refreshTokenHash: row.refreshTokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      user: mapUser(row.user),
    };
  }

  async rotateSession(sessionId: string, currentHash: string, nextHash: string, now: Date): Promise<boolean> {
    const result = await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        refreshTokenHash: currentHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { refreshTokenHash: nextHash },
    });
    return result.count === 1;
  }

  async revokeSession(
    sessionId: string,
    revokedAt: Date,
    action = 'identity.session_revoked',
    requestId?: string
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const session = await transaction.authSession.findUnique({ where: { id: sessionId } });
      if (!session) return;
      const result = await transaction.authSession.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt },
      });
      if (result.count === 0) return;
      await transaction.auditEvent.create({
        data: {
          actorUserId: session.userId,
          action,
          resourceType: 'auth_session',
          resourceId: session.id,
          requestId,
        },
      });
    });
  }

  async revokeAllSessions(
    userId: string,
    revokedAt: Date,
    exceptSessionId?: string,
    requestId?: string
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.authSession.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
        },
        data: { revokedAt },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: userId,
          action: 'identity.all_sessions_revoked',
          resourceType: 'user',
          resourceId: userId,
          requestId,
          metadata: exceptSessionId ? { exceptCurrentSession: true } : undefined,
        },
      });
    });
  }

  private missingRole(role: string): AppError {
    return new AppError(
      500,
      'ROLE_CONFIGURATION_MISSING',
      'Error interno',
      `Required role is not configured: ${role}`
    );
  }
}
