CREATE TYPE "appointment_event_type" AS ENUM (
    'CREATED',
    'STATUS_CHANGED',
    'RESCHEDULED'
);

CREATE TABLE "appointment_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "appointment_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "type" "appointment_event_type" NOT NULL,
    "from_status" "appointment_status",
    "to_status" "appointment_status" NOT NULL,
    "previous_starts_at" TIMESTAMPTZ(3),
    "previous_ends_at" TIMESTAMPTZ(3),
    "reason" VARCHAR(500),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "appointment_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "appointment_events_previous_range_check"
      CHECK (
        ("previous_starts_at" IS NULL AND "previous_ends_at" IS NULL)
        OR (
          "type" = 'RESCHEDULED'
          AND "previous_starts_at" IS NOT NULL
          AND "previous_ends_at" IS NOT NULL
          AND "previous_starts_at" < "previous_ends_at"
        )
      ),
    CONSTRAINT "appointment_events_created_state_check"
      CHECK ("type" <> 'CREATED' OR ("from_status" IS NULL AND "to_status" = 'SCHEDULED')),
    CONSTRAINT "appointment_events_transition_state_check"
      CHECK ("type" = 'CREATED' OR "from_status" IS NOT NULL)
);

CREATE INDEX "appointment_events_appointment_id_occurred_at_id_idx"
    ON "appointment_events"("appointment_id", "occurred_at", "id");

CREATE INDEX "appointment_events_actor_user_id_occurred_at_idx"
    ON "appointment_events"("actor_user_id", "occurred_at");

ALTER TABLE "appointment_events"
    ADD CONSTRAINT "appointment_events_appointment_id_fkey"
      FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "appointment_events_actor_user_id_fkey"
      FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;

-- Historical terminal appointments no longer reserve a time interval. The
-- active states continue to be protected atomically for both participants.
ALTER TABLE "appointments"
    DROP CONSTRAINT "appointments_psychologist_no_overlap",
    DROP CONSTRAINT "appointments_patient_no_overlap";

ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_psychologist_no_overlap"
    EXCLUDE USING gist (
        "psychologist_profile_id" WITH =,
        tstzrange("starts_at", "ends_at", '[)') WITH &&
    ) WHERE ("status" IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')),
    ADD CONSTRAINT "appointments_patient_no_overlap"
    EXCLUDE USING gist (
        "patient_profile_id" WITH =,
        tstzrange("starts_at", "ends_at", '[)') WITH &&
    ) WHERE ("status" IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'));
