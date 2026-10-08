CREATE TYPE "media_purpose" AS ENUM ('PROFILE_PHOTO', 'PROFESSIONAL_EVIDENCE');

CREATE TYPE "malware_scan_status" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED');

CREATE TABLE "media_objects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "purpose" "media_purpose" NOT NULL,
  "target_resource_id" UUID,
  "object_key" VARCHAR(512) NOT NULL,
  "public_path" TEXT,
  "content_type" VARCHAR(100) NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "scan_status" "malware_scan_status" NOT NULL DEFAULT 'PENDING',
  "scanned_at" TIMESTAMPTZ(3),
  "activated_at" TIMESTAMPTZ(3),
  "discarded_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_objects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "media_objects_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "media_objects_byte_size_positive" CHECK ("byte_size" > 0)
);

CREATE UNIQUE INDEX "media_objects_object_key_key" ON "media_objects"("object_key");
CREATE INDEX "media_objects_scan_status_discarded_at_created_at_idx"
  ON "media_objects"("scan_status", "discarded_at", "created_at");
CREATE INDEX "media_objects_owner_user_id_purpose_created_at_idx"
  ON "media_objects"("owner_user_id", "purpose", "created_at");
CREATE INDEX "media_objects_target_resource_id_purpose_scan_status_idx"
  ON "media_objects"("target_resource_id", "purpose", "scan_status");
