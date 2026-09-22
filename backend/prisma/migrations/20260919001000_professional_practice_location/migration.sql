ALTER TABLE "psychologist_profiles"
  ADD COLUMN "practice_name" VARCHAR(120),
  ADD COLUMN "practice_address" VARCHAR(300),
  ADD COLUMN "practice_directions" VARCHAR(500),
  ADD COLUMN "location_updated_at" TIMESTAMPTZ(3);

ALTER TABLE "psychologist_profiles"
  ADD CONSTRAINT "psychologist_profiles_practice_location_consistency_check"
  CHECK (
    ("location" IS NULL AND "practice_name" IS NULL AND "practice_address" IS NULL)
    OR
    ("location" IS NOT NULL AND "practice_name" IS NOT NULL AND "practice_address" IS NOT NULL)
  );
