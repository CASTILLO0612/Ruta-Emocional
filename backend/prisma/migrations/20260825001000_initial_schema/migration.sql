-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "modality" AS ENUM ('CHAT', 'CALL', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "request_status" AS ENUM ('PENDING', 'BIDDING', 'ACCEPTED', 'IN_SESSION', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "offer_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "care_relationship_status" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "availability_exception_type" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "clinical_record_status" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "clinical_note_status" AS ENUM ('DRAFT', 'SIGNED', 'AMENDED');

-- CreateEnum
CREATE TYPE "diagnosis_status" AS ENUM ('PROVISIONAL', 'CONFIRMED', 'RULED_OUT', 'RESOLVED');

-- CreateEnum
CREATE TYPE "treatment_plan_status" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "treatment_goal_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'ACHIEVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "consent_decision" AS ENUM ('GRANTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "message_type" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'SYSTEM');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'HELD', 'COMPLETED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "triage_risk_level" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_id" TEXT,
    "email" VARCHAR(320) NOT NULL,
    "display_name" VARCHAR(160) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "photo_url" TEXT,
    "phone" VARCHAR(32),
    "status" "account_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "device_name" VARCHAR(160),
    "ip_address" INET,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "birth_date" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "patient_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psychologist_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "verification_status" "verification_status" NOT NULL DEFAULT 'PENDING',
    "bio" TEXT,
    "location" geography(Point, 4326),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "psychologist_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_licenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "psychologist_profile_id" UUID NOT NULL,
    "authority" VARCHAR(120) NOT NULL,
    "license_number" VARCHAR(80) NOT NULL,
    "status" "verification_status" NOT NULL DEFAULT 'PENDING',
    "document_url" TEXT,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professional_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,

    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psychologist_specialties" (
    "psychologist_profile_id" UUID NOT NULL,
    "specialty_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "psychologist_specialties_pkey" PRIMARY KEY ("psychologist_profile_id","specialty_id")
);

-- CreateTable
CREATE TABLE "psychologist_modalities" (
    "psychologist_profile_id" UUID NOT NULL,
    "modality" "modality" NOT NULL,
    "price_per_hour" DECIMAL(12,2) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "psychologist_modalities_pkey" PRIMARY KEY ("psychologist_profile_id","modality")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_id" TEXT,
    "patient_profile_id" UUID NOT NULL,
    "modality" "modality" NOT NULL,
    "primary_need" VARCHAR(240),
    "description" TEXT,
    "proposed_budget" DECIMAL(12,2) NOT NULL,
    "status" "request_status" NOT NULL DEFAULT 'PENDING',
    "location" geography(Point, 4326),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_id" TEXT,
    "request_id" UUID NOT NULL,
    "psychologist_profile_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "message" VARCHAR(500),
    "status" "offer_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_relationships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patient_profile_id" UUID NOT NULL,
    "psychologist_profile_id" UUID NOT NULL,
    "status" "care_relationship_status" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),

    CONSTRAINT "care_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_relationship_sources" (
    "care_relationship_id" UUID NOT NULL,
    "service_request_id" UUID NOT NULL,

    CONSTRAINT "care_relationship_sources_pkey" PRIMARY KEY ("care_relationship_id")
);

-- CreateTable
CREATE TABLE "availability_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "psychologist_profile_id" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "timezone" VARCHAR(80) NOT NULL,
    "effective_from" DATE,
    "effective_until" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_exceptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "psychologist_profile_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "type" "availability_exception_type" NOT NULL,
    "reason" VARCHAR(240),

    CONSTRAINT "availability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patient_profile_id" UUID NOT NULL,
    "psychologist_profile_id" UUID NOT NULL,
    "modality" "modality" NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "timezone" VARCHAR(80) NOT NULL,
    "status" "appointment_status" NOT NULL DEFAULT 'SCHEDULED',
    "cancellation_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_requests" (
    "appointment_id" UUID NOT NULL,
    "service_request_id" UUID NOT NULL,

    CONSTRAINT "appointment_requests_pkey" PRIMARY KEY ("appointment_id")
);

-- CreateTable
CREATE TABLE "appointment_care_relationships" (
    "appointment_id" UUID NOT NULL,
    "care_relationship_id" UUID NOT NULL,

    CONSTRAINT "appointment_care_relationships_pkey" PRIMARY KEY ("appointment_id")
);

-- CreateTable
CREATE TABLE "clinical_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patient_profile_id" UUID NOT NULL,
    "status" "clinical_record_status" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(3),

    CONSTRAINT "clinical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_encounters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clinical_record_id" UUID NOT NULL,
    "psychologist_profile_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3),
    "reason" VARCHAR(500),

    CONSTRAINT "clinical_encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_encounter_appointments" (
    "clinical_encounter_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,

    CONSTRAINT "clinical_encounter_appointments_pkey" PRIMARY KEY ("clinical_encounter_id")
);

-- CreateTable
CREATE TABLE "clinical_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clinical_encounter_id" UUID NOT NULL,
    "status" "clinical_note_status" NOT NULL DEFAULT 'DRAFT',
    "signed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_note_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clinical_note_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "author_user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "amendment_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_note_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnosis_catalog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code_system" VARCHAR(40) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(240) NOT NULL,

    CONSTRAINT "diagnosis_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_diagnoses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clinical_record_id" UUID NOT NULL,
    "diagnosis_catalog_id" UUID NOT NULL,
    "psychologist_profile_id" UUID NOT NULL,
    "status" "diagnosis_status" NOT NULL,
    "notes" TEXT,
    "diagnosed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_diagnosis_sources" (
    "clinical_diagnosis_id" UUID NOT NULL,
    "clinical_encounter_id" UUID NOT NULL,

    CONSTRAINT "clinical_diagnosis_sources_pkey" PRIMARY KEY ("clinical_diagnosis_id")
);

-- CreateTable
CREATE TABLE "treatment_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clinical_record_id" UUID NOT NULL,
    "psychologist_profile_id" UUID NOT NULL,
    "status" "treatment_plan_status" NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "starts_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(3),

    CONSTRAINT "treatment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_goals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "treatment_plan_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "target_date" DATE,
    "status" "treatment_goal_status" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "treatment_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(80) NOT NULL,
    "version" VARCHAR(30) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content_hash" VARCHAR(128) NOT NULL,
    "published_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consent_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patient_profile_id" UUID NOT NULL,
    "consent_document_id" UUID NOT NULL,
    "decision" "consent_decision" NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" INET,

    CONSTRAINT "patient_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_conversations" (
    "conversation_id" UUID NOT NULL,
    "service_request_id" UUID NOT NULL,

    CONSTRAINT "request_conversations_pkey" PRIMARY KEY ("conversation_id")
);

-- CreateTable
CREATE TABLE "appointment_conversations" (
    "conversation_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,

    CONSTRAINT "appointment_conversations_pkey" PRIMARY KEY ("conversation_id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(3),

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_id" TEXT,
    "conversation_participant_id" UUID NOT NULL,
    "type" "message_type" NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "offer_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "payment_method" VARCHAR(50) NOT NULL,
    "transaction_ref" VARCHAR(100) NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "from_status" "payment_status",
    "to_status" "payment_status" NOT NULL,
    "external_ref" VARCHAR(160),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "triage_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patient_profile_id" UUID NOT NULL,
    "reviewed_by_psychologist_id" UUID,
    "provider" VARCHAR(80) NOT NULL,
    "model" VARCHAR(120) NOT NULL,
    "prompt_version" VARCHAR(40) NOT NULL,
    "primary_need" VARCHAR(240) NOT NULL,
    "recommended_modality" "modality" NOT NULL,
    "suggested_budget_min" DECIMAL(12,2) NOT NULL,
    "suggested_budget_max" DECIMAL(12,2) NOT NULL,
    "summary" TEXT NOT NULL,
    "risk_level" "triage_risk_level" NOT NULL,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "triage_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_triage_assessments" (
    "triage_assessment_id" UUID NOT NULL,
    "service_request_id" UUID NOT NULL,

    CONSTRAINT "request_triage_assessments_pkey" PRIMARY KEY ("triage_assessment_id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "appointment_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" UUID NOT NULL,
    "request_id" VARCHAR(100),
    "ip_address" INET,
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aggregate_type" VARCHAR(100) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" VARCHAR(160) NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_legacy_id_key" ON "users"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_expires_at_idx" ON "auth_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "patient_profiles_user_id_key" ON "patient_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "psychologist_profiles_user_id_key" ON "psychologist_profiles"("user_id");

-- CreateIndex
CREATE INDEX "psychologist_profiles_verification_status_idx" ON "psychologist_profiles"("verification_status");

-- CreateIndex
CREATE UNIQUE INDEX "professional_licenses_authority_license_number_key" ON "professional_licenses"("authority", "license_number");

-- CreateIndex
CREATE UNIQUE INDEX "specialties_code_key" ON "specialties"("code");

-- CreateIndex
CREATE UNIQUE INDEX "specialties_name_key" ON "specialties"("name");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_legacy_id_key" ON "service_requests"("legacy_id");

-- CreateIndex
CREATE INDEX "service_requests_status_created_at_idx" ON "service_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "service_requests_patient_profile_id_created_at_idx" ON "service_requests"("patient_profile_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "offers_legacy_id_key" ON "offers"("legacy_id");

-- CreateIndex
CREATE INDEX "offers_request_id_status_idx" ON "offers"("request_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "offers_request_id_psychologist_profile_id_key" ON "offers"("request_id", "psychologist_profile_id");

-- CreateIndex
CREATE INDEX "care_relationships_patient_profile_id_psychologist_profile__idx" ON "care_relationships"("patient_profile_id", "psychologist_profile_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "care_relationship_sources_service_request_id_key" ON "care_relationship_sources"("service_request_id");

-- CreateIndex
CREATE INDEX "availability_rules_psychologist_profile_id_weekday_is_activ_idx" ON "availability_rules"("psychologist_profile_id", "weekday", "is_active");

-- CreateIndex
CREATE INDEX "availability_exceptions_psychologist_profile_id_starts_at_e_idx" ON "availability_exceptions"("psychologist_profile_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "appointments_psychologist_profile_id_starts_at_idx" ON "appointments"("psychologist_profile_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_patient_profile_id_starts_at_idx" ON "appointments"("patient_profile_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_requests_service_request_id_key" ON "appointment_requests"("service_request_id");

-- CreateIndex
CREATE INDEX "appointment_care_relationships_care_relationship_id_idx" ON "appointment_care_relationships"("care_relationship_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_records_patient_profile_id_key" ON "clinical_records"("patient_profile_id");

-- CreateIndex
CREATE INDEX "clinical_encounters_clinical_record_id_started_at_idx" ON "clinical_encounters"("clinical_record_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_encounter_appointments_appointment_id_key" ON "clinical_encounter_appointments"("appointment_id");

-- CreateIndex
CREATE INDEX "clinical_notes_clinical_encounter_id_created_at_idx" ON "clinical_notes"("clinical_encounter_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_note_versions_clinical_note_id_version_number_key" ON "clinical_note_versions"("clinical_note_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "diagnosis_catalog_code_system_code_key" ON "diagnosis_catalog"("code_system", "code");

-- CreateIndex
CREATE INDEX "clinical_diagnoses_clinical_record_id_diagnosed_at_idx" ON "clinical_diagnoses"("clinical_record_id", "diagnosed_at");

-- CreateIndex
CREATE INDEX "clinical_diagnosis_sources_clinical_encounter_id_idx" ON "clinical_diagnosis_sources"("clinical_encounter_id");

-- CreateIndex
CREATE INDEX "treatment_plans_clinical_record_id_status_idx" ON "treatment_plans"("clinical_record_id", "status");

-- CreateIndex
CREATE INDEX "treatment_goals_treatment_plan_id_status_idx" ON "treatment_goals"("treatment_plan_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "consent_documents_code_version_key" ON "consent_documents"("code", "version");

-- CreateIndex
CREATE INDEX "patient_consents_patient_profile_id_consent_document_id_occ_idx" ON "patient_consents"("patient_profile_id", "consent_document_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "request_conversations_service_request_id_key" ON "request_conversations"("service_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_conversations_appointment_id_key" ON "appointment_conversations"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversation_id_user_id_key" ON "conversation_participants"("conversation_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_legacy_id_key" ON "messages"("legacy_id");

-- CreateIndex
CREATE INDEX "messages_conversation_participant_id_sent_at_idx" ON "messages"("conversation_participant_id", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_offer_id_key" ON "payments"("offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_ref_key" ON "payments"("transaction_ref");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");

-- CreateIndex
CREATE INDEX "payment_events_payment_id_occurred_at_idx" ON "payment_events"("payment_id", "occurred_at");

-- CreateIndex
CREATE INDEX "triage_assessments_patient_profile_id_created_at_idx" ON "triage_assessments"("patient_profile_id", "created_at");

-- CreateIndex
CREATE INDEX "request_triage_assessments_service_request_id_idx" ON "request_triage_assessments"("service_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_appointment_id_key" ON "reviews"("appointment_id");

-- CreateIndex
CREATE INDEX "audit_events_resource_type_resource_id_occurred_at_idx" ON "audit_events"("resource_type", "resource_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_user_id_occurred_at_idx" ON "audit_events"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_occurred_at_idx" ON "outbox_events"("published_at", "occurred_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psychologist_profiles" ADD CONSTRAINT "psychologist_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_licenses" ADD CONSTRAINT "professional_licenses_psychologist_profile_id_fkey" FOREIGN KEY ("psychologist_profile_id") REFERENCES "psychologist_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psychologist_specialties" ADD CONSTRAINT "psychologist_specialties_psychologist_profile_id_fkey" FOREIGN KEY ("psychologist_profile_id") REFERENCES "psychologist_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psychologist_specialties" ADD CONSTRAINT "psychologist_specialties_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psychologist_modalities" ADD CONSTRAINT "psychologist_modalities_psychologist_profile_id_fkey" FOREIGN KEY ("psychologist_profile_id") REFERENCES "psychologist_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_patient_profile_id_fkey" FOREIGN KEY ("patient_profile_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_psychologist_profile_id_fkey" FOREIGN KEY ("psychologist_profile_id") REFERENCES "psychologist_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_relationships" ADD CONSTRAINT "care_relationships_patient_profile_id_fkey" FOREIGN KEY ("patient_profile_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_relationships" ADD CONSTRAINT "care_relationships_psychologist_profile_id_fkey" FOREIGN KEY ("psychologist_profile_id") REFERENCES "psychologist_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_relationship_sources" ADD CONSTRAINT "care_relationship_sources_care_relationship_id_fkey" FOREIGN KEY ("care_relationship_id") REFERENCES "care_relationships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_relationship_sources" ADD CONSTRAINT "care_relationship_sources_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_psychologist_profile_id_fkey" FOREIGN KEY ("psychologist_profile_id") REFERENCES "psychologist_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_psychologist_profile_id_fkey" FOREIGN KEY ("psychologist_profile_id") REFERENCES "psychologist_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_profile_id_fkey" FOREIGN KEY ("patient_profile_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_psychologist_profile_id_fkey" FOREIGN KEY ("psychologist_profile_id") REFERENCES "psychologist_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_requests" ADD CONSTRAINT "appointment_requests_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_requests" ADD CONSTRAINT "appointment_requests_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_care_relationships" ADD CONSTRAINT "appointment_care_relationships_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_care_relationships" ADD CONSTRAINT "appointment_care_relationships_care_relationship_id_fkey" FOREIGN KEY ("care_relationship_id") REFERENCES "care_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_patient_profile_id_fkey" FOREIGN KEY ("patient_profile_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "clinical_encounters_clinical_record_id_fkey" FOREIGN KEY ("clinical_record_id") REFERENCES "clinical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "clinical_encounters_psychologist_profile_id_fkey" FOREIGN KEY ("psychologist_profile_id") REFERENCES "psychologist_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounter_appointments" ADD CONSTRAINT "clinical_encounter_appointments_clinical_encounter_id_fkey" FOREIGN KEY ("clinical_encounter_id") REFERENCES "clinical_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounter_appointments" ADD CONSTRAINT "clinical_encounter_appointments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_clinical_encounter_id_fkey" FOREIGN KEY ("clinical_encounter_id") REFERENCES "clinical_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_note_versions" ADD CONSTRAINT "clinical_note_versions_clinical_note_id_fkey" FOREIGN KEY ("clinical_note_id") REFERENCES "clinical_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_note_versions" ADD CONSTRAINT "clinical_note_versions_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_diagnoses" ADD CONSTRAINT "clinical_diagnoses_clinical_record_id_fkey" FOREIGN KEY ("clinical_record_id") REFERENCES "clinical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_diagnoses" ADD CONSTRAINT "clinical_diagnoses_diagnosis_catalog_id_fkey" FOREIGN KEY ("diagnosis_catalog_id") REFERENCES "diagnosis_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_diagnoses" ADD CONSTRAINT "clinical_diagnoses_psychologist_profile_id_fkey" FOREIGN KEY ("psychologist_profile_id") REFERENCES "psychologist_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_diagnosis_sources" ADD CONSTRAINT "clinical_diagnosis_sources_clinical_diagnosis_id_fkey" FOREIGN KEY ("clinical_diagnosis_id") REFERENCES "clinical_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_diagnosis_sources" ADD CONSTRAINT "clinical_diagnosis_sources_clinical_encounter_id_fkey" FOREIGN KEY ("clinical_encounter_id") REFERENCES "clinical_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_clinical_record_id_fkey" FOREIGN KEY ("clinical_record_id") REFERENCES "clinical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_psychologist_profile_id_fkey" FOREIGN KEY ("psychologist_profile_id") REFERENCES "psychologist_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_goals" ADD CONSTRAINT "treatment_goals_treatment_plan_id_fkey" FOREIGN KEY ("treatment_plan_id") REFERENCES "treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_patient_profile_id_fkey" FOREIGN KEY ("patient_profile_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_consent_document_id_fkey" FOREIGN KEY ("consent_document_id") REFERENCES "consent_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_conversations" ADD CONSTRAINT "request_conversations_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_conversations" ADD CONSTRAINT "request_conversations_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_conversations" ADD CONSTRAINT "appointment_conversations_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_conversations" ADD CONSTRAINT "appointment_conversations_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_participant_id_fkey" FOREIGN KEY ("conversation_participant_id") REFERENCES "conversation_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triage_assessments" ADD CONSTRAINT "triage_assessments_patient_profile_id_fkey" FOREIGN KEY ("patient_profile_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triage_assessments" ADD CONSTRAINT "triage_assessments_reviewed_by_psychologist_id_fkey" FOREIGN KEY ("reviewed_by_psychologist_id") REFERENCES "psychologist_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_triage_assessments" ADD CONSTRAINT "request_triage_assessments_triage_assessment_id_fkey" FOREIGN KEY ("triage_assessment_id") REFERENCES "triage_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_triage_assessments" ADD CONSTRAINT "request_triage_assessments_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain checks not expressible in Prisma Schema Language.
ALTER TABLE "users"
    ADD CONSTRAINT "users_email_canonical_check"
    CHECK ("email" = lower(btrim("email")));

ALTER TABLE "psychologist_modalities"
    ADD CONSTRAINT "psychologist_modalities_price_positive_check"
    CHECK ("price_per_hour" > 0);

ALTER TABLE "service_requests"
    ADD CONSTRAINT "service_requests_budget_positive_check"
    CHECK ("proposed_budget" > 0);

ALTER TABLE "offers"
    ADD CONSTRAINT "offers_amount_positive_check"
    CHECK ("amount" > 0);

ALTER TABLE "availability_rules"
    ADD CONSTRAINT "availability_rules_weekday_check"
    CHECK ("weekday" BETWEEN 0 AND 6),
    ADD CONSTRAINT "availability_rules_time_range_check"
    CHECK ("start_time" < "end_time"),
    ADD CONSTRAINT "availability_rules_effective_range_check"
    CHECK ("effective_until" IS NULL OR "effective_from" IS NULL OR "effective_from" <= "effective_until");

ALTER TABLE "availability_exceptions"
    ADD CONSTRAINT "availability_exceptions_time_range_check"
    CHECK ("starts_at" < "ends_at");

ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_time_range_check"
    CHECK ("starts_at" < "ends_at"),
    ADD CONSTRAINT "appointments_cancellation_reason_check"
    CHECK ("status" <> 'CANCELLED' OR "cancellation_reason" IS NOT NULL);

ALTER TABLE "care_relationships"
    ADD CONSTRAINT "care_relationships_time_range_check"
    CHECK ("ended_at" IS NULL OR "started_at" < "ended_at"),
    ADD CONSTRAINT "care_relationships_ended_state_check"
    CHECK (("status" = 'ENDED') = ("ended_at" IS NOT NULL));

ALTER TABLE "clinical_records"
    ADD CONSTRAINT "clinical_records_time_range_check"
    CHECK ("closed_at" IS NULL OR "opened_at" < "closed_at"),
    ADD CONSTRAINT "clinical_records_closed_state_check"
    CHECK (("status" = 'OPEN' AND "closed_at" IS NULL) OR ("status" <> 'OPEN' AND "closed_at" IS NOT NULL));

ALTER TABLE "clinical_encounters"
    ADD CONSTRAINT "clinical_encounters_time_range_check"
    CHECK ("ended_at" IS NULL OR "started_at" < "ended_at");

ALTER TABLE "clinical_notes"
    ADD CONSTRAINT "clinical_notes_signature_check"
    CHECK (("status" = 'DRAFT' AND "signed_at" IS NULL) OR ("status" <> 'DRAFT' AND "signed_at" IS NOT NULL));

ALTER TABLE "clinical_note_versions"
    ADD CONSTRAINT "clinical_note_versions_number_positive_check"
    CHECK ("version_number" > 0);

ALTER TABLE "treatment_plans"
    ADD CONSTRAINT "treatment_plans_time_range_check"
    CHECK ("ends_at" IS NULL OR "starts_at" < "ends_at");

ALTER TABLE "conversation_participants"
    ADD CONSTRAINT "conversation_participants_time_range_check"
    CHECK ("left_at" IS NULL OR "joined_at" < "left_at");

ALTER TABLE "messages"
    ADD CONSTRAINT "messages_content_not_blank_check"
    CHECK (length(btrim("content")) > 0),
    ADD CONSTRAINT "messages_edit_time_check"
    CHECK ("edited_at" IS NULL OR "sent_at" <= "edited_at");

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_amount_positive_check"
    CHECK ("amount" > 0),
    ADD CONSTRAINT "payments_currency_uppercase_check"
    CHECK ("currency_code" = upper("currency_code"));

ALTER TABLE "triage_assessments"
    ADD CONSTRAINT "triage_assessments_budget_check"
    CHECK ("suggested_budget_min" >= 0 AND "suggested_budget_min" <= "suggested_budget_max"),
    ADD CONSTRAINT "triage_assessments_review_check"
    CHECK (("reviewed_by_psychologist_id" IS NULL) = ("reviewed_at" IS NULL));

ALTER TABLE "reviews"
    ADD CONSTRAINT "reviews_rating_check"
    CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "outbox_events"
    ADD CONSTRAINT "outbox_events_attempts_nonnegative_check"
    CHECK ("attempts" >= 0);

-- Only one accepted offer and one active care relationship are allowed.
CREATE UNIQUE INDEX "offers_one_accepted_per_request_key"
    ON "offers" ("request_id")
    WHERE "status" = 'ACCEPTED';

CREATE UNIQUE INDEX "care_relationships_one_active_pair_key"
    ON "care_relationships" ("patient_profile_id", "psychologist_profile_id")
    WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "psychologist_specialties_one_primary_key"
    ON "psychologist_specialties" ("psychologist_profile_id")
    WHERE "is_primary" = true;

-- Prevent concurrent bookings for either participant. Cancelled appointments
-- no longer reserve their time range.
ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_psychologist_no_overlap"
    EXCLUDE USING gist (
        "psychologist_profile_id" WITH =,
        tstzrange("starts_at", "ends_at", '[)') WITH &&
    ) WHERE ("status" <> 'CANCELLED'),
    ADD CONSTRAINT "appointments_patient_no_overlap"
    EXCLUDE USING gist (
        "patient_profile_id" WITH =,
        tstzrange("starts_at", "ends_at", '[)') WITH &&
    ) WHERE ("status" <> 'CANCELLED');

-- Spatial indexes used by nearby-psychologist and nearby-request searches.
CREATE INDEX "psychologist_profiles_location_gist_idx"
    ON "psychologist_profiles" USING gist ("location");

CREATE INDEX "service_requests_location_gist_idx"
    ON "service_requests" USING gist ("location");

-- Stable role identifiers are looked up by code; users are never assigned a
-- privileged role implicitly by a request payload.
INSERT INTO "roles" ("code", "name", "description") VALUES
    ('patient', 'Paciente', 'Persona que solicita atención emocional'),
    ('psychologist', 'Psicólogo', 'Profesional que presta atención'),
    ('administrator', 'Administrador', 'Administra la operación sin acceso clínico implícito'),
    ('clinical_auditor', 'Auditor clínico', 'Acceso clínico excepcional y siempre auditado');
